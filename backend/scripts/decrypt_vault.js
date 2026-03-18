/**
 * decrypt_vault.js - Utility Offline di Decifratura
 *
 * Uso: node scripts/decrypt_vault.js <file.enc> [--out output_dir]
 *
 * Decifra un blob .enc prodotto dall'IntrusionResponseService usando
 * la Chiave Privata RSA che risiede solo nella sandbox sicura.
 *
 * NON eseguire questo script sul server honeypot compromesso.
 * Usarlo offline o nella sandbox sicura di decifratura.
 */

const crypto = require('crypto');
const fs     = require('fs');
const path   = require('path');

// --- Argomenti CLI ---
const args      = process.argv.slice(2);
const encFile   = args[0];
const outFlag   = args.indexOf('--out');
const outputDir = outFlag >= 0 ? args[outFlag + 1] : path.dirname(encFile || '.');

if (!encFile) {
    console.error('Uso: node scripts/decrypt_vault.js <file.enc> [--out directory]');
    process.exit(1);
}

if (!fs.existsSync(encFile)) {
    console.error(`❌ File non trovato: ${encFile}`);
    process.exit(1);
}

// --- Chiave Privata ---
// Cerca in tre posti: opzione --key, variabile PRIVATE_KEY_PATH, percorso di default
const keyFlag   = args.indexOf('--key');
const keyPath   = keyFlag >= 0
    ? args[keyFlag + 1]
    : process.env.PRIVATE_KEY_PATH || path.resolve(__dirname, '../../secure_vault_keys/private_key.pem');

if (!fs.existsSync(keyPath)) {
    console.error(`❌ Chiave privata non trovata: ${keyPath}`);
    console.error('   Specifica il percorso con: --key /percorso/chiave/private_key.pem');
    process.exit(1);
}

// --- Decifratura ---
try {
    const privateKey = fs.readFileSync(keyPath, 'utf8');
    const payload    = fs.readFileSync(encFile);

    /*
     * Formato atteso (scritto da IntrusionResponseService.encryptFile):
     *   [4 byte: lunghezza encryptedKey (big-endian uint32)]
     *   [N byte: encryptedKey (RSA)]
     *   [16 byte: IV AES-256-GCM]
     *   [16 byte: authTag GCM]
     *   [resto: dati cifrati AES-256-GCM]
     */
    let offset = 0;

    const keyLen = payload.readUInt32BE(offset);
    offset += 4;

    const encryptedKey = payload.slice(offset, offset + keyLen);
    offset += keyLen;

    const iv = payload.slice(offset, offset + 16);
    offset += 16;

    const authTag = payload.slice(offset, offset + 16);
    offset += 16;

    const encryptedData = payload.slice(offset);

    // Decifra la chiave AES con la Chiave Privata RSA
    const aesKey = crypto.privateDecrypt(privateKey, encryptedKey);

    // Decifra i dati con AES-256-GCM
    const decipher = crypto.createDecipheriv('aes-256-gcm', aesKey, iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([decipher.update(encryptedData), decipher.final()]);

    // Salva il file decifrato
    const baseName   = path.basename(encFile, '.enc');
    const outputFile = path.join(outputDir, baseName);

    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
    fs.writeFileSync(outputFile, decrypted);

    console.log(`✅ File decifrato con successo: ${outputFile}`);
    console.log(`   Dimensione: ${decrypted.length} byte`);

} catch (err) {
    console.error('❌ Decifratura fallita:', err.message);
    if (err.message.includes('bad decrypt') || err.message.includes('Unsupported')) {
        console.error('   → Chiave privata errata o file corrotto.');
    }
    process.exit(1);
}
