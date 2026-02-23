const path = require('path');

const STATIC_EXTENSIONS = new Set([
    '.css', '.js', '.jpg', '.jpeg', '.png', '.gif', '.ico', '.svg',
    '.woff', '.woff2', '.ttf', '.eot', '.map'
]);

const storageAdapter = require('../utils/storageAdapter');

/**
 * Simula latenza realistica per rendere l'honeypot credibile.
 * Salta il delay per le richieste amministrative della dashboard.
 */
function responseDelayMiddleware(req, res, next) {
    const isAdminApi = req.path.startsWith('/api/overview') ||
        req.path.startsWith('/api/logs') ||
        req.path.startsWith('/api/stream') ||
        req.path.startsWith('/api/ai') ||
        req.path.startsWith('/api/db-check');

    if (isAdminApi) {
        return next();
    }

    const delay = calculateRealisticDelay(req);
    setTimeout(() => next(), delay);
}

/**
 * Calcola delay realistico basato su vari fattori
 */
function calculateRealisticDelay(req) {
    let baseDelay = 0;

    switch (req.method) {
        case 'GET': baseDelay = 50 + Math.random() * 150; break;
        case 'POST':
        case 'PUT': baseDelay = 200 + Math.random() * 300; break;
        case 'DELETE': baseDelay = 150 + Math.random() * 250; break;
        default: baseDelay = 100 + Math.random() * 200;
    }

    if (req.path.includes('/search')) baseDelay += 300 + Math.random() * 500;
    if (req.path.includes('/upload')) baseDelay += 500 + Math.random() * 1000;
    if (req.path.includes('/admin')) baseDelay += 200 + Math.random() * 300;

    // Fast assets - No ReDoS
    const ext = path.extname(req.path).toLowerCase();
    if (STATIC_EXTENSIONS.has(ext)) {
        baseDelay = 10 + Math.random() * 40;
    }

    const variation = (Math.random() - 0.5) * 0.4;
    baseDelay = baseDelay * (1 + variation);

    if (Math.random() < 0.05) baseDelay += 1000 + Math.random() * 2000;

    return Math.round(baseDelay);
}

/**
 * Middleware opzionale: rallenta attaccanti aggressivi
 */
async function adaptiveDelayMiddleware(req, res, next) {
    const isAdminApi = req.path.startsWith('/api/overview') ||
        req.path.startsWith('/api/logs') ||
        req.path.startsWith('/api/stream') ||
        req.path.startsWith('/api/ai');

    if (isAdminApi) {
        return next();
    }

    const ip = req.ip || '127.0.0.1';
    const TRACKING_WINDOW = 120000; // 2 minutes

    // Log this request in the adapter
    await storageAdapter.addEvent(ip, Date.now(), TRACKING_WINDOW);

    // Get count for throttling (last 60s)
    const recentRequests = await storageAdapter.getRecentRequestCount(ip, 60000);

    let additionalDelay = 0;
    if (recentRequests > 50) {
        additionalDelay = 2000 + Math.random() * 3000;
        console.log(`⏱️  Throttling scanner: ${ip} (${recentRequests} req/min)`);
    } else if (recentRequests > 20) {
        additionalDelay = 500 + Math.random() * 1000;
    }

    if (additionalDelay > 0) setTimeout(() => next(), additionalDelay);
    else next();
}

// Background cleanup (every 60s)
setInterval(() => {
    storageAdapter.cleanup(120000);
}, 60000);

module.exports = {
    responseDelayMiddleware,
    adaptiveDelayMiddleware
};

// --- REFACTOR START ---

let cleanupInterval = null;

/**
 * Avvia il task di pulizia background
 */
function startCleanupTask() {
    if (cleanupInterval) return; // Già avviato

    // Esegui pulizia ogni 60s
    cleanupInterval = setInterval(() => {
        storageAdapter.cleanup(120000);
    }, 60000);
    // Unref permette al processo di uscire anche se il timer è attivo (opzionale ma utile)
    cleanupInterval.unref();
}

/**
 * Ferma il task (utile per testing o shutdown)
 */
function stopCleanupTask() {
    if (cleanupInterval) {
        clearInterval(cleanupInterval);
        cleanupInterval = null;
    }
}

// Avvialo automaticamente all'import se necessario, 
// oppure (MEGLIO) chiamalo nel bootstrap di server.js
startCleanupTask();

module.exports = {
    responseDelayMiddleware,
    adaptiveDelayMiddleware,
    startCleanupTask, // Esporta per controllo manuale
    stopCleanupTask
};
// --- REFACTOR END ---