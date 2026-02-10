const AuthHelper = require('../utils/authHelper');
const rateLimit = require('express-rate-limit');

/**
 * Middleware di autenticazione per la Dashboard Reale.
 * Richiede un header 'x-admin-token' corretto.
 */

// CRITICAL SECURITY: NO FALLBACK PASSWORD
// Se ADMIN_TOKEN non è settato, il server deve crashare immediatamente
const ADMIN_TOKEN = process.env.ADMIN_TOKEN;

if (!ADMIN_TOKEN) {
    console.error('');
    console.error('═══════════════════════════════════════════════════════════');
    console.error('❌ FATAL ERROR: ADMIN_TOKEN environment variable not set!');
    console.error('═══════════════════════════════════════════════════════════');
    console.error('');
    console.error('The honeypot admin dashboard requires authentication.');
    console.error('Set the ADMIN_TOKEN in your .env file:');
    console.error('');
    console.error('  ADMIN_TOKEN=your-secure-random-token-here');
    console.error('');
    console.error('Generate a secure token:');
    console.error('  node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
    console.error('');
    console.error('═══════════════════════════════════════════════════════════');
    console.error('');
    process.exit(1); // CRASH: meglio crash che security breach!
}

// STRICT RATE LIMITING per prevenire brute force del token
const adminRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minuti
    max: 100, // Alzato a 100 per permettere l'uso normale della dashboard
    message: { error: 'Too many requests. Try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
    // Skippa il rate limit se il token è già valido (supporta sia Header che Query per SSE)
    skip: (req) => {
        const token = req.headers['x-admin-token'] || req.query.token;
        return AuthHelper.isTokenValid(token, ADMIN_TOKEN);
    }
});

function adminAuthMiddleware(req, res, next) {
    // Suppota sia Header (standard API) che Query Parameter (necessario per EventSource/SSE)
    const token = req.headers['x-admin-token'] || req.query.token;

    if (!AuthHelper.isTokenValid(token, ADMIN_TOKEN)) {
        console.warn(`[SECURITY] Unauthorized access attempt: Invalid or missing token from ${req.ip} for ${req.originalUrl}`);
        return res.status(401).json({ error: 'Unauthorized' });
    }

    // Per richieste SSE, non loggare eccessivamente se è solo un ping
    if (!req.originalUrl.includes('/stream')) {
        console.log(`✅ Admin Auth: Verified request from ${req.ip} for ${req.originalUrl}`);
    }

    next();
}

module.exports = { adminAuthMiddleware, adminRateLimiter };
