/**
 * IntrusionResponseService - Auto-Protezione dei Dati in Caso di Intrusione
 *
 * Flusso di esecuzione (Catena di Evacuazione):
 *   1. FREEZE   – blocca l'avvio di nuove operazioni di risposta parallele
 *   2. ENCRYPT  – cifra i file sensibili con la Chiave Pubblica RSA
 *   3. SHIP     – invia i blob .enc al Vault della Sandbox tramite endpoint unidirezionale
 *   4. SHRED    – sovrascrive i file originali con dati casuali, poi li elimina
 *
 * Sicurezza:
 *   - La Chiave Privata risiede SOLO nella sandbox sicura (offline).
 *   - Il canale di trasferimento usa un VAULT_TOKEN monouso.
 *   - Lo shredding usa 3 passaggi di sovrascrittura (random → zero → random).
 *
 * @module services/intrusionResponseService
 */

const crypto   = require('crypto');
const fs       = require('fs');
const path     = require('path');
const http     = require('http');

// =====================================================
// CONFIGURAZIONE
// =====================================================
const PUBLIC_KEY_PATH  = path.resolve(__dirname, '../config/keys/public_key.pem');
const VAULT_HOST       = process.env.VAULT_HOST       || 'localhost';
const VAULT_PORT       = parseInt(process.env.VAULT_PORT || '4003', 10);
const VAULT_PATH       = '/api/secure-vault/upload';
const VAULT_TOKEN      = process.env.VAULT_TOKEN;       // Token monouso generato dal server

/**
 * File sensibili da proteggere quando si attiva la catena.
 * Include percorsi fissi e directory dinamiche.
 */
const SENSITIVE_PATHS = [
    path.resolve(__dirname, '../../.env'),
    path.resolve(__dirname, '../../sessions_data.json'),
    path.resolve(__dirname, '../../temp_logs.json'),
    path.resolve(__dirname, '../../../admin.log'),
    path.resolve(__dirname, '../../../admin.txt'),
    path.resolve(__dirname, '../data'), // Tutta la cartella data
    path.resolve(__dirname, '../../logs'), // Tutta la cartella logs
];

class IntrusionResponseService {
    /** Evita esecuzioni parallele della catena */
    static activated = false;

    /**
     * Raccoglie ricorsivamente tutti i file validi dalle path configurate.
     */
    static getFilesToProtect() {
        const files = [];
        for (const p of SENSITIVE_PATHS) {
            if (!fs.existsSync(p)) continue;
            
            if (fs.statSync(p).isDirectory()) {
                const dirFiles = fs.readdirSync(p)
                    .map(f => path.join(p, f))
                    .filter(f => fs.statSync(f).isFile());
                files.push(...dirFiles);
            } else {
                files.push(p);
            }
        }
        // Rimuove duplicati e file non esistenti
        return [...new Set(files)].filter(f => fs.existsSync(f));
    }

    // =========================================================
    // ENTRY POINT PRINCIPALE
    // =========================================================

    /**
     * Avvia la catena completa di Auto-Protezione.
     * È idempotente: eseguita solo una volta per processo.
     *
     * @param {string} reason - Motivo del trigger (per logging)
     */
    static async secureEvacuationChain(reason = 'Unknown trigger') {
        if (this.activated) {
            console.warn('🔒 [IntrusionResponse] Catena già attivata. Ignorato.');
            return;
        }
        this.activated = true;

        console.error(`\n🚨🚨🚨 [INTRUSIONE RILEVATA] Motivo: ${reason}`);
        console.error('🔒 Avvio catena di Auto-Protezione...\n');

        const filesToProtect = this.getFilesToProtect();
        let successful = 0;
        let failed     = 0;

        for (const filePath of filesToProtect) {
            try {
                // 1. CIFRA
                console.log(`  🔐 Cifratura: ${path.basename(filePath)}`);
                const encPath = await this.encryptFile(filePath);

                // 2. INVIA AL VAULT
                console.log(`  📤 Invio al vault: ${path.basename(encPath)}`);
                await this.shipToVault(encPath, path.basename(filePath));

                // 3. SHRED del file originale
                console.log(`  🔥 Shredding: ${path.basename(filePath)}`);
                await this.shredFile(filePath);

                // 4. Elimina anche il blob .enc locale (già al sicuro nel vault)
                if (fs.existsSync(encPath)) {
                    fs.unlinkSync(encPath);
                }

                console.log(`  ✅ ${path.basename(filePath)} → protetto e distrutto localmente.\n`);
                successful++;
            } catch (err) {
                console.error(`  ❌ Errore su ${path.basename(filePath)}:`, err.message || err);
                failed++;
            }
        }

        console.error(`\n🏁 Catena completata: ${successful} file protetti, ${failed} falliti.`);
        if (failed === 0) {
            console.error('✅ Sistema in stato sicuro. Nessun dato leggibile è più presente sull\'honeypot.');
        } else {
            console.error('⚠️  Alcuni file non sono stati protetti. Verificare i log.');
        }
    }

    // =========================================================
    // STEP 1 – CIFRATURA CON CHIAVE PUBBLICA RSA
    // =========================================================

    /**
     * Cifra un file con la Chiave Pubblica RSA e salva il risultato come <nome>.enc
     * Usa un approccio ibrido: AES-256-GCM per i dati + RSA per la chiave AES.
     *
     * @param {string} filePath   - Percorso del file da cifrare
     * @returns {string}          - Percorso del file .enc generato
     */
    static async encryptFile(filePath) {
        const publicKey = this._loadPublicKey();

        const plaintext = fs.readFileSync(filePath);

        // Genera una chiave AES simmetrica casuale (32 byte = 256 bit)
        const aesKey = crypto.randomBytes(32);
        const iv     = crypto.randomBytes(16);

        // Cifra il contenuto con AES-256-GCM
        const cipher  = crypto.createCipheriv('aes-256-gcm', aesKey, iv);
        const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
        const authTag   = cipher.getAuthTag(); // 16 byte

        // Cifra la chiave AES con RSA (la chiave privata è nella sandbox)
        const encryptedKey = crypto.publicEncrypt(publicKey, aesKey);

        /*
         * Formato del file .enc (tutto binario):
         *   [4 byte: lunghezza encryptedKey (big-endian uint32)]
         *   [N byte: encryptedKey]
         *   [16 byte: IV]
         *   [16 byte: authTag GCM]
         *   [resto: dati cifrati AES-256-GCM]
         */
        const keyLenBuf = Buffer.allocUnsafe(4);
        keyLenBuf.writeUInt32BE(encryptedKey.length, 0);

        const payload = Buffer.concat([keyLenBuf, encryptedKey, iv, authTag, encrypted]);

        const encPath = filePath + '.enc';
        fs.writeFileSync(encPath, payload);
        return encPath;
    }

    /**
     * Carica la Chiave Pubblica RSA dal disco.
     * @throws {Error} se il file non esiste.
     */
    static _loadPublicKey() {
        if (!fs.existsSync(PUBLIC_KEY_PATH)) {
            throw new Error(
                `Chiave pubblica non trovata in ${PUBLIC_KEY_PATH}. ` +
                `Eseguire: node scripts/generate_keys.js`
            );
        }
        return fs.readFileSync(PUBLIC_KEY_PATH, 'utf8');
    }

    // =========================================================
    // STEP 2 – INVIO UNIDIREZIONALE AL VAULT (SANDBOX)
    // =========================================================

    /**
     * Invia il blob cifrato al Vault della Sandbox tramite una richiesta HTTP autenticata.
     * È unidirezionale: la risposta viene ignorata dopo il successo e non apre flussi bidirezionali.
     *
     * @param {string} encFilePath   - Percorso del file .enc locale
     * @param {string} originalName  - Nome originale del file (metadato)
     */
    static async shipToVault(encFilePath, originalName) {
        if (!VAULT_TOKEN) {
            throw new Error('VAULT_TOKEN non configurato. Impostare la variabile d\'ambiente VAULT_TOKEN.');
        }

        const payload = fs.readFileSync(encFilePath);
        const meta    = JSON.stringify({
            originalName,
            encryptedAt: new Date().toISOString(),
            size: payload.length
        });

        // Costruiamo il body multipart manualmente (senza dipendenze esterne)
        const boundary = `----HoneypotVault${crypto.randomBytes(8).toString('hex')}`;
        const metaPart = Buffer.from(
            `--${boundary}\r\n` +
            `Content-Disposition: form-data; name="meta"\r\n\r\n` +
            `${meta}\r\n`
        );
        const filePart = Buffer.concat([
            Buffer.from(
                `--${boundary}\r\n` +
                `Content-Disposition: form-data; name="file"; filename="${originalName}.enc"\r\n` +
                `Content-Type: application/octet-stream\r\n\r\n`
            ),
            payload,
            Buffer.from(`\r\n--${boundary}--\r\n`)
        ]);
        const body = Buffer.concat([metaPart, filePart]);

        return new Promise((resolve, reject) => {
            const options = {
                hostname : VAULT_HOST,
                port     : VAULT_PORT,
                path     : VAULT_PATH,
                method   : 'POST',
                headers  : {
                    'Content-Type'  : `multipart/form-data; boundary=${boundary}`,
                    'Content-Length': body.length,
                    'X-Vault-Token' : VAULT_TOKEN,
                    'X-Vault-Op'    : 'emergency-evacuation',
                }
            };

            const req = http.request(options, (res) => {
                // Legge la risposta ma non la usa (canale unidirezionale)
                res.resume();
                if (res.statusCode === 200 || res.statusCode === 201) {
                    resolve();
                } else {
                    reject(new Error(`Vault ha risposto con status ${res.statusCode}`));
                }
            });

            req.on('error', reject);
            req.setTimeout(10000, () => {
                req.destroy();
                reject(new Error('Timeout connessione al Vault'));
            });

            req.write(body);
            req.end();
        });
    }

    // =========================================================
    // STEP 3 – SHREDDING MILITARE DEI FILE ORIGINALI
    // =========================================================

    /**
     * Sovrascrive un file con 3 passaggi (random → zero → random) poi lo elimina.
     * Su filesystem moderni con journaling si tratta di best-effort, ma è sufficiente
     * per impedire il recupero da processi user-space o log applicativi.
     *
     * @param {string} filePath - Percorso del file da distruggere
     */
    static async shredFile(filePath) {
        const stats    = fs.statSync(filePath);
        const fileSize = stats.size;

        const fd = fs.openSync(filePath, 'r+');
        try {
            // Passaggio 1: dati casuali
            const random1 = crypto.randomBytes(fileSize);
            fs.writeSync(fd, random1, 0, fileSize, 0);
            fs.fdatasyncSync(fd);

            // Passaggio 2: zeri
            const zeros = Buffer.alloc(fileSize, 0);
            fs.writeSync(fd, zeros, 0, fileSize, 0);
            fs.fdatasyncSync(fd);

            // Passaggio 3: dati casuali nuovamente
            const random2 = crypto.randomBytes(fileSize);
            fs.writeSync(fd, random2, 0, fileSize, 0);
            fs.fdatasyncSync(fd);
        } finally {
            fs.closeSync(fd);
        }

        fs.unlinkSync(filePath);
    }
}

module.exports = IntrusionResponseService;
