const EventEmitter = require('events');
const axios = require('axios');

class NotificationService extends EventEmitter {
    constructor() {
        super();
        this.clients = new Map(); // Use Map to store metadata along with res
        this.isAdminServer = process.env.ADMIN_PORT && process.env.PORT == process.env.ADMIN_PORT;

        // Admin URL for forwarding (Using Docker Service Name)
        this.adminNotifyUrl = `http://admin:${process.env.ADMIN_PORT || 4003}/api/internal/notify`;

        // Heartbeat only on Admin Server
        if (this.isAdminServer) {
            setInterval(() => this.sendHeartbeat(), 15000);
        }
    }

    /**
     * Internal method to broadcast or forward events
     * @param {string} type - Event type
     * @param {Object} data - Event data (can include targetUserId or targetTenantId for filtering)
     */
    async _handleEvent(type, data) {
        const payload = {
            timestamp: new Date().toISOString(),
            type,
            ...data
        };

        const targetUserId = data.targetUserId;
        const targetTenantId = data.targetTenantId; // Future use

        // 1. If we are the Admin Server, broadcast to connected SSE clients
        if (this.clients.size > 0) {
            let sentCount = 0;
            const message = `data: ${JSON.stringify(payload)}\n\n`;
            
            this.clients.forEach((metadata, client) => {
                // FILTERING LOGIC:
                // - Global Admin sees EVERYTHING
                // - User only sees events targeted to them
                // - If no target is specified, it might be a system-wide event (rare)
                const isAuthorized = metadata.isGlobal || 
                                   (targetUserId && metadata.userId === targetUserId);

                if (isAuthorized) {
                    try {
                        client.write(message);
                        sentCount++;
                    } catch (e) {
                        console.error(`❌ [NotificationService] Failed to write to client, removing...`);
                        this.removeClient(client);
                    }
                }
            });

            if (sentCount > 0) {
                console.log(`📡 [NotificationService] Sent ${type} to ${sentCount} authorized clients`);
            }
        } else if (this.isAdminServer) {
            console.log(`📡 [NotificationService] Got ${type} but no clients connected.`);
        }

        // 2. If we are the Honeypot, forward to Admin Server via HTTP
        if (!this.isAdminServer) {
            console.log(`📡 [NotificationService] Forwarding ${type} to Admin Server...`);
            try {
                // Forward silently in background
                axios.post(this.adminNotifyUrl, payload, {
                    headers: {
                        'x-internal-secret': process.env.ADMIN_TOKEN,
                        'x-admin-token': process.env.ADMIN_TOKEN
                    }
                }).then(res => {
                    console.log(`✅ [NotificationService] Forwarded ${type} successfully (Status: ${res.status})`);
                }).catch(err => {
                    console.error(`❌ [NotificationService] Failed to forward ${type}: ${err.message}`);
                });
            } catch (e) {
                console.error(`❌ [NotificationService] Axios error: ${e.message}`);
            }
        }
    }

    sendHeartbeat() {
        if (this.clients.size === 0) return;
        this.clients.forEach((metadata, client) => {
            try {
                client.write(': heartbeat\n\n');
            } catch (err) {
                this.removeClient(client);
            }
        });
    }

    addClient(res, metadata = {}) {
        this.clients.set(res, metadata);
        console.log(`📡 [NotificationService] Admin client connected (User: ${metadata.userId || 'anon'}, Global: ${metadata.isGlobal}). Total: ${this.clients.size}`);
    }

    removeClient(res) {
        this.clients.delete(res);
    }

    notifyLogBatch(count, targetUserId = null) {
        this._handleEvent('LOG_BATCH', { count, targetUserId });
    }

    sendCriticalAlert(alertData) {
        // targetUserId can be extracted from alertData if present (from ApiKey link)
        this._handleEvent('CRITICAL_RISK', alertData);
        console.log(`🚨 [NotificationService] Alert: Risk ${alertData.riskScore} from ${alertData.ipAddress}`);
    }

    notifyTerminalActivity(sessionKey, command, targetUserId = null) {
        this._handleEvent('TERMINAL_ACTIVITY', {
            sessionKey,
            command: command.substring(0, 50) + (command.length > 50 ? '...' : ''),
            targetUserId
        });
    }

    notifyThreatAnalysis(analysisData, targetUserId = null) {
        if (!analysisData) return;
        this._handleEvent('THREAT_SYNTHESIS', { ...analysisData, targetUserId });
    }
}

module.exports = new NotificationService();
