const DecoyService = require('../../services/decoyService');

/**
 * Middleware che intercetta richieste a percorsi sensibili 
 * e genera risposte AI dinamiche invece di un semplice 404.
 */
async function adaptiveDecoyMiddleware(req, res, next) {
    const path = req.path;

    // Controlla se il percorso merita un'esca AI
    if (DecoyService.isBaitWorthy(path)) {
        console.log(`🎯 [Adaptive Decoy] Attacker matched bait path: ${path}. Invoking AI...`);

        const decoyContent = await DecoyService.generateDynamicDecoy(path, req.method, req.headers);

        if (decoyContent) {
            // Determina il Content-Type base
            let contentType = 'text/plain';
            if (path.endsWith('.php')) contentType = 'application/x-httpd-php';
            if (path.endsWith('.sql')) contentType = 'application/sql';
            if (path.endsWith('.json')) contentType = 'application/json';
            if (path.endsWith('.env')) contentType = 'text/plain';

            res.setHeader('Content-Type', contentType);
            res.setHeader('X-Powered-By', 'PHP/7.2.34'); // Camouflage
            return res.send(decoyContent);
        }
    }

    // Se non è un'esca o l'AI fallisce, continua al prossimo (404 standard)
    next();
}

module.exports = { adaptiveDecoyMiddleware };
