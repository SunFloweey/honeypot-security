// src/honeypot/middleware/responseDelay.js

/**
 * Simula latenza realistica per rendere l'honeypot credibile
 * Un server reale non risponde istantaneamente
 */
function responseDelayMiddleware(req, res, next) {
    // Calcola delay basato sul tipo di operazione
    const delay = calculateRealisticDelay(req);

    setTimeout(() => {
        next();
    }, delay);
}

/**
 * Calcola delay realistico basato su vari fattori
 */
function calculateRealisticDelay(req) {
    let baseDelay = 0;

    // Tipo di operazione
    switch (req.method) {
        case 'GET':
            baseDelay = 50 + Math.random() * 150; // 50-200ms
            break;
        case 'POST':
        case 'PUT':
            baseDelay = 200 + Math.random() * 300; // 200-500ms (scrittura DB)
            break;
        case 'DELETE':
            baseDelay = 150 + Math.random() * 250; // 150-400ms
            break;
        default:
            baseDelay = 100 + Math.random() * 200;
    }

    // Operazioni "pesanti" richiedono più tempo
    if (req.path.includes('/search')) {
        baseDelay += 300 + Math.random() * 500; // Query DB complessa
    }

    if (req.path.includes('/upload')) {
        baseDelay += 500 + Math.random() * 1000; // Upload file
    }

    if (req.path.includes('/login') || req.path.includes('/auth')) {
        baseDelay += 800 + Math.random() * 400; // Hash password check
    }

    if (req.path.includes('/admin')) {
        baseDelay += 200 + Math.random() * 300; // Pannello admin (più dati)
    }

    // File statici sono più veloci
    if (req.path.match(/\.(css|js|jpg|png|gif|ico)$/)) {
        baseDelay = 10 + Math.random() * 40;
    }

    // Variazione casuale per sembrare naturale (±20%)
    const variation = (Math.random() - 0.5) * 0.4;
    baseDelay = baseDelay * (1 + variation);

    // Simula occasionale spike di latenza (5% chance)
    if (Math.random() < 0.05) {
        baseDelay += 1000 + Math.random() * 2000; // Spike 1-3s
    }

    return Math.round(baseDelay);
}

/**
 * Middleware opzionale: rallenta attaccanti aggressivi
 * Se rilevi brute force, aumenta progressivamente il delay
 */
function adaptiveDelayMiddleware(req, res, next) {
    const ip = req.realIp;
    const recentRequests = getRecentRequestCount(ip, 60000); // Ultimi 60s

    let additionalDelay = 0;

    if (recentRequests > 50) {
        // Più di 50 req/min = probabilmente scanner
        additionalDelay = 2000 + Math.random() * 3000; // 2-5s extra
        console.log(`⏱️  Throttling aggressive scanner: ${ip} (${recentRequests} req/min)`);
    } else if (recentRequests > 20) {
        additionalDelay = 500 + Math.random() * 1000; // 0.5-1.5s extra
    }

    setTimeout(() => {
        next();
    }, additionalDelay);
}

// Cache in-memory per tracciare rate (semplificato)
const requestCache = new Map();

function getRecentRequestCount(ip, windowMs) {
    const now = Date.now();

    if (!requestCache.has(ip)) {
        requestCache.set(ip, []);
    }

    const requests = requestCache.get(ip);

    // Rimuovi richieste vecchie
    const recent = requests.filter(time => now - time < windowMs);

    // Aggiungi questa richiesta
    recent.push(now);

    // Aggiorna cache
    requestCache.set(ip, recent);

    // Cleanup periodico (previene memory leak)
    if (Math.random() < 0.01) { // 1% chance
        cleanupCache(windowMs * 2);
    }

    return recent.length;
}

function cleanupCache(maxAge) {
    const now = Date.now();
    for (const [ip, requests] of requestCache.entries()) {
        const recent = requests.filter(time => now - time < maxAge);
        if (recent.length === 0) {
            requestCache.delete(ip);
        } else {
            requestCache.set(ip, recent);
        }
    }
}

module.exports = {
    responseDelayMiddleware,
    adaptiveDelayMiddleware
};