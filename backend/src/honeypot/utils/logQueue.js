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

            // 1. AGGREGAZIONE SESSIONI PER UPSERT MASSIVO
            const sessionMap = new Map();
            currentBatch.forEach(({ req }) => {
                if (!req.sessionKey) return;
                
                if (!sessionMap.has(req.sessionKey)) {
                    sessionMap.set(req.sessionKey, {
                        sessionKey: req.sessionKey,
                        ipAddress: req.ipAddress,
                        userAgent: req.userAgent,
                        requestCount: 0,
                        lastSeen: new Date()
                    });
                }
                const sess = sessionMap.get(req.sessionKey);
                sess.requestCount++;
                sess.lastSeen = new Date();
            });

            // 2. UPSERT DELLE SESSIONI (Operazione massiva invece di loop query)
            if (sessionMap.size > 0) {
                const sessionsToUpsert = Array.from(sessionMap.values());
                await Session.bulkCreate(sessionsToUpsert, {
                    updateOnDuplicate: ['requestCount', 'lastSeen'],
                    returning: false
                });
            }

            // 3. BULK CREATE LOGS (Senza validazione individuale per massime performance)
            const { v4: uuidv4 } = require('uuid');

            const logRecords = currentBatch
                .filter(({ req }) => req.sessionKey && req.sessionKey !== 'undefined')
                .map(({ req, res, apiKeyId }) => {
                    try {
                        return {
                            id: req.id || uuidv4(),
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
                            timestamp: new Date(),
                            apiKeyId: apiKeyId || null
                        };
                    } catch (mapErr) {
                        return null;
                    }
                })
                .filter(record => record !== null);

            if (logRecords.length > 0) {
                await Log.bulkCreate(logRecords);
                console.log(`✅ [LogQueue] Successfully persisted ${logRecords.length} logs.`);
            }

            // 4. CLASSIFICAZIONE CON LIMITATORE DI CONCORRENZA (opzionale, qui semplificato)
            // Notifichiamo il batch una volta sola
            const notificationService = require('./notificationService');
            notificationService.notifyLogBatch(logRecords.length);

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
