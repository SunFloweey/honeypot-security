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
        // Troviamo se c'è un attacco "esplosivo" tra i nuovi log
        let hasImmediateThreat = classifications.some(c => c.riskScore >= 50);

        classifications.forEach(c => { addedRisk += c.riskScore; });

        const oldTotal = session.maxRiskScore || 0;
        const newTotal = Math.min(100, oldTotal + addedRisk);

        await session.update({ maxRiskScore: newTotal });

        // LOGICA MIGLIORATA:
        // 1. Scatta se superi 80 per la prima volta
        // 2. OPPURE se il rischio era già alto ma è arrivato un attacco molto grave (immediate threat)
        if ((newTotal >= 80 && oldTotal < 80) || (oldTotal >= 80 && hasImmediateThreat)) {
            notificationService.sendCriticalAlert({
                ipAddress: session.ipAddress,
                sessionKey: session.sessionKey,
                riskScore: newTotal,
                message: `⚠️ SECURITY ALERT: IP ${session.ipAddress} raggiunto livello critico (${newTotal}/100)`
            });
        }
    }
}

module.exports = ThreatRepository;
