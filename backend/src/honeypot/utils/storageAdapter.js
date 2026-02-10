const redisClient = require('../../config/redis');

/**
 * StorageAdapter - Abstracted storage for IP tracking and behavioral analysis
 * Supports in-memory (default) or Redis (horizontal scalability).
 */
class StorageAdapter {
    constructor() {
        this.type = process.env.STORAGE_TYPE === 'redis' && redisClient ? 'redis' : 'memory';
        this.cache = new Map();
        this.MAX_ENTRIES = 10000; // Track up to 10k unique keys (memory strategy only)

        console.log(`📦 StorageAdapter: Initialized with ${this.type.toUpperCase()} strategy`);
    }

    /**
     * Get count of events within a specific time window
     * @param {string} key 
     * @param {number} windowMs 
     * @returns {Promise<number>}
     */
    async getRecentRequestCount(key, windowMs) {
        if (this.type === 'redis' && redisClient.isOpen) {
            const now = Date.now();
            const min = now - windowMs;
            // Redis ZCOUNT: occurrences between [min, now]
            return await redisClient.zCount(key, min, now);
        }

        // Memory Fallback
        const now = Date.now();
        if (!this.cache.has(key)) return 0;

        const timestamps = this.cache.get(key);
        let count = 0;
        for (let i = timestamps.length - 1; i >= 0; i--) {
            if (now - timestamps[i] <= windowMs) count++;
            else break;
        }
        return count;
    }

    /**
     * Record a new event
     * @param {string} key 
     * @param {number} timestamp 
     * @param {number} maxAge Optional age limit to keep state small
     */
    async addEvent(key, timestamp = Date.now(), maxAge = null) {
        if (this.type === 'redis' && redisClient.isOpen) {
            // Redis Sorted Set: key = IP/Session, value = timestamp, score = timestamp
            await redisClient.zAdd(key, { score: timestamp, value: timestamp.toString() + Math.random() });

            if (maxAge) {
                // Auto-cleanup old entries for this key
                await redisClient.zRemRangeByScore(key, 0, Date.now() - maxAge);
                // Set TTL on the key itself so it eventually disappears if inactive
                await redisClient.expire(key, Math.ceil(maxAge / 1000) * 2);
            }
            return;
        }

        // Memory Fallback
        if (!this.cache.has(key)) {
            if (this.cache.size >= this.MAX_ENTRIES) {
                const firstKey = this.cache.keys().next().value;
                this.cache.delete(firstKey);
            }
            this.cache.set(key, []);
        }

        const timestamps = this.cache.get(key);
        timestamps.push(timestamp);

        if (maxAge) {
            this._trimInternal(timestamps, timestamp, maxAge);
        }

        // Move to end for LRU
        this.cache.delete(key);
        this.cache.set(key, timestamps);
    }

    /**
     * Remove old entries for a specific key
     */
    async trim(key, maxAge) {
        if (this.type === 'redis' && redisClient.isOpen) {
            await redisClient.zRemRangeByScore(key, 0, Date.now() - maxAge);
            return;
        }

        if (!this.cache.has(key)) return;
        this._trimInternal(this.cache.get(key), Date.now(), maxAge);
        if (this.cache.get(key).length === 0) this.cache.delete(key);
    }

    /**
     * Global cleanup (mostly for memory strategy)
     */
    async cleanup(maxAge) {
        if (this.type === 'redis') {
            // Redis handles expiration via ZREMRANGEBYSCORE on each write/expire
            // No global scan needed to avoid performance hits
            return 0;
        }

        const now = Date.now();
        let total = 0;
        for (const [key, timestamps] of this.cache.entries()) {
            this._trimInternal(timestamps, now, maxAge);
            if (timestamps.length === 0) {
                this.cache.delete(key);
                total++;
            }
        }
        return total;
    }

    _trimInternal(timestamps, now, maxAge) {
        let i = 0;
        while (i < timestamps.length && now - timestamps[i] > maxAge) i++;
        if (i > 0) timestamps.splice(0, i);
    }
}

module.exports = new StorageAdapter();
