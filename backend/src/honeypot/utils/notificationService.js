const EventEmitter = require('events');

class NotificationService extends EventEmitter {
    constructor() {
        super();
        this.clients = new Set();

        // Heartbeat per mantenere vive le connessioni SSE
        setInterval(() => this.sendHeartbeat(), 30000);
    }

    sendHeartbeat() {
        if (this.clients.size === 0) return;
        this.clients.forEach(client => {
            client.write(': heartbeat\n\n');
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
}

// Singleton instance
module.exports = new NotificationService();
