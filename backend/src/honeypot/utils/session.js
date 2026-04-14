const crypto = require('crypto');

// Segreto per "salare" l'hash e renderlo unico per questa istanza honeypot
const SESSION_SALT = process.env.SESSION_SALT;

if (!SESSION_SALT) {
    console.error('❌ FATAL ERROR: SESSION_SALT environment variable not set!');
    console.error('This is critical for anonymizing session keys securely.');
    process.exit(1);
}

/**
 * Genera session_key univoca per l'attaccante o l'utente.
 * Logica: Hash(IP + UserAgent + Salt + optional UserId)
 * 
 * @param {string} ip - Indirizzo IP reale
 * @param {string} ua - Stringa User-Agent
 * @param {string} [userId] - ID utente (per isolamento admin/client)
 * @returns {string} - Hash hex SHA256 (primi 32 caratteri)
 */
function generateSessionKey(ip, ua, userId = '') {
    return crypto
        .createHash('sha256')
        .update(`${ip}${ua}${userId}${SESSION_SALT}`)
        .digest('hex')
        .substring(0, 32);
}

module.exports = { generateSessionKey };
