const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Percorsi per le chiavi
const publicKeyPath = path.resolve(__dirname, '../src/config/keys/public_key.pem');
const privateKeyDir = path.resolve(__dirname, '../../secure_vault_keys');
const privateKeyPath = path.join(privateKeyDir, 'private_key.pem');

// Creazione directory se non esistono
const pubDir = path.dirname(publicKeyPath);
if (!fs.existsSync(pubDir)) {
    fs.mkdirSync(pubDir, { recursive: true });
}
if (!fs.existsSync(privateKeyDir)) {
    fs.mkdirSync(privateKeyDir, { recursive: true });
}

console.log('🛡️  Generazione della coppia di chiavi RSA-4096 in corso...');
console.log('Questa operazione potrebbe richiedere alcuni secondi.');

const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 4096,
    publicKeyEncoding: {
        type: 'spki',
        format: 'pem'
    },
    privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem'
    }
});

fs.writeFileSync(publicKeyPath, publicKey);
console.log(`✅ Chiave Pubblica salvata in: ${publicKeyPath}`);
console.log('   (Questa chiave rimarrà sul server honeypot per cifrare i dati)');

fs.writeFileSync(privateKeyPath, privateKey);
// Imposta i permessi per renderlo accessibile solo al proprietario
fs.chmodSync(privateKeyPath, 0o600);
console.log(`✅ Chiave Privata salvata in: ${privateKeyPath}`);
console.log('   (ATTENZIONE: Questa chiave NON deve trovarsi sul server honeypot compromesso!)');
console.log('   (Usa questa chiave offline o nella tua sandbox sicura per decifrare i dati)');
