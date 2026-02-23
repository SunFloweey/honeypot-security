const { Session, Log } = require('../../models');
const Classifier = require('./Classifier');

/**
 * LogQueue Service
 * Manages an asynchronous buffer for logs to improve DB performance.
 */
class LogQueue {
    constructor() {
        this.buffer = [];
        this.flushInterval = 5000; // 5 seconds (optimized for quota)
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

            // 1. ENSURE SESSIONS EXIST & UPDATE STATS
            // Raggruppo per sessionKey univoca nel batch
            const uniqueSessions = {};
            currentBatch.forEach(({ req }) => {
                if (!uniqueSessions[req.sessionKey]) {
                    uniqueSessions[req.sessionKey] = {
                        count: 0,
                        ipAddress: req.ipAddress,
                        userAgent: req.userAgent,
                        firstSeen: new Date(),
                        lastSeen: new Date()
                    };
                }
                uniqueSessions[req.sessionKey].count++;
                uniqueSessions[req.sessionKey].lastSeen = new Date();
            });

            // Upsert delle sessioni (crea se non esiste, aggiorna se esiste)
            for (const [sessionKey, data] of Object.entries(uniqueSessions)) {
                try {
                    const [session, created] = await Session.findOrCreate({
                        where: { sessionKey },
                        defaults: {
                            ipAddress: data.ipAddress,
                            userAgent: data.userAgent,
                            requestCount: data.count,
                            maxRiskScore: 0,
                            firstSeen: data.firstSeen,
                            lastSeen: data.lastSeen
                        }
                    });

                    if (!created) {
                        await session.increment('requestCount', { by: data.count });
                        await session.update({ lastSeen: data.lastSeen });
                    }
                } catch (err) {
                    console.error(`⚠️ [LogQueue] Session sync failed for ${sessionKey}:`, err.message);
                }
            }

            // 3. BULK CREATE LOGS
            const { v4: uuidv4 } = require('uuid');

            const logRecords = currentBatch
                .filter(({ req }) => req.sessionKey && req.sessionKey !== 'undefined')
                .map(({ req, res }) => {
                    try {
                        return {
                            id: req.id || uuidv4(), // Fallback UUID
                            sessionKey: req.sessionKey,
                            method: req.method,
                            path: req.path,
                            queryParams: req.query,
                            headers: req.headers,
                            body: typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {}),
                            ipAddress: req.ipAddress,
                            statusCode: res.statusCode || 500,
                            responseTimeMs: res.durationMs || 0,
                            responseBody: res.body || null,
                            fingerprint: req.fingerprint,
                            timestamp: new Date() // Ensure timestamp is set
                        };
                    } catch (mapErr) {
                        console.error('⚠️ [LogQueue] Skipping malformed log entry:', mapErr.message);
                        return null;
                    }
                })
                .filter(record => record !== null); // Filter out failed mappings

            if (logRecords.length === 0) {
                console.warn('⚠️ [LogQueue] No valid logs to persist after processing');
                this.isFlushing = false;
                return;
            }

            const createdLogs = await Log.bulkCreate(logRecords, { validate: true }); // Enable validation

            console.log(`✅ [LogQueue] Successfully persisted ${createdLogs.length} logs.`);

            // 4. BACKGROUND CLASSIFICATION (Fire-and-Forget)
            await Promise.all(createdLogs.map(async (logRecord) => {
                try {
                    // Match by ID, handling potential UUID generation differences (unlikely here but safe)
                    const originalEntry = currentBatch.find(entry =>
                        (entry.req.id && entry.req.id === logRecord.id) ||
                        (entry.req.path === logRecord.path && entry.req.method === logRecord.method) // Fallback match
                    );

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

            // 5. REAL-TIME THREAT SYNTHESIS (Gemini)
            const AIService = require('../../services/aiService');
            AIService.summarizeRecentActivity(createdLogs)
                .then(summary => {
                    if (summary) {
                        notificationService.notifyThreatAnalysis(summary);
                    }
                })
                .catch(err => console.error('⚠️ [LogQueue] AI Synthesis failed:', err.message));

        } catch (err) {
            console.error('❌ [LogQueue] Error during flush:', err.message);
            // Fallback: Dump to console if DB fails
            console.error('DUMPING BATCH:', JSON.stringify(currentBatch.map(e => ({ path: e.req.path, method: e.req.method })), null, 2));
        } finally {
            this.isFlushing = false;
        }
    }
}

// Singleton Instance
module.exports = new LogQueue();
