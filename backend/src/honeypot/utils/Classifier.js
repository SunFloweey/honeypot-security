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

            // ✅ AGGIORNA FISICAMENTE IL LOG
            const { Log, ApiKey } = require('../../models');
            await Log.update({ riskScore: finalScore }, { where: { id: logRecord.id } });

            // 🔔 REAL-TIME NOTIFICATION per rischi critici (> 70) o Honeytoken
            if (finalScore >= 70 || honeytokenClassifications.length > 0) {
                const notificationService = require('./notificationService');
                
                // Tenta di recuperare l'userId del tenant se il log è associato a un'apiKey
                let targetUserId = null;
                if (logRecord.apiKeyId) {
                    const keyRecord = await ApiKey.findByPk(logRecord.apiKeyId);
                    if (keyRecord) targetUserId = keyRecord.userId;
                }

                notificationService.sendCriticalAlert({
                    logId: logRecord.id,
                    riskScore: finalScore,
                    ipAddress: logRecord.ipAddress,
                    path: logRecord.path,
                    category: allClassifications[0]?.category || 'high_risk',
                    targetUserId: targetUserId // Fondamentale per StreetCats!
                });
            }
        }

        return allClassifications;
    }
}

module.exports = Classifier;

