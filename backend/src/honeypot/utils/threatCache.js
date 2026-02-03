const { Op } = require('sequelize');
const storageAdapter = require('./storageAdapter');

/**
 * ThreatCache - Behavioral Metrics Store
 * Now uses StorageAdapter for horizontal scalability.
 */
class ThreatCache {
    constructor() {
        this.MAX_WINDOW_MS = 300000; // 5 minutes 
        this.isHydrated = false;

        // Background cleanup 
        setInterval(() => storageAdapter.cleanup(this.MAX_WINDOW_MS), 60000);
    }

    /**
     * Hydrate cache from DB on startup
     */
    async hydrate() {
        if (this.isHydrated) return;

        try {
            const Log = require('../../models/Log');
            const cutoff = new Date(Date.now() - this.MAX_WINDOW_MS);

            console.log('🔄 [ThreatCache] Hydrating behavioral state from DB...');

            const recentLogs = await Log.findAll({
                where: { timestamp: { [Op.gte]: cutoff } },
                attributes: ['sessionKey', 'timestamp', 'path', 'method', 'statusCode'],
                raw: true
            });

            for (const log of recentLogs) {
                const ts = log.timestamp.getTime();
                const key = log.sessionKey;

                // Track through adapter
                await storageAdapter.addEvent(`req:${key}`, ts, this.MAX_WINDOW_MS);

                if (log.method === 'POST' && (log.path === '/login' || log.path === '/wp-login.php')) {
                    await storageAdapter.addEvent(`login:${key}`, ts, this.MAX_WINDOW_MS);
                }

                if (log.statusCode === 404) {
                    await storageAdapter.addEvent(`404:${key}`, ts, this.MAX_WINDOW_MS);
                }
            }

            this.isHydrated = true;
            console.log(`✅ [ThreatCache] Hydration complete. Processed ${recentLogs.length} events.`);
        } catch (err) {
            console.error('❌ [ThreatCache] Hydration failed:', err.message);
        }
    }

    async trackRequest(sessionKey) {
        await storageAdapter.addEvent(`req:${sessionKey}`, Date.now(), this.MAX_WINDOW_MS);
    }

    async trackLogin(sessionKey) {
        await storageAdapter.addEvent(`login:${sessionKey}`, Date.now(), this.MAX_WINDOW_MS);
    }

    async track404(sessionKey) {
        await storageAdapter.addEvent(`404:${sessionKey}`, Date.now(), this.MAX_WINDOW_MS);
    }

    async getRequestCount(sessionKey, windowMs) {
        return await storageAdapter.getRecentRequestCount(`req:${sessionKey}`, windowMs);
    }

    async getLoginCount(sessionKey, windowMs) {
        return await storageAdapter.getRecentRequestCount(`login:${sessionKey}`, windowMs);
    }

    async get404Count(sessionKey, windowMs) {
        return await storageAdapter.getRecentRequestCount(`404:${sessionKey}`, windowMs);
    }
}

module.exports = new ThreatCache();
