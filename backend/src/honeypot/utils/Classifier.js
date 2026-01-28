const Log = require('../../models/Log');
const Classification = require('../../models/Classification');
const threatCache = require('./threatCache');
const rulesData = require('../../data/rules.json');

class Classifier {
    /**
     * Esegue la classificazione completa di un log
     */
    static async classify(req, logRecord, session) {
        const classifications = [];

        // 0. Update Threat Cache (In-Memory Tracking)
        threatCache.trackRequest(req.sessionKey);

        if (req.method === 'POST' && (req.path === '/login' || req.path === '/wp-login.php')) {
            threatCache.trackLogin(req.sessionKey);
        }

        if (logRecord.statusCode === 404) {
            threatCache.track404(req.sessionKey);
        }

        // 1. Regole Statiche (Regex) con Decoding
        // Decode URI component per catchare bypass semplici (es. %27 invece di ')
        let decodedPath = req.originalUrl;
        let decodedBody = JSON.stringify(req.body);
        try {
            decodedPath = decodeURIComponent(req.originalUrl);
        } catch (e) { /* ignore malformed URI */ }

        const checkString = `${decodedPath} ${decodedBody}`.toLowerCase();

        // Load and hydrate rules from JSON
        const staticRules = rulesData.map(r => ({
            ...r,
            pattern: new RegExp(r.pattern, r.flags)
        }));

        for (const rule of staticRules) {
            if (rule.pattern.test(checkString)) {
                classifications.push({
                    logId: logRecord.id,
                    category: rule.category,
                    riskScore: rule.score,
                    patternMatched: rule.msg
                });
            }
        }

        // 2. Analisi Comportamentale (Stateful via Cache)

        // Brute Force Detection (POST /login ripetuti)
        const ONE_MINUTE = 60 * 1000;
        const FIVE_MINUTES = 5 * 60 * 1000;

        if (req.method === 'POST' && (req.path === '/login' || req.path === '/wp-login.php')) {
            // Check cache instead of DB
            const recentLogins = threatCache.getLoginCount(req.sessionKey, FIVE_MINUTES);

            if (recentLogins > 3) {
                classifications.push({
                    logId: logRecord.id,
                    category: 'brute_force',
                    riskScore: 40,
                    patternMatched: `Multipli tentativi di login (${recentLogins}) in breve tempo`
                });
            }
        }

        // Automation Detection (Alta frequenza)
        const recentRequests = threatCache.getRequestCount(req.sessionKey, ONE_MINUTE);

        if (recentRequests > 15) {
            classifications.push({
                logId: logRecord.id,
                category: 'automation',
                riskScore: 30,
                patternMatched: `Alta frequenza di richieste (${recentRequests}/min)`
            });
        }

        // 404 Scanning (Reconnaissance)
        if (logRecord.statusCode === 404) {
            const recent404s = threatCache.get404Count(req.sessionKey, ONE_MINUTE);

            if (recent404s > 5) {
                classifications.push({
                    logId: logRecord.id,
                    category: 'recon_404',
                    riskScore: 35,
                    patternMatched: `Scansione aggressiva di percorsi inesistenti (${recent404s} in 1 min)`
                });
            }
        }

        // Salvataggio nel DB
        if (classifications.length > 0) {
            await Classification.bulkCreate(classifications);

            // Calcolo Risk Score Totale della Sessione (Somma pesata, clamp 0-100)
            await this.updateSessionRisk(session, classifications);
        }

        return classifications;
    }

    /**
     * Aggiorna il punteggio di rischio della sessione
     */
    static async updateSessionRisk(session, newClassifications) {
        let addedRisk = 0;
        newClassifications.forEach(c => {
            addedRisk += c.riskScore;
        });

        const newTotal = Math.min(100, (session.maxRiskScore || 0) + addedRisk);
        await session.update({ maxRiskScore: newTotal });
    }
}

module.exports = Classifier;

