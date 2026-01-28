/**
 * ThreatCache - In-Memory Metrics Store for Behavioral Analysis
 * Replaces expensive DB COUNT queries with high-performance memory lookups.
 */
class ThreatCache {
    constructor() {
        // Maps to store arrays of timestamps for sliding window analysis
        // Key: sessionKey, Value: [timestamp1, timestamp2, ...]
        this.requests = new Map();
        this.logins = new Map();
        this.errors404 = new Map();

        // Max entries to prevent memory exhaustion
        this.MAX_ENTRIES = 10000;

        // Cleanup interval (every 30 seconds)
        setInterval(() => this.cleanup(), 30000);
    }

    /**
     * Track a general request for a session
     */
    trackRequest(sessionKey) {
        this._addEvent(this.requests, sessionKey);
    }

    /**
     * Track a login attempt
     */
    trackLogin(sessionKey) {
        this._addEvent(this.logins, sessionKey);
    }

    /**
     * Track a 404 error
     */
    track404(sessionKey) {
        this._addEvent(this.errors404, sessionKey);
    }

    /**
     * Get count of requests in the last N milliseconds
     */
    getRequestCount(sessionKey, windowMs) {
        return this._getCount(this.requests, sessionKey, windowMs);
    }

    /**
     * Get count of login attempts in the last N milliseconds
     */
    getLoginCount(sessionKey, windowMs) {
        return this._getCount(this.logins, sessionKey, windowMs);
    }

    /**
     * Get count of 404 errors in the last N milliseconds
     */
    get404Count(sessionKey, windowMs) {
        return this._getCount(this.errors404, sessionKey, windowMs);
    }

    // INTERNAL HELPERS

    _addEvent(map, key) {
        if (!map.has(key)) {
            // Safety cap
            if (map.size >= this.MAX_ENTRIES) return;
            map.set(key, []);
        }

        const timestamps = map.get(key);
        timestamps.push(Date.now());

        // Optional: trim if too long to save memory immediately (e.g. keep max 1000 timestamps)
        if (timestamps.length > 200) {
            // Keep only last 200 events (sufficient for our rate limits)
            map.set(key, timestamps.slice(-200));
        }
    }

    _getCount(map, key, windowMs) {
        if (!map.has(key)) return 0;

        const now = Date.now();
        const timestamps = map.get(key);

        // Count events within the window
        // Optimization: iterate from end to start
        let count = 0;
        for (let i = timestamps.length - 1; i >= 0; i--) {
            if (now - timestamps[i] <= windowMs) {
                count++;
            } else {
                break; // Events are sorted by time, so we can stop early
            }
        }
        return count;
    }

    cleanup() {
        const now = Date.now();
        const MAX_AGE = 300000; // 5 minutes (max window we use)

        this._cleanMap(this.requests, now, MAX_AGE);
        this._cleanMap(this.logins, now, MAX_AGE);
        this._cleanMap(this.errors404, now, MAX_AGE);
    }

    _cleanMap(map, now, maxAge) {
        for (const [key, timestamps] of map.entries()) {
            // Filter out old timestamps
            // Find finding the index of the first valid timestamp could be faster than filter for large arrays
            const validTimestamps = timestamps.filter(t => now - t < maxAge);

            if (validTimestamps.length === 0) {
                map.delete(key);
            } else if (validTimestamps.length < timestamps.length) {
                map.set(key, validTimestamps);
            }
        }

        console.log(`🧹 [ThreatCache] Cleanup completed. Active sessions tracked: ${map.size}`);
    }
}

module.exports = new ThreatCache();
