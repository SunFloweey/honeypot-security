const EventEmitter = require('events');

class NotificationService extends EventEmitter {
    constructor() {
        super();
        this.clients = new Set();

        // Heartbeat per mantenere vive le connessioni SSE (ridotto a 15s per stabilità proxy)
        setInterval(() => this.sendHeartbeat(), 15000);
    }

    sendHeartbeat() {
        if (this.clients.size === 0) return;
        this.clients.forEach(client => {
            try {
                client.write(': heartbeat\n\n');
            } catch (err) {
                console.warn('⚠️ [NotificationService] Failed to send heartbeat, removing stale client');
                this.removeClient(client);
            }
        });
    }

    /**
     * Aggiunge un client (response object) alla lista delle connessioni attive
     */
    addClient(res) {
        this.clients.add(res);
        console.log(`📡 [NotificationService] New client connected. Total: ${this.clients.size}`);
    }

    /**
     * Rimuove un client disconnesso
     */
    removeClient(res) {
        this.clients.delete(res);
        console.log(`🔕 [NotificationService] Client disconnected. Total: ${this.clients.size}`);
    }

    /**
     * Notifica i client che nuovi log sono stati salvati (Signal for Refresh)
     * @param {number} count - Numero di log salvati
     */
    notifyLogBatch(count) {
        if (this.clients.size === 0) return;

        const eventData = JSON.stringify({
            timestamp: new Date().toISOString(),
            type: 'LOG_BATCH',
            count: count
        });

        const message = `data: ${eventData}\n\n`;
        this.clients.forEach(client => client.write(message));
    }

    /**
     * Invia un alert critico a tutti i client connessi
     * @param {Object} alertData - Dati dell'alert (ip, sessionKey, riskScore, message)
     */
    sendCriticalAlert(alertData) {
        if (this.clients.size === 0) return;

        const eventData = JSON.stringify({
            timestamp: new Date().toISOString(),
            type: 'CRITICAL_RISK',
            ...alertData
        });

        // Formato standard SSE: "data: ... \n\n"
        const message = `data: ${eventData}\n\n`;

        this.clients.forEach(client => {
            client.write(message);
        });

        console.log(`🚨 [NotificationService] Sent alert to ${this.clients.size} admins: Risk ${alertData.riskScore} from ${alertData.ipAddress}`);
    }

    /**
     * Notifica i client di attività nel terminale virtuale
     */
    notifyTerminalActivity(sessionKey, command) {
        if (this.clients.size === 0) return;

        const eventData = JSON.stringify({
            timestamp: new Date().toISOString(),
            type: 'TERMINAL_ACTIVITY',
            sessionKey,
            command: command.substring(0, 50) + (command.length > 50 ? '...' : '')
        });

        const message = `data: ${eventData}\n\n`;
        this.clients.forEach(client => client.write(message));
    }

    /**
     * Broadcasts AI-synthesized threat analysis to all connected dashboards
     */
    notifyThreatAnalysis(analysisData) {
        if (this.clients.size === 0 || !analysisData) return;

        const eventData = JSON.stringify({
            timestamp: new Date().toISOString(),
            type: 'THREAT_SYNTHESIS',
            ...analysisData
        });

        const message = `data: ${eventData}\n\n`;
        this.clients.forEach(client => client.write(message));
        console.log(`📡 [NotificationService] Broadcasted Threat Synthesis: ${analysisData.intent}`);
    }
}

// Singleton instance
module.exports = new NotificationService();
