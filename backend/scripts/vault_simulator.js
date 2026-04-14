const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 4003;
const UPLOAD_DIR = path.resolve(__dirname, '../../vault_storage');

if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR);

const server = http.createServer((req, res) => {
    console.log(`📩 [Vault] Ricevuta richiesta: ${req.method} ${req.url}`);
    
    if (req.url === '/api/secure-vault/upload' && req.method === 'POST') {
        let body = [];
        req.on('data', (chunk) => body.push(chunk));
        req.on('end', () => {
            const data = Buffer.concat(body);
            const timestamp = Date.now();
            const filename = `encrypted_data_${timestamp}.bin`;
            
            fs.writeFileSync(path.join(UPLOAD_DIR, filename), data);
            console.log(`✅ [Vault] File salvato con successo: ${filename} (${data.length} bytes)`);
            
            res.writeHead(201);
            res.end('OK');
        });
    } else {
        res.writeHead(404);
        res.end();
    }
});

server.listen(PORT, () => {
    console.log(`🏦 [Vault Simulator] In ascolto su porta ${PORT}...`);
    console.log(`📂 I file ricevuti saranno salvati in: ${UPLOAD_DIR}`);
});
