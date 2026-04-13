const express = require('express');
const { sequelize, testConnection } = require('../../config/database');
const { Op, fn, col, literal } = require('sequelize'); // Aggiunto literal per comodità
const { Log, Session, ApiKey, Classification, BannedIP } = require('../../models');
const notificationService = require('../utils/notificationService');
const ticketService = require('../utils/ticketService');
const { validate, saasSchemas } = require('../../middleware/validator');
const rateLimit = require('express-rate-limit');

/**
 * Dashboard Rate Limiter
 * Protegge il database da query di aggregazione pesanti.
 */
const dashboardLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 50, // Più restrittivo per la dashboard
    keyGenerator: (req) => req.user?.userId || req.ip,
    message: { error: 'Troppe richieste. La dashboard ha un limite di sicurezza.' }
});

const router = express.Router();
router.use(dashboardLimiter);

/**
 * Helper: Crea filtro where per isolamento tenant
 */
async function getTenantFilter(req) {
    if (req.user && req.user.isGlobal) {
        console.log('👑 [Dashboard Auth] Global Admin detected - Showing ALL logs (including orphans)');
        return {};
    }

    if (req.user && req.user.userId) {
        // Trova tutte le chiavi API dell'utente
        const userKeys = await ApiKey.findAll({
            where: { userId: req.user.userId },
            attributes: ['id']
        });
        const keyIds = userKeys.map(k => k.id);

        console.log(`👤 [Dashboard Auth] User: ${req.user.email} (ID: ${req.user.userId}) - Found ${keyIds.length} API Keys`);

        // Se l'utente non ha chiavi, non deve vedere nulla (nemmeno i log orfani)
        if (keyIds.length === 0) {
            return { apiKeyId: '00000000-0000-0000-0000-000000000000' };
        }

        return {
            apiKeyId: { [Op.in]: keyIds }
        };
    }

    console.warn('⚠️ [Dashboard Auth] No valid user session found for filtering');
    return { apiKeyId: '00000000-0000-0000-0000-000000000000' };
}

// ==========================================
// REAL-TIME NOTIFICATIONS (SSE)
// ==========================================

/**
 * GET /stream-ticket
 * Generates a short-lived ticket to authorize an SSE connection.
 * This avoids passing the full ADMIN_TOKEN via query parameters.
 */
router.get('/stream-ticket', (req, res) => {
    // Include user identity in the ticket metadata for SSE isolation
    const metadata = {
        ip: req.ip,
        userId: req.user ? req.user.userId : null,
        isGlobal: req.user ? !!req.user.isGlobal : false
    };

    const ticket = ticketService.createTicket(metadata);
    res.json({ ticket });
});

router.get('/stream', (req, res) => {
    // metadata is already validated and attached by adminAuthMiddleware
    const metadata = req.sseMetadata;

    if (!metadata) {
        return res.status(403).json({ error: 'Invalid or expired SSE ticket' });
    }

    // Configurazioni socket per mantenere la connessione aperta
    req.socket.setKeepAlive(true);
    req.socket.setTimeout(0); // Nessun timeout per SSE
    req.socket.setNoDelay(true);

    // Headers obbligatori per SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disabilita buffering proxy (Nginx)
    res.flushHeaders();

    // Invia un commento iniziale e heartbeat per stabilizzare la connessione
    res.write(': connected\n\n');
    res.write(': heartbeat\n\n');

    // Aggiungi client con i suoi metadati (userId, isGlobal)
    notificationService.addClient(res, metadata);

    // Heartbeat forzata più frequente (30s) per evitare timeout browser (solitamente 45s)
    const heartbeatTimer = setInterval(() => {
        if (!res.writableEnded) {
            res.write(': keepalive\n\n');
        }
    }, 30000);

    // Gestione disconnessione
    req.on('close', () => {
        clearInterval(heartbeatTimer);
        notificationService.removeClient(res);
        res.end();
    });

    req.on('error', (err) => {
        clearInterval(heartbeatTimer);
        // Evitiamo log rumorosi per interruzioni normali del socket
        if (err.code !== 'ECONNRESET' && err.code !== 'EPIPE' && err.message !== 'aborted') {
            console.error('SSE connection error:', err);
        }
        notificationService.removeClient(res);
    });
});

// FORNISCE DATI REALI alla dashboard reale 
// Auth e rate limiting sono applicati in index.js prima di montare questo router

/**
 * DB Check - Verifica connessione e tabelle
 */
// Health check del database per la Dashboard
router.get('/db-check', async (req, res) => {
    try {
        // Permettiamo il check a chiunque sia autenticato (Admin o SaaS User)
        // L'isolamento dei dati è garantito dagli altri endpoint
        const count = await Log.count();
        res.json({ 
            success: true, 
            status: 'connected', 
            logs: count,
            userRole: req.user?.isGlobal ? 'admin' : 'saas-client'
        });
    } catch (err) {
        console.error('❌ Database connection error:', err);
        res.status(500).json({ success: false, error: 'Database connection failed' });
    }
});

// Internal bridge for notifications from Honeypot to Admin
router.post('/internal/notify', async (req, res) => {
    // Basic security check
    if (req.headers['x-internal-secret'] !== process.env.ADMIN_TOKEN) {
        return res.status(403).json({ error: 'Unauthorized' });
    }

    const { type, ...data } = req.body;

    // Admin server's notificationService will broadcast this to SSE clients
    if (notificationService.isAdminServer) {
        notificationService._handleEvent(type, data);
    }

    res.json({ status: 'ok' });
});

router.get('/overview', async (req, res) => {
    try {
        let startTime, endTime;
        let isSingleDay = false;

        if (req.query.date && req.query.date.match(/^\d{4}-\d{2}-\d{2}$/)) {
            startTime = new Date(`${req.query.date}T00:00:00.000Z`);
            endTime = new Date(`${req.query.date}T23:59:59.999Z`);
            isSingleDay = true;
        } else {
            // Default: last 24 hours
            startTime = new Date(Date.now() - 24 * 60 * 60 * 1000);
            endTime = new Date();
        }

        const dateRangeClause = { [Op.between]: [startTime, endTime] };
        const tenantClause = await getTenantFilter(req);

        const combinedWhere = {
            ...tenantClause,
            timestamp: dateRangeClause
        };

        console.log(`📊 [Dashboard] Fetching overview for ${req.user.email} (Global: ${!!req.user.isGlobal})`);

        // 1. Parallel execution of all dashboard queries to reduce latency
        const [
            totalLogs,
            totalSessions,
            attackStats,
            topIPs,
            timeSeriesRaw,
            topFingerprints
        ] = await Promise.all([
            // Query 1: Total requests
            Log.count({ where: combinedWhere }),

            // Query 2: Unique sessions seen in period
            Log.count({
                distinct: true,
                col: 'session_key',
                where: combinedWhere
            }),

            // Query 3: Attack Distribution (Joined with Classifications)
            Log.findAll({
                attributes: [
                    [sequelize.col('Classifications.category'), 'category'],
                    [sequelize.fn('COUNT', sequelize.col('Log.id')), 'count']
                ],
                where: combinedWhere,
                include: [{
                    model: Classification,
                    as: 'Classifications',
                    attributes: [],
                    required: true
                }],
                group: ['Classifications.category'],
                raw: true
            }),

            // Query 4: Top IPs by Risk
            Log.findAll({
                attributes: [
                    'ipAddress',
                    [fn('COUNT', col('id')), 'count'],
                    [fn('SUM', col('risk_score')), 'totalRiskScore']
                ],
                where: combinedWhere,
                group: ['ip_address'],
                order: [[fn('SUM', col('risk_score')), 'DESC']],
                limit: 5,
                raw: true
            }),

            // Query 5: Traffic Time Series
            Log.findAll({
                attributes: [
                    [fn('date_trunc', isSingleDay ? 'minute' : 'hour', col('timestamp')), 'time_bucket'],
                    [fn('COUNT', col('id')), 'count']
                ],
                where: combinedWhere,
                group: [fn('date_trunc', isSingleDay ? 'minute' : 'hour', col('timestamp'))],
                order: [[fn('date_trunc', isSingleDay ? 'minute' : 'hour', col('timestamp')), 'ASC']],
                raw: true
            }),

            // Query 6: Fingerprint Intelligence
            Log.findAll({
                attributes: [
                    'fingerprint',
                    [fn('COUNT', fn('DISTINCT', col('ip_address'))), 'uniqueIPs'],
                    [fn('COUNT', col('id')), 'totalRequests'],
                    [fn('MAX', col('timestamp')), 'lastSeen']
                ],
                where: {
                    ...combinedWhere,
                    fingerprint: { [Op.ne]: null }
                },
                group: ['fingerprint'],
                having: literal('COUNT(DISTINCT ip_address) > 0'),
                order: [[fn('COUNT', fn('DISTINCT', col('ip_address'))), 'DESC']],
                limit: 5,
                raw: true
            })
        ]);

        // Formatta per Recharts (se singolo giorno mostra HH:mm, altrimenti DD/MM HH)
        const timeSeries = timeSeriesRaw.map(entry => {
            const date = new Date(entry.time_bucket);
            return {
                time: isSingleDay
                    ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    : `${date.getDate()}/${date.getMonth() + 1} ${date.getHours()}:00`,
                requests: parseInt(entry.count, 10)
            };
        });

        res.json({
            period: isSingleDay ? 'Day View' : 'Last 7 Days',
            summary: { totalLogs, totalSessions },
            attacks: attackStats.map(a => ({ ...a, count: parseInt(a.count, 10) })),
            timeSeries,
            topIPs: topIPs.map(ip => ({
                ...ip,
                count: parseInt(ip.count, 10),
                totalRiskScore: parseInt(ip.totalRiskScore, 10)
            })),
            topFingerprints: topFingerprints.map(fp => ({
                ...fp,
                uniqueIPs: parseInt(fp.uniqueIPs, 10),
                totalRequests: parseInt(fp.totalRequests, 10)
            }))
        });
    } catch (err) {
        console.error('❌ Overview Error:', err);
        res.status(500).json({ error: 'Internal Server Error', message: err.message });
    }
});

/**
 * Lista Log con filtri
 * Restituisce logs con le relative classificazioni.
 * Usa il campo riskScore del log per i filtri (più efficiente).
 */
router.get('/logs', async (req, res) => {
    try {
        const { limit = 50, offset = 0, category, risk_min, order, timespan } = req.query;

        // Validazione della direzione: solo 'ASC' o 'DESC'
        const sortDirection = (order && order.toUpperCase() === 'ASC') ? 'ASC' : 'DESC';

        console.log(`🔍 Logs Request: limit=${limit}, risk_min=${risk_min}, category=${category}, order=${sortDirection}`);

        const tenantClause = await getTenantFilter(req);

        const whereClause = {
            ...tenantClause
        };

        // --- LOGICA FILTRO TEMPORALE ---
        if (req.query.date && req.query.date.match(/^\d{4}-\d{2}-\d{2}$/)) {
            console.log(`📅 Filtering logs by UTC date: ${req.query.date}`);
            const startOfDay = new Date(`${req.query.date}T00:00:00.000Z`);
            const endOfDay = new Date(`${req.query.date}T23:59:59.999Z`);
            whereClause.timestamp = {
                [Op.between]: [startOfDay, endOfDay]
            };
        }
        // Se non c'è una data specifica e NON è richiesta esplicitamente l'overview 24h, 
        // mostriamo i log più recenti senza limiti di tempo per evitare "sparizioni" dovute all'orologio.
        else if (timespan === '24h') {
            const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
            whereClause.timestamp = {
                [Op.gte]: twentyFourHoursAgo
            };
            console.log("🕒 Filtering logs for the last 24 hours");
        } else {
            console.log("🔓 No time filter applied (showing all-time logs for this user)");
        }

        // Filtro per risk_min usa il campo riskScore del Log (non le Classifications)
        if (risk_min && parseInt(risk_min) > 0) {
            whereClause.riskScore = { [Op.gte]: parseInt(risk_min) };
        }

        // Filtro per indirizzo IP
        if (req.query.ipAddress) { whereClause.ipAddress = req.query.ipAddress; }

        // Filtro per Fingerprint (Nuovo!)
        if (req.query.fingerprint) { whereClause.fingerprint = req.query.fingerprint; }

        // Include Classifications sempre con LEFT JOIN
        // Se c'è un filtro per categoria, filtra sulle classifications
        const includeClause = [
            {
                model: Classification,
                as: 'Classifications',
                required: false, // LEFT JOIN - include anche logs senza classificazioni
                ...(category && { where: { category } })
            },
            {
                model: ApiKey,
                as: 'apiKey',
                attributes: ['name', 'key']
            }
        ];

        const logs = await Log.findAndCountAll({
            where: whereClause,
            include: includeClause,
            order: [
                ['timestamp', sortDirection], // Prima i nuovi per vedere il real-time
                ['riskScore', 'DESC']
            ],
            limit: parseInt(limit),
            offset: parseInt(offset)
        });

        console.log(`📊 Dashboard Logs: Found ${logs.count} rows (Filter: risk_min=${risk_min})`);
        res.json(logs);
    } catch (err) {
        console.error('❌ Dashboard Logs Error:', err);
        res.status(500).json({ error: 'Internal Server Error', details: err.message });
    }
});

/**
 * Dettaglio Sessione
 */
router.get('/session/:key', async (req, res) => {
    try {
        const tenantClause = await getTenantFilter(req);

        const session = await Session.findOne({
            where: { 
                sessionKey: req.params.key,
                ...tenantClause // CRITICAL FIX: Isola la sessione stessa per tenant
            },
            include: [{
                model: Log,
                as: 'Logs',
                where: tenantClause,
                required: false, 
                include: [{
                    model: Classification,
                    as: 'Classifications'
                }]
            }],
            order: [
                [{ model: Log, as: 'Logs' }, 'timestamp', 'ASC']
            ]
        });

        if (!session) return res.status(404).json({ error: 'Session not found or access denied' });
        res.json(session);
    } catch (err) {
        console.error('❌ Session Detail Error:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

/**
 * Cronologia IP con Risk Score Aggregato
 * Restituisce tutti i log di un IP + risk score totale
 */
router.get('/ip/:ip', async (req, res) => {
    try {
        const ipAddress = req.params.ip;
        const tenantClause = await getTenantFilter(req);

        // 1. Ottieni tutti i log per questo IP (filtrati per tenant)
        const logs = await Log.findAll({
            where: { ...tenantClause, ipAddress },
            include: [{ model: Classification, required: false }],
            order: [['timestamp', 'DESC']]
        });

        if (logs.length === 0 && !req.user.isGlobal) {
            return res.status(404).json({ error: 'IP data not found or access denied' });
        }

        // 2. Calcola risk score totale per IP
        const totalRiskScore = logs.reduce((sum, log) => sum + (log.riskScore || 0), 0);

        // 3. Ottieni sessioni associate a questo IP (filtrate per tenant)
        const sessions = await Session.findAll({
            where: { ipAddress, ...tenantClause },
            attributes: ['sessionKey', 'maxRiskScore', 'requestCount', 'firstSeen', 'lastSeen']
        });

        res.json({
            ip: ipAddress,
            totalRiskScore,
            logsCount: logs.length,
            sessionsCount: sessions.length,
            logs
        });
    } catch (err) {
        console.error('❌ IP History Error:', err);
        res.status(500).json({ error: 'Internal Server Error', details: err.message });
    }
});

/**
 * Time Series - Aggregazione per bucket temporali di 10 minuti
 */
router.get('/timeseries', async (req, res) => {
    try {
        const { hours = 24, category } = req.query;
        const startTime = new Date(Date.now() - hours * 60 * 60 * 1000);
        const bucketSize = 600; // 10 minuti in secondi

        const tenantClause = await getTenantFilter(req);
        const whereClause = {
            ...tenantClause,
            timestamp: { [Op.gte]: startTime }
        };
        const includeClause = [];

        if (category) {
            includeClause.push({
                model: Classification,
                attributes: [],
                where: { category }
            });
        } else {
            includeClause.push({
                model: Classification,
                attributes: []
            });
        }

        const timeSeries = await Log.findAll({
            attributes: [
                [
                    fn('to_timestamp',
                        fn('*',
                            fn('FLOOR',
                                fn('/',
                                    fn('EXTRACT', fn('EPOCH', col('timestamp'))),
                                    bucketSize
                                )
                            ),
                            bucketSize
                        )
                    ),
                    'time_bucket'
                ],
                [fn('COUNT', col('id')), 'count']
            ],
            where: whereClause,
            include: includeClause,
            group: ['time_bucket'],
            order: [[col('time_bucket'), 'ASC']],
            raw: true
        });

        res.json({
            bucket_size_minutes: 10,
            period_hours: hours,
            data: timeSeries
        });
    } catch (err) {
        console.error('❌ TimeSeries Error:', err);
        res.status(500).json({ error: 'Internal Server Error', details: err.message });
    }
});

// Internal bridge for notifications from Honeypot to Admin
router.post('/internal/notify', async (req, res) => {
    // Basic security check
    if (req.headers['x-internal-secret'] !== process.env.ADMIN_TOKEN) {
        return res.status(403).json({ error: 'Unauthorized' });
    }

    const { type, ...data } = req.body;
    console.log(`📩 [Admin API] Received internal notification: ${type} from ${req.ip}`);

    // Admin server's notificationService will broadcast this to SSE clients
    if (notificationService.isAdminServer) {
        notificationService._handleEvent(type, data);
    }

    res.json({ status: 'ok' });
});

// ==========================================
// THREAT RESPONSE ACTIONS
// ==========================================

/**
 * POST /ip/ban - Bans an IP address
 */
router.post('/ip/ban', async (req, res) => {
    try {
        const { ipAddress, reason } = req.body;
        if (!ipAddress) return res.status(400).json({ error: 'IP Address required' });

        await BannedIP.upsert({
            ipAddress,
            reason: reason || 'Banned from Dashboard',
            bannedAt: new Date()
        });

        console.log(`🚫 [Security] IP ${ipAddress} has been BANNED by admin`);
        res.json({ status: 'ok', message: `IP ${ipAddress} banned successfully` });
    } catch (err) {
        console.error('❌ Ban Error:', err);
        res.status(500).json({ error: 'Failed to ban IP' });
    }
});

/**
 * POST /session/isolate - Marks a session for isolation/surveillance
 */
router.post('/session/isolate', async (req, res) => {
    try {
        const { sessionKey } = req.body;
        if (!sessionKey) return res.status(400).json({ error: 'Session Key required' });

        // For now, we update the session or just log the intent
        // In a real scenario, this would trigger a stricter decoy persona
        await Session.update({ maxRiskScore: 100 }, { where: { sessionKey } });

        console.log(`🛡️ [Security] Session ${sessionKey} ISOLATED for surveillance`);
        res.json({ status: 'ok', message: `Session isolated` });
    } catch (err) {
        res.status(500).json({ error: 'Failed to isolate session' });
    }
});

/**
 * POST /notify/ignore - Acknowledges and silences an alert
 */
router.post('/notify/ignore', async (req, res) => {
    try {
        const { sessionKey, ipAddress } = req.body;
        console.log(`✨ [Security] Alert ignored for ${ipAddress || sessionKey} by admin`);
        res.json({ status: 'ok' });
    } catch (err) {
        res.status(500).json({ error: 'Error' });
    }
});

module.exports = router;

