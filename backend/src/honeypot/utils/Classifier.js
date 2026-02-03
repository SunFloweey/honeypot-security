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

        // Combine Results
        const allClassifications = [
            ...staticClassifications,
            ...behaviorClassifications
        ];

        // 4. Persistence & Alerts
        if (allClassifications.length > 0) {
            await ThreatRepository.saveClassifications(allClassifications);
            await ThreatRepository.updateSessionRisk(session, allClassifications);
        }

        return allClassifications;
    }
}

module.exports = Classifier;

