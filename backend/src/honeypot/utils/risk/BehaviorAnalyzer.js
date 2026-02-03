const threatCache = require('../threatCache');

class BehaviorAnalyzer {
    /**
     * Tracks the request metrics in the cache.
     * @param {Object} req 
     * @param {Object} logRecord 
     */
    static async track(req, logRecord) {
        await threatCache.trackRequest(req.sessionKey);

        if (req.method === 'POST' && (req.path === '/login' || req.path === '/wp-login.php')) {
            await threatCache.trackLogin(req.sessionKey);
        }

        if (logRecord.statusCode === 404) {
            await threatCache.track404(req.sessionKey);
        }
    }

    /**
     * Analyzes behavior patterns based on cached metrics.
     * @param {Object} req 
     * @param {Object} logRecord 
     * @returns {Array} classifications
     */
    static async analyze(req, logRecord) {
        const classifications = [];
        const ONE_MINUTE = 60 * 1000;
        const FIVE_MINUTES = 5 * 60 * 1000;

        // 1. Brute Force Detection
        if (req.method === 'POST' && (req.path === '/login' || req.path === '/wp-login.php')) {
            const recentLogins = await threatCache.getLoginCount(req.sessionKey, FIVE_MINUTES);
            if (recentLogins > 3) {
                classifications.push({
                    logId: logRecord.id,
                    category: 'brute_force',
                    riskScore: 40,
                    patternMatched: `Multipli tentativi di login (${recentLogins}) in breve tempo`
                });
            }
        }

        // 2. Automation Detection
        const recentRequests = await threatCache.getRequestCount(req.sessionKey, ONE_MINUTE);
        if (recentRequests > 15) {
            classifications.push({
                logId: logRecord.id,
                category: 'automation',
                riskScore: 30,
                patternMatched: `Alta frequenza di richieste (${recentRequests}/min)`
            });
        }

        // 3. 404 Scanning (Reconnaissance)
        if (logRecord.statusCode === 404) {
            const recent404s = await threatCache.get404Count(req.sessionKey, ONE_MINUTE);
            if (recent404s > 5) {
                classifications.push({
                    logId: logRecord.id,
                    category: 'recon_404',
                    riskScore: 35,
                    patternMatched: `Scansione aggressiva di percorsi inesistenti (${recent404s} in 1 min)`
                });
            }
        }

        return classifications;
    }
}

module.exports = BehaviorAnalyzer;
