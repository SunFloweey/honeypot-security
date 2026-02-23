const RiskEngine = require('./risk/RiskEngine');
const BehaviorAnalyzer = require('./risk/BehaviorAnalyzer');
const ThreatRepository = require('./risk/ThreatRepository');

/**
 * Classifier Facade
 * Orchestrates threat detection by combining Static Rules (RiskEngine),
 * Behavioral Analysis (BehaviorAnalyzer), and Persistence (ThreatRepository).
 */
class Classifier {
    /**
     * Esegue la classificazione completa di un log
     */
    static async classify(req, logRecord, session) {
        // 1. Track Metrics (Side Effect)
        await BehaviorAnalyzer.track(req, logRecord);

        // 2. Static Analysis (Regex) - CPU Bound
        const staticClassifications = RiskEngine.analyze(req, logRecord);

        // 3. Behavioral Analysis (Stateful) - IO Bound
        const behaviorClassifications = await BehaviorAnalyzer.analyze(req, logRecord);

        // 4. Honeytoken Detection (Intelligence)
        const HoneytokenService = require('../../services/honeytokenService');
        const bodyStr = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
        const checkString = `${req.path} ${bodyStr} ${JSON.stringify(req.headers)}`;
        const matchedToken = HoneytokenService.checkToken(checkString);

        const honeytokenClassifications = matchedToken ? [{
            logId: logRecord.id,
            category: 'honeytoken_used',
            riskScore: 90, // Extremely high risk - they found a bait
            patternMatched: `Utilizzato Honeytoken tracciato: ${matchedToken.type} (${matchedToken.fingerprint})`
        }] : [];

        // Combine Results
        const allClassifications = [
            ...staticClassifications,
            ...behaviorClassifications,
            ...honeytokenClassifications
        ];

        // 4. Persistence & Alerts
        if (allClassifications.length > 0) {
            // Calcola il rischio totale per questo specifico log
            const totalLogRisk = allClassifications.reduce((sum, c) => sum + c.riskScore, 0);
            const finalScore = Math.min(100, totalLogRisk); // Cap a 100

            // Persistenza sulle tabelle correlate
            await ThreatRepository.saveClassifications(allClassifications);
            await ThreatRepository.updateSessionRisk(session, allClassifications);

            // ✅ LA PARTE MANCANTE: Aggiorna fisicamente il log nel database
            await logRecord.update({
                riskScore: finalScore
            });
        }

        return allClassifications;
    }
}

module.exports = Classifier;

