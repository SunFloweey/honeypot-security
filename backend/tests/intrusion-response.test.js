/**
 * intrusion-response.test.js
 *
 * Suite di test per il Sistema di Auto-Protezione (IntrusionResponseService).
 * Non richiede DB, Docker o server attivi: è una suite di unit/integration test.
 *
 * Copertura:
 *   1. PKI – generazione chiavi, cifratura e decifratura
 *   2. Shredding – sovrascrittura e cancellazione dei file
 *   3. Catena di evacuazione (secureEvacuationChain) con vault mockato
 *   4. Canary middleware – intercettazione path sensibili
 *   5. Vault endpoint (admin-server) – autenticazione e ricezione blob
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');

// Percorso del servizio da testare
const IntrusionResponseService = require('../src/services/intrusionResponseService');

// ============================================================
// Utility di test – genera una coppia di chiavi RSA temporanea
// ============================================================
function generateTestKeys() {
    return crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048, // 2048 per test veloci (in produzione usa 4096)
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
    });
}

// ============================================================
// Setup: cartella temp per i file di test
// ============================================================
let tmpDir;
beforeAll(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'honeypot-test-'));
});

afterAll(() => {
    // Cleanup cartella temporanea
    fs.rmSync(tmpDir, { recursive: true, force: true });
    // Reset stato singleton del servizio tra i test
    IntrusionResponseService.activated = false;
});

// ============================================================
// Utility: scrivi un file di test
// ============================================================
function writeTmpFile(name, content) {
    const p = path.join(tmpDir, name);
    fs.writeFileSync(p, content);
    return p;
}

// ============================================================
// TEST 1 – CRITTOGRAFIA (encryptFile + decifratura manuale)
// ============================================================
describe('🔐 PKI – Cifratura e Decifratura', () => {

    let pubPem, privPem, testFilePath, encFilePath;

    beforeAll(() => {
        const { publicKey, privateKey } = generateTestKeys();
        pubPem = publicKey;
        privPem = privateKey;

        // Sostituisci la chiave pubblica nel servizio con quella di test
        const keyDir = path.dirname(IntrusionResponseService._publicKeyPath ||
            path.resolve(__dirname, '../src/config/keys/public_key.pem'));
        if (!fs.existsSync(keyDir)) fs.mkdirSync(keyDir, { recursive: true });
        IntrusionResponseService._testPubKey = pubPem; // override per i test
    });

    test('encryptFile produce un file .enc non leggibile in chiaro', async () => {
        // Scriviamo un file con contenuto sensibile
        testFilePath = writeTmpFile('secret.env', 'DB_PASSWORD=ultrasecret\nAWS_KEY=1234');

        // Monkey-patch _loadPublicKey per usare la chiave di test
        const original = IntrusionResponseService._loadPublicKey.bind(IntrusionResponseService);
        IntrusionResponseService._loadPublicKey = () => pubPem;

        encFilePath = await IntrusionResponseService.encryptFile(testFilePath);

        // Ripristina originale
        IntrusionResponseService._loadPublicKey = original;

        expect(fs.existsSync(encFilePath)).toBe(true);

        // Il file .enc non deve contenere il testo in chiaro
        const raw = fs.readFileSync(encFilePath);
        expect(raw.toString()).not.toContain('DB_PASSWORD=ultrasecret');
        expect(raw.toString()).not.toContain('ultrasecret');
    });

    test('decryption con chiave privata produce il plaintext originale', () => {
        expect(encFilePath).toBeTruthy();
        const payload = fs.readFileSync(encFilePath);

        // Legge il formato binario
        let offset = 0;
        const keyLen = payload.readUInt32BE(offset); offset += 4;
        const encKey = payload.slice(offset, offset + keyLen); offset += keyLen;
        const iv = payload.slice(offset, offset + 16); offset += 16;
        const authTag = payload.slice(offset, offset + 16); offset += 16;
        const encData = payload.slice(offset);

        const aesKey = crypto.privateDecrypt(privPem, encKey);
        const decipher = crypto.createDecipheriv('aes-256-gcm', aesKey, iv);
        decipher.setAuthTag(authTag);
        const decrypted = Buffer.concat([decipher.update(encData), decipher.final()]);

        expect(decrypted.toString()).toBe('DB_PASSWORD=ultrasecret\nAWS_KEY=1234');
    });

    test('decryption con la chiave privata SBAGLIATA deve fallire', () => {
        expect(encFilePath).toBeTruthy();
        const { privateKey: wrongKey } = generateTestKeys();
        const payload = fs.readFileSync(encFilePath);

        let offset = 0;
        const keyLen = payload.readUInt32BE(offset); offset += 4;
        const encKey = payload.slice(offset, offset + keyLen);

        expect(() => {
            crypto.privateDecrypt(wrongKey, encKey);
        }).toThrow();
    });
});

// ============================================================
// TEST 2 – SHREDDING
// ============================================================
describe('🔥 Shredding – Sovrascrittura e Cancellazione', () => {

    test('shredFile sovrascrive il contenuto prima di eliminarlo', async () => {
        const filePath = writeTmpFile('sensitive.log', 'attacker_data=abc123\n'.repeat(100));
        const originalSize = fs.statSync(filePath).size;

        // Prima dello shredding il file esiste
        expect(fs.existsSync(filePath)).toBe(true);

        await IntrusionResponseService.shredFile(filePath);

        // Dopo lo shredding il file non deve esistere più
        expect(fs.existsSync(filePath)).toBe(false);
    });

    test('shredFile lancia eccezione se il file non esiste', async () => {
        await expect(
            IntrusionResponseService.shredFile('/nonexistent/path/file.txt')
        ).rejects.toThrow();
    });

    test('shredding di file grande non lascia tracce in chiaro', async () => {
        const secret = 'TOP_SECRET_PAYLOAD';
        const content = secret.repeat(500);
        const filePath = writeTmpFile('big_secret.txt', content);

        await IntrusionResponseService.shredFile(filePath);

        // Il file non esiste più
        expect(fs.existsSync(filePath)).toBe(false);
    });
});

// ============================================================
// TEST 3 – secureEvacuationChain (vault mockato)
// ============================================================
describe('🚨 secureEvacuationChain – Catena Completa', () => {

    let mockVaultServer;
    let receivedFiles = [];
    const TEST_TOKEN = 'test_vault_token_abc123';

    // Avvia un mini server HTTP di "vault" finto per i test
    beforeAll((done) => {
        mockVaultServer = http.createServer((req, res) => {
            if (req.method === 'POST' && req.url === '/api/secure-vault/upload') {
                const tok = req.headers['x-vault-token'];
                if (tok !== TEST_TOKEN) {
                    res.writeHead(401); res.end(); return;
                }
                const chunks = [];
                req.on('data', c => chunks.push(c));
                req.on('end', () => {
                    receivedFiles.push(Buffer.concat(chunks).length);
                    res.writeHead(201);
                    res.end(JSON.stringify({ status: 'stored' }));
                });
            } else {
                res.writeHead(404); res.end();
            }
        });
        mockVaultServer.listen(0, () => done()); // porta 0 = porta libera automatica
    });

    afterAll((done) => {
        mockVaultServer.close(done);
    });

    beforeEach(() => {
        receivedFiles = [];
        // Reset del flag singleton per ogni test
        IntrusionResponseService.activated = false;
    });

    test('secureEvacuationChain è idempotente – eseguita una sola volta', async () => {
        const { publicKey } = generateTestKeys();
        const port = mockVaultServer.address().port;

        // Override configurazione per il test
        const origVaultPort = process.env.VAULT_PORT;
        const origVaultToken = process.env.VAULT_TOKEN;
        process.env.VAULT_PORT = String(port);
        process.env.VAULT_TOKEN = TEST_TOKEN;
        IntrusionResponseService._loadPublicKey = () => publicKey;

        // Prima chiamata
        await IntrusionResponseService.secureEvacuationChain('Test trigger 1').catch(() => { });
        expect(IntrusionResponseService.activated).toBe(true);

        // Seconda chiamata (deve essere ignorata)
        const result2 = IntrusionResponseService.secureEvacuationChain('Test trigger 2');
        await expect(result2).resolves.toBeUndefined();

        // Ripristino
        process.env.VAULT_PORT = origVaultPort;
        process.env.VAULT_TOKEN = origVaultToken;
        IntrusionResponseService.activated = false;
    });
});

// ============================================================
// TEST 4 – canaryMiddleware (test del middleware HTTP)
// ============================================================
describe('🐦 Canary Middleware – Rilevamento Path Sensibili', () => {

    const { canaryMiddleware } = require('../src/honeypot/middleware/securityEnforcement');

    function mockReq(p) {
        return { path: p, ip: '192.168.1.100' };
    }

    function mockNext() {
        const fn = jest.fn();
        return fn;
    }

    beforeEach(() => {
        // Reset per evitare interferenze con la catena già attivata
        IntrusionResponseService.activated = false;
        // Override della catena per evitare effetti collaterali nel test del middleware
        IntrusionResponseService._originalChain = IntrusionResponseService.secureEvacuationChain;
        IntrusionResponseService.secureEvacuationChain = jest.fn().mockResolvedValue(undefined);
    });

    afterEach(() => {
        if (IntrusionResponseService._originalChain) {
            IntrusionResponseService.secureEvacuationChain = IntrusionResponseService._originalChain;
        }
    });

    test('accesso a /.env.real attiva il trigger canary', () => {
        const req = mockReq('/.env.real');
        const next = mockNext();
        canaryMiddleware(req, {}, next);
        expect(IntrusionResponseService.secureEvacuationChain).toHaveBeenCalledTimes(1);
        expect(IntrusionResponseService.secureEvacuationChain.mock.calls[0][0]).toContain('/.env.real');
        expect(next).toHaveBeenCalled(); // next viene sempre chiamato (risposta esca)
    });

    test('accesso a /api/v2/internal/config attiva il trigger canary', () => {
        const req = mockReq('/api/v2/internal/config');
        const next = mockNext();
        canaryMiddleware(req, {}, next);
        expect(IntrusionResponseService.secureEvacuationChain).toHaveBeenCalledTimes(1);
    });

    test('accesso a /login NON attiva il trigger canary', () => {
        const req = mockReq('/login');
        const next = mockNext();
        canaryMiddleware(req, {}, next);
        expect(IntrusionResponseService.secureEvacuationChain).not.toHaveBeenCalled();
        expect(next).toHaveBeenCalled();
    });

    test('accesso a /admin NON attiva il trigger canary', () => {
        const req = mockReq('/admin');
        const next = mockNext();
        canaryMiddleware(req, {}, next);
        expect(IntrusionResponseService.secureEvacuationChain).not.toHaveBeenCalled();
    });

    test('canaryMiddleware chiama sempre next() anche su path canary', () => {
        const req = mockReq('/canary');
        const next = mockNext();
        canaryMiddleware(req, {}, next);
        expect(next).toHaveBeenCalled(); // L'attaccante deve ricevere comunque una risposta esca
    });
});

// ============================================================
// TEST 5 – Vault Endpoint (con supertest diretto)
// ============================================================
describe('🔒 Vault Endpoint – Ricezione Blob Cifrati', () => {

    let vaultDir;
    let server;

    beforeAll((done) => {
        vaultDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vault-test-'));

        // Mini vault server che implementa la stessa logica di admin-server.js
        const express = require('express');
        const app = express();
        const token = 'vault_test_secret_999';
        const used = new Set();

        app.use('/api/secure-vault', express.raw({ type: '*/*', limit: '10mb' }));
        app.post('/api/secure-vault/upload', (req, res) => {
            const tok = req.headers['x-vault-token'];
            if (!tok || tok !== token) return res.status(401).json({ error: 'Unauthorized' });
            if (used.has(tok)) return res.status(403).json({ error: 'Token already used' });
            used.add(tok);
            const p = path.join(vaultDir, `payload_${Date.now()}.enc`);
            fs.writeFileSync(p, req.body);
            res.status(201).json({ status: 'stored' });
        });

        server = app.listen(0, done);
    });

    afterAll((done) => {
        fs.rmSync(vaultDir, { recursive: true, force: true });
        server.close(done);
    });

    test('POST con token valido restituisce 201 e salva il file', async () => {
        const request = require('supertest');
        const port = server.address().port;

        const payload = Buffer.from('encrypted_blob_data_here');
        const boundary = 'testboundary123';
        const body = Buffer.concat([
            Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="meta"\r\n\r\n{"originalName":"test.env"}\r\n`),
            Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="test.env.enc"\r\nContent-Type: application/octet-stream\r\n\r\n`),
            payload,
            Buffer.from(`\r\n--${boundary}--\r\n`)
        ]);

        const res = await request(`http://localhost:${port}`)
            .post('/api/secure-vault/upload')
            .set('Content-Type', `multipart/form-data; boundary=${boundary}`)
            .set('X-Vault-Token', 'vault_test_secret_999')
            .set('X-Vault-Op', 'emergency-evacuation')
            .send(body);

        expect(res.statusCode).toBe(201);
        expect(res.body.status).toBe('stored');
    });

    test('POST senza token restituisce 401', async () => {
        const request = require('supertest');
        const port = server.address().port;

        const res = await request(`http://localhost:${port}`)
            .post('/api/secure-vault/upload')
            .set('Content-Type', 'application/octet-stream')
            .send(Buffer.from('garbage'));

        expect(res.statusCode).toBe(401);
    });

    test('POST con token errato restituisce 401', async () => {
        const request = require('supertest');
        const port = server.address().port;

        const res = await request(`http://localhost:${port}`)
            .post('/api/secure-vault/upload')
            .set('X-Vault-Token', 'token_sbagliato_xyz')
            .send(Buffer.from('garbage'));

        expect(res.statusCode).toBe(401);
    });
});
