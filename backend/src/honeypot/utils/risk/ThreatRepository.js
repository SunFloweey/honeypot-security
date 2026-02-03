const Classification = require('../../../models/Classification');
const notificationService = require('../notificationService');

class ThreatRepository {
    /**
     * Persists classifications to the database.
     * @param {Array} classifications 
     */
    static async saveClassifications(classifications) {
        if (classifications.length > 0) {
            await Classification.bulkCreate(classifications);
        }
    }

    /**
     * Updates the session risk score and triggers alerts if necessary.
     * @param {Object} session - Sequalize session instance
     * @param {Array} classifications - New classifications found
     */
    static async updateSessionRisk(session, classifications) {
        if (!classifications || classifications.length === 0) return;

        let addedRisk = 0;
        classifications.forEach(c => {
            addedRisk += c.riskScore;
        });

        // Calculate new total (clamped at 100)
        const oldTotal = session.maxRiskScore || 0;
        const newTotal = Math.min(100, oldTotal + addedRisk);

        await session.update({ maxRiskScore: newTotal });

        // Trigger Alert if crossing threshold
        if (newTotal >= 80 && oldTotal < 80) {
            notificationService.sendCriticalAlert({
                ipAddress: session.ipAddress,
                sessionKey: session.sessionKey,
                riskScore: newTotal,
                message: `Critical Risk Detected: ${session.ipAddress} (Score: ${newTotal})`
            });
        }
    }
}

module.exports = ThreatRepository;
