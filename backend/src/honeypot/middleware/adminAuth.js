const AuthHelper = require('../utils/authHelper');
const rateLimit = require('express-rate-limit');
const ticketService = require('../utils/ticketService');

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
    // Skippa il rate limit se il token è valido o se c'è un ticket valido (SSE)
    skip: (req) => {
        const token = req.headers['x-admin-token'] || req.query.token;
        if (AuthHelper.isTokenValid(token, ADMIN_TOKEN)) return true;

        // Se è una rotta stream con ticket, verifichiamo il ticket (senza consumarlo qui!)
        // In realtà adminAuthMiddleware lo validerà dopo, quindi qui possiamo essere permissivi
        // se la rotta è quella dello stream, per evitare lockout da riconnessione
        return req.path.includes('/stream');
    }
});

const jwt = require('jsonwebtoken');

function adminAuthMiddleware(req, res, next) {
    const headerToken = req.headers['x-admin-token'];
    const bearerToken = req.headers.authorization;
    const queryToken = req.query.token;

    // 1. Check for Security Ticket (High Priority for SSE)
    if (req.path.includes('/stream') && queryToken) {
        if (ticketService.validateTicket(queryToken)) {
            console.log(`📡 [Security] SSE connection authorized via Ticket from ${req.ip}`);
            return next();
        }
    }

    // 2. Check for SaaS JWT
    if (bearerToken && bearerToken.startsWith('Bearer ')) {
        const token = bearerToken.split(' ')[1];
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET || process.env.ADMIN_TOKEN);
            req.user = decoded; // Attach user info (userId, email, role)
            return next();
        } catch (err) {
            console.warn(`[SECURITY] Invalid SaaS JWT from ${req.ip}:`, err.message);
            // Fallthrough to admin token if JWT fails? No, better 401 if they sent a Bearer header
            return res.status(401).json({ error: 'Unauthorized: Token non valido' });
        }
    }

    // 3. Standard Token Validation (Legacy Admin Mode)
    const token = headerToken || queryToken;

    if (!AuthHelper.isTokenValid(token, ADMIN_TOKEN)) {
        console.warn(`[SECURITY] Unauthorized access attempt: Invalid or missing token/JWT from ${req.ip} for ${req.originalUrl}`);
        return res.status(401).json({ error: 'Unauthorized' });
    }

    // 4. Global Admin Context (Full Access)
    req.user = { role: 'admin', isGlobal: true };

    // Security Audit: Warn if ADMIN_TOKEN is used in Query Param for non-stream routes
    if (queryToken && !req.path.includes('/stream')) {
        console.warn(`⚠️ [SECURITY WARNING] ADMIN_TOKEN exposed in URL query parameters from ${req.ip}. Update frontend to use Headers.`);
    }

    // Per richieste SSE, non loggare eccessivamente se è solo un ping
    if (!req.originalUrl.includes('/stream')) {
        console.log(`✅ Admin Auth: Verified request from ${req.ip} for ${req.originalUrl}`);
    }

    next();
}

module.exports = { adminAuthMiddleware, adminRateLimiter };
