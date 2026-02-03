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
        this.buffer.push(entryData);
    }

    /**
     * Process the buffer and write to the database in batches
     */
    /**
     * Force flush the buffer, ignoring the lock if specified (use with caution)
     * @param {boolean} force - If true, proceeds even if a flush is in progress (NOT RECOMMENDED for normal op)
     */
    async flush(force = false) {
        if ((this.isFlushing && !force) || this.buffer.length === 0) return;

        this.isFlushing = true;
        const currentBatch = [...this.buffer];
        this.buffer = [];

        try {
            console.log(`📦 [LogQueue] Flushing batch of ${currentBatch.length} logs...`);

            // 1. DEDUPLICATE & AGGREGATE SESSIONS
            // Extract unique sessions and COUNT requests per session for this batch
            const sessionMap = new Map();

            for (const { req, sessionMetadata } of currentBatch) {

                // ✅ VALIDAZIONE: Skip log se sessionKey è invalido
                if (!req.sessionKey || req.sessionKey === 'undefined' || req.sessionKey === 'null') {
                    console.warn('⚠️ [LogQueue] Skipping log with invalid sessionKey:', req);
                    continue;
                }


                if (!sessionMap.has(req.sessionKey)) {
                    sessionMap.set(req.sessionKey, {
                        sessionKey: req.sessionKey,
                        ipAddress: req.ipAddress,
                        userAgent: req.userAgent,
                        reqCount: 0,
                        fingerprint: sessionMetadata?.fingerprint || {}
                    });
                }
                // Accumulate request count locally
                sessionMap.get(req.sessionKey).reqCount++;
            }

            const allKeys = Array.from(sessionMap.keys());

            // ✅ Se non ci sono sessioni valide, esci
            if (allKeys.length === 0) {
                console.warn('⚠️ [LogQueue] No valid sessions in batch, skipping flush');
                return;
            }

            // 2. BULK FETCH & UPSERT STRATEGY
            // Fetch all existing sessions in one go
            const existingSessions = await Session.findAll({
                where: { sessionKey: allKeys }
            });

            const existingKeys = new Set(existingSessions.map(s => s.sessionKey));
            const newSessionsData = [];
            const updatePromises = [];

            // A. Prepare Updates for Existing Sessions
            for (const session of existingSessions) {
                const batchData = sessionMap.get(session.sessionKey);
                // Queue parallel update: increment count + update lastSeen
                updatePromises.push(
                    session.increment('requestCount', { by: batchData.reqCount }),
                    session.update({ lastSeen: new Date(), ...batchData.fingerprint })
                );
            }

            // B. Prepare Creates for New Sessions
            for (const [key, data] of sessionMap) {
                if (!existingKeys.has(key)) {
                    newSessionsData.push({
                        sessionKey: key,
                        ipAddress: data.ipAddress,
                        userAgent: data.userAgent,
                        requestCount: data.reqCount, // Initialize with actual batch count
                        lastSeen: new Date(),
                        ...data.fingerprint
                    });
                }
            }

            // C. Execute DB Operations
            // 1. Bulk Create New
            if (newSessionsData.length > 0) {
                await Session.bulkCreate(newSessionsData);
            }
            // 2. Parallel Updates Existing
            if (updatePromises.length > 0) {
                await Promise.all(updatePromises);
            }

            // 3. BULK CREATE LOGS
            const logRecords = currentBatch
                .filter(({ req }) => req.sessionKey && req.sessionKey !== 'undefined')
                .map(({ req, res }) => ({
                    id: req.requestId,
                    sessionKey: req.sessionKey,
                    method: req.method,
                    path: req.path,
                    queryParams: req.query,
                    headers: req.headers,
                    body: typeof req.body === 'string' ? req.body : JSON.stringify(req.body),
                    ipAddress: req.ipAddress,
                    statusCode: res.statusCode,
                    responseTimeMs: res.responseTimeMs || 0,
                    responseBody: res.responseBody || null
                }));

            if (logRecords.length === 0) {
                console.warn('⚠️ [LogQueue] No valid logs to persist');
                return;
            }

            const createdLogs = await Log.bulkCreate(logRecords);

            console.log(`✅ [LogQueue] Successfully persisted ${createdLogs.length} logs.`);

            // Notify Dashboard Clients to Refresh
            const notificationService = require('./notificationService');
            notificationService.notifyLogBatch(createdLogs.length);

            // 4. BACKGROUND CLASSIFICATION (Fire-and-Forget)
            // Decoupled from the main flush loop to prevent bottlenecks.
            // We don't await this, so the queue is ready for the next batch immediately.
            Promise.all(createdLogs.map(async (logRecord, index) => {
                try {
                    // ✅ Trova l'entry corrispondente nel batch filtrato
                    const batchIndex = currentBatch.findIndex(
                        ({ req }) => req.requestId === logRecord.id
                    );

                    if (batchIndex === -1) return;

                    const { req } = currentBatch[batchIndex];
                    const session = await Session.findByPk(req.sessionKey);

                    if (session) {
                        await Classifier.classify(req, logRecord, session);
                    }
                } catch (classifyErr) {
                    console.error(`⚠️ [LogQueue] Classification error for log ${logRecord.id}:`, classifyErr.message);
                }
            })).then(() => {
                // Optional: verbose logging for debugging
                // console.log(`🔍 [LogQueue] Finished classifying batch of ${createdLogs.length}`);
            });

        } catch (err) {
            console.error('❌ [LogQueue] Error during flush:', err.message);
            console.error('Stack trace:', err.stack); // ✅ Aggiungi stack trace per debug

            // PERSISTENCE FALLBACK
            const { writeToFallbackLog } = require('../middleware/honeyLogger');
            for (const entry of currentBatch) {
                writeToFallbackLog(entry).catch(e =>
                    console.error('Failed to write to fallback log:', e)
                );
            }
        } finally {
            this.isFlushing = false;
        }
    }
}

// Singleton instance
module.exports = new LogQueue();
