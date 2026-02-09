const { Session, Log } = require('../../models');
const Classifier = require('./Classifier');

/**
 * LogQueue Service
 * Manages an asynchronous buffer for logs to improve DB performance.
 */
class LogQueue {
    constructor() {
        this.buffer = [];
        this.flushInterval = 2000; // 2 seconds
        this.isFlushing = false;

        // Start background worker
        setInterval(() => this.flush(), this.flushInterval);
    }

    /**
     * Enqueue a new log entry
     * @param {Object} entryData - The complete log and request metadata
     */
    enqueue(entryData) {
        if (!entryData.req || !entryData.req.sessionKey) {
            return;
        }
        this.buffer.push(entryData);
    }

    /**
     * Persists the current buffer to the database and runs classification.
     */
    async flush(isExiting = false) {
        if (this.buffer.length === 0 || (this.isFlushing && !isExiting)) return;

        this.isFlushing = true;
        const currentBatch = [...this.buffer];
        this.buffer = [];

        try {
            console.log(`📦 [LogQueue] Flushing batch of ${currentBatch.length} logs...`);

            // 1. UPDATE SESSIONS (requestCount, lastSeen)
            const sessionUpdates = currentBatch.reduce((acc, { req }) => {
                acc[req.sessionKey] = (acc[req.sessionKey] || 0) + 1;
                return acc;
            }, {});

            for (const [sessionKey, count] of Object.entries(sessionUpdates)) {
                try {
                    await Session.increment('requestCount', {
                        by: count,
                        where: { sessionKey }
                    });
                    await Session.update({ lastSeen: new Date() }, {
                        where: { sessionKey }
                    });
                } catch (err) {
                    console.error(`⚠️ [LogQueue] Session update failed for ${sessionKey}:`, err.message);
                }
            }

            // 3. BULK CREATE LOGS
            const logRecords = currentBatch
                .filter(({ req }) => req.sessionKey && req.sessionKey !== 'undefined')
                .map(({ req, res }) => ({
                    id: req.id,
                    sessionKey: req.sessionKey,
                    method: req.method,
                    path: req.path,
                    queryParams: req.query,
                    headers: req.headers,
                    body: typeof req.body === 'string' ? req.body : JSON.stringify(req.body),
                    ipAddress: req.ipAddress,
                    statusCode: res.statusCode,
                    responseTimeMs: res.durationMs || 0,
                    responseBody: res.body || null,
                    fingerprint: req.fingerprint // Salvo il fingerprint nel DB
                }));

            if (logRecords.length === 0) {
                console.warn('⚠️ [LogQueue] No valid logs to persist');
                this.isFlushing = false;
                return;
            }

            const createdLogs = await Log.bulkCreate(logRecords);

            console.log(`✅ [LogQueue] Successfully persisted ${createdLogs.length} logs.`);

            // 4. BACKGROUND CLASSIFICATION (Fire-and-Forget)
            await Promise.all(createdLogs.map(async (logRecord) => {
                try {
                    const originalEntry = currentBatch.find(entry => entry.req.id === logRecord.id);
                    if (!originalEntry) return;

                    const session = await Session.findByPk(logRecord.sessionKey);
                    if (session) {
                        await Classifier.classify(originalEntry.req, logRecord, session);
                    }
                } catch (classifyErr) {
                    console.error(`⚠️ [LogQueue] Classification error for log ${logRecord.id}:`, classifyErr.message);
                }
            }));

            const notificationService = require('./notificationService');
            notificationService.notifyLogBatch(createdLogs.length);

        } catch (err) {
            console.error('❌ [LogQueue] Error during flush:', err.message);
            const { writeToFallbackLog } = require('../middleware/honeyLogger');
            writeToFallbackLog(currentBatch);
        } finally {
            this.isFlushing = false;
        }
    }
}

// Singleton Instance
module.exports = new LogQueue();
