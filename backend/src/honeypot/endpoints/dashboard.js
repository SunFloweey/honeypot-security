const express = require('express');
const { sequelize, testConnection } = require('../../config/database');
const { Op, fn, col, literal } = require('sequelize'); // Aggiunto literal per comodità
const { Log, Session, ApiKey, Classification } = require('../../models');
const notificationService = require('../utils/notificationService');
const ticketService = require('../utils/ticketService');

const router = express.Router();

/**
 * Helper: Crea filtro where per isolamento tenant
 */
async function getTenantFilter(req) {
    if (req.user && req.user.isGlobal) return {}; // Super-admin vede tutto

    if (req.user && req.user.userId) {
        // Trova tutte le chiavi API dell'utente
        const userKeys = await ApiKey.findAll({
            where: { userId: req.user.userId },
            attributes: ['id']
        });
        const keyIds = userKeys.map(k => k.id);

        return {
            apiKeyId: { [Op.in]: keyIds }
        };
    }

    return { apiKeyId: '00000000-0000-0000-0000-000000000000' }; // Nessun log se non autenticato correttamente
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
    const ticket = ticketService.createTicket({ ip: req.ip });
    res.json({ ticket });
});

router.get('/stream', (req, res) => {
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

    // Aggiungi client
    notificationService.addClient(res);

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
router.get('/db-check', async (req, res) => {
    try {
        const result = await Log.count();
        res.json({ status: 'ok', logCount: result });
    } catch (err) {
        console.error('❌ DB Check Error:', err);
        res.status(500).json({ error: 'DB Error', message: err.message, stack: err.stack });
    }
});

/**
 * Overview - Statistiche generali degli ultimi 24h
 */
router.get('/overview', async (req, res) => {
    try {
        let startTime, endTime;
        let isSingleDay = false;

        if (req.query.date && req.query.date.match(/^\d{4}-\d{2}-\d{2}$/)) {
            startTime = new Date(`${req.query.date}T00:00:00.000Z`);
            endTime = new Date(`${req.query.date}T23:59:59.999Z`);
            isSingleDay = true;
        } else {
            startTime = new Date(Date.now() - 24 * 60 * 60 * 1000);
            endTime = new Date();
        }

        const dateRangeClause = { [Op.between]: [startTime, endTime] };
        const tenantClause = await getTenantFilter(req);

        const combinedWhere = {
            ...tenantClause,
            timestamp: dateRangeClause
        };

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
            period: isSingleDay ? 'Day View' : 'Last 24h',
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

        // --- LOGICA FILTRO TEMPORALE (Modificata) ---
        // Se c'è una data specifica nel calendario, ha la priorità
        if (req.query.date && req.query.date.match(/^\d{4}-\d{2}-\d{2}$/)) {
            console.log(`📅 Filtering logs by UTC date: ${req.query.date}`);
            const startOfDay = new Date(`${req.query.date}T00:00:00.000Z`);
            const endOfDay = new Date(`${req.query.date}T23:59:59.999Z`);
            whereClause.timestamp = {
                [Op.between]: [startOfDay, endOfDay]
            };
        }
        // ALTRIMENTI, se richiesto il timespan 24h (Default Overview)
        else if (timespan === '24h') {
            const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
            whereClause.timestamp = {
                [Op.gte]: twentyFourHoursAgo
            };
            console.log("🕒 Filtering logs for the last 24 hours");
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
        const session = await Session.findByPk(req.params.key, {
            include: [{
                model: Log,
                include: [Classification],
                order: [['timestamp', 'ASC']]
            }]
        });

        if (!session) return res.status(404).json({ error: 'Session not found' });
        res.json(session);
    } catch (err) {
        console.error(err);
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

        // 1. Ottieni tutti i log per questo IP
        const logs = await Log.findAll({
            where: { ipAddress },
            include: [{ model: Classification, required: false }],
            order: [['timestamp', 'DESC']]
        });

        // 2. Calcola risk score totale per IP
        // Somma di tutti i riskScore dei singoli log
        const totalRiskScore = logs.reduce((sum, log) => sum + (log.riskScore || 0), 0);

        // 3. Ottieni sessioni associate a questo IP per max_risk_score
        const sessions = await Session.findAll({
            where: { ipAddress },
            attributes: ['sessionKey', 'maxRiskScore', 'requestCount', 'firstSeen', 'lastSeen']
        });

        // 4. Aggregato delle sessioni
        const sessionsMaxRisk = Math.max(...sessions.map(s => s.maxRiskScore || 0), 0);
        const totalRequests = sessions.reduce((sum, s) => sum + (s.requestCount || 0), 0);

        res.json({
            ip: ipAddress,
            // Risk Score aggregato: max tra somma log e max sessione
            totalRiskScore: Math.max(totalRiskScore, sessionsMaxRisk),
            logsCount: logs.length,
            totalRequests,
            sessionsCount: sessions.length,
            sessions,
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

module.exports = router;

