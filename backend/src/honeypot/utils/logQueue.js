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

            // 2. UPSERT DELLE SESSIONI
            if (sessionMap.size > 0) {
                const sessionsToUpsert = Array.from(sessionMap.values());
                // Cerchiamo di includere l'apiKeyId anche nella sessione se il primo log del batch lo ha
                // Questo aiuta a filtrare le sessioni intere per cliente
                await Session.bulkCreate(sessionsToUpsert, {
                    updateOnDuplicate: ['requestCount', 'lastSeen'],
                    returning: false
                });
            }

            // 3. BULK CREATE LOGS
            const crypto = require('crypto');

            // Regex per validare UUID v4
            const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

            const logRecords = currentBatch
                .filter(({ req }) => req.sessionKey && req.sessionKey !== 'undefined')
                .map(({ req, res, apiKeyId }) => {
                    try {
                        // Validazione UUID difensiva: se req.id non è un UUID valido (es. "sdk_...")
                        // lo sostituiamo silenziosamente per non far crashare il bulk insert.
                        const safeId = (req.id && UUID_REGEX.test(req.id)) ? req.id : crypto.randomUUID();
                        return {
                            id: safeId,
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
                try {
                    const savedLogs = await Log.bulkCreate(logRecords, { returning: true });
                    console.log(`✅ [LogQueue] Successfully persisted ${savedLogs.length} logs.`);

                    // 4. CLASSIFICAZIONE POST-SALVATAGGIO
                    // Ora che i log hanno un ID reale, li passiamo al classificatore
                    for (let i = 0; i < currentBatch.length; i++) {
                        const { req } = currentBatch[i];
                        // Cerchiamo l'ID salvato: se non esisteva in req, usiamo quello che abbiamo generato nel mapping
                        const searchId = req.id || logRecords[i].id;
                        const logRecord = savedLogs.find(l => l.id === searchId);

                        if (logRecord) {
                            // Chiamata al classificatore per calcolare Risk Score e categorie
                            Classifier.classify(req, logRecord, { sessionKey: req.sessionKey, ipAddress: req.ipAddress })
                                .catch(err => console.error(`❌ [Classifier] Error classifying log ${searchId}:`, err.stack));
                        }
                    }

                } catch (dbErr) {
                    console.error('❌ [LogQueue] Database bulk create failed, using disk fallback:', dbErr.message);
                    await this.saveToDiskFallback(logRecords);
                }
            }

            // 5. NOTIFICHE MIRATE PER TENANT
            const notificationService = require('./notificationService');
            const ApiKey = require('../../models/ApiKey');

            // Raggruppiamo i log salvati per userId per inviare notifiche separate
            const userNotificationMap = new Map(); // userId -> { count, logRecords }

            for (const record of logRecords) {
                if (record.apiKeyId) {
                    try {
                        const key = await ApiKey.findByPk(record.apiKeyId, { attributes: ['userId'] });
                        if (key && key.userId) {
                            if (!userNotificationMap.has(key.userId)) {
                                userNotificationMap.set(key.userId, { count: 0, logs: [] });
                            }
                            const entry = userNotificationMap.get(key.userId);
                            entry.count++;
                            entry.logs.push(record);
                        }
                    } catch (e) { /* Ignore */ }
                }
            }

            // Invia notifiche LOG_BATCH per ogni utente
            userNotificationMap.forEach((data, userId) => {
                notificationService.notifyLogBatch(data.count, userId);
            });

            // Se non ci sono tenant specifici (log globali), invia all'admin globale
            if (userNotificationMap.size === 0) {
                notificationService.notifyLogBatch(logRecords.length);
            }

            // 6. REAL-TIME THREAT SYNTHESIS (IA)
            const AIService = require('../../services/aiService');
            
            // Per ogni utente che ha ricevuto log, generiamo un'analisi dedicata (IA)
            if (userNotificationMap.size > 0) {
                userNotificationMap.forEach((data, userId) => {
                    AIService.summarizeRecentActivity(data.logs)
                        .then(summary => {
                            if (summary) {
                                notificationService.notifyThreatAnalysis(summary, userId);
                            }
                        })
                        .catch(err => console.error(`⚠️ [LogQueue] AI Synthesis failed for user ${userId}:`, err.message));
                });
            } else {
                // Analisi globale per l'admin se il batch è globale
                AIService.summarizeRecentActivity(logRecords)
                    .then(summary => {
                        if (summary) notificationService.notifyThreatAnalysis(summary);
                    })
                    .catch(err => console.error('⚠️ [LogQueue] Global AI Synthesis failed:', err.message));
            }

        } catch (err) {
            console.error('❌ [LogQueue] Error during flush:', err.message);
            // Fallback: Dump to console if DB fails
            console.error('DUMPING BATCH:', JSON.stringify(currentBatch.map(e => ({ path: e.req.path, method: e.req.method })), null, 2));
        } finally {
            this.isFlushing = false;
        }
    }

    async saveToDiskFallback(records) {
        try {
            const fs = require('fs').promises;
            const path = require('path');
            const logPath = path.join(process.cwd(), 'logs', 'failed_logs.json');

            let existing = [];
            try {
                const data = await fs.readFile(logPath, 'utf8');
                existing = JSON.parse(data);
            } catch (e) { }

            await fs.writeFile(logPath, JSON.stringify([...existing, ...records], null, 2));
            console.log(`📂 [LogQueue] Saved ${records.length} logs to disk fallback.`);
        } catch (err) {
            console.error('🔥 [LogQueue] TOTAL FAILURE: Could not save to disk!', err.message);
        }
    }
}

// Singleton Instance
module.exports = new LogQueue();
