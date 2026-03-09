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
    /*static async updateSessionRisk(session, classifications) {
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
    }*/
    static async updateSessionRisk(session, classifications) {
        if (!classifications || classifications.length === 0) return;

        // 1. Calcoliamo il rischio aggiunto
        let addedRisk = 0;
        classifications.forEach(c => {
            addedRisk += c.riskScore;
        });

        const oldTotal = session.maxRiskScore || 0;
        // 2. Applichiamo il Clamp 0-100 per singola sessione
        const newTotal = Math.min(100, oldTotal + addedRisk);

        if (typeof session.update === 'function') {
            await session.update({ maxRiskScore: newTotal });
        } else {
            const Session = require('../../../models/Session');
            await Session.update({ maxRiskScore: newTotal }, { where: { sessionKey: session.sessionKey } });
        }

        // 3. Calcola risk score AGGREGATO per IP (somma di tutte le sessioni dello stesso IP)
        const Session = require('../../../models/Session');

        let ipAddress = session.ipAddress;
        if (!ipAddress) {
            // Fallback: se ipAddress manca su session, cerchiamo di recuperarlo dal DB tramite sessionKey
            const fullSession = await Session.findByPk(session.sessionKey, { attributes: ['ipAddress'] });
            ipAddress = fullSession?.ipAddress;
        }

        if (!ipAddress) {
            console.warn(`⚠️ [ThreatRepository] Could not determine IP address for session ${session.sessionKey}. Skipping aggregated risk.`);
            return;
        }

        const allSessionsForIP = await Session.findAll({
            where: { ipAddress: ipAddress },
            attributes: ['maxRiskScore']
        });

        const ipTotalRisk = allSessionsForIP.reduce(
            (sum, s) => sum + (s.maxRiskScore || 0),
            0
        );

        // 4. Logica di notifica:
        // Scatena l'alert se la somma degli score (sessione o IP totale) raggiunge 80/100
        const isHeavyAttack = classifications.some(c => c.riskScore >= 50);
        const sessionReachedThreshold = (newTotal >= 80 && oldTotal < 80);
        const ipReachedThreshold = (ipTotalRisk >= 80 && (ipTotalRisk - addedRisk) < 80);
        const heavyOnCritical = (oldTotal >= 80 && isHeavyAttack);

        if (sessionReachedThreshold || ipReachedThreshold || heavyOnCritical) {
            notificationService.sendCriticalAlert({
                ipAddress: ipAddress,
                sessionKey: session.sessionKey,
                riskScore: newTotal,
                ipTotalRisk: ipTotalRisk,
                message: ipReachedThreshold && !sessionReachedThreshold
                    ? `🚨 IP CRITICO: ${ipAddress} ha raggiunto ${ipTotalRisk}/100 totali (somma sessioni)`
                    : `🚨 Soglia Critica: ${newTotal}/100 - Rilevato: ${classifications[0].category}`
            });
        }
    }
}

module.exports = ThreatRepository;
