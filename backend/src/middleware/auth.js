/**
 * DIANA Authentication Middleware
 * Gestisce l'autenticazione API per il terminale reale
 */

// Reindirizziamo al middleware di autenticazione esistente
const { adminAuthMiddleware } = require('../honeypot/middleware/adminAuth');

// Adattiamo il nome per compatibilità
const authenticateApiKey = adminAuthMiddleware;

module.exports = {
    authenticateApiKey
};
