const express = require('express');
const { sequelize, testConnection } = require('../../config/database');
const { Op, fn, col, literal } = require('sequelize'); // Aggiunto literal per comodità
const Log = require('../../models/Log');
const Session = require('../../models/Session');
const Classification = require('../../models/Classification');
const notificationService = require('../utils/notificationService');

const router = express.Router();

// ==========================================
// REAL-TIME NOTIFICATIONS (SS)
// ==========================================
router.get('/stream', (req, res) => {
    // Headers obbligatori per SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    // Invia un commento iniziale per "aprire" il flusso e stabilizzare alcuni browser/proxy
    res.write(': connected\n\n');

    // Aggiungi client
    notificationService.addClient(res);

    // Gestione disconnessione
    req.on('close', () => {
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
        const last48h = new Date(Date.now() - 48 * 60 * 60 * 1000);

        // 1. Totale richieste e sessioni
        const totalLogs = await Log.count({ where: { timestamp: { [Op.gte]: last48h } } });
        const totalSessions = await Session.count({ where: { lastSeen: { [Op.gte]: last48h } } });

        // 2. Distribuzione categorie attacchi
        const attackStats = await Classification.findAll({
            attributes: [
                'category',
                [fn('COUNT', col('Classification.id')), 'count']
            ],
            include: [{
                model: Log,
                attributes: [],
                where: { timestamp: { [Op.gte]: last48h } },
                required: true // INNER JOIN
            }],
            group: ['Classification.category'],
            raw: true
        });

        // 3. Top IP con Risk Score aggregato
        const topIPs = await Log.findAll({
            attributes: [
                'ipAddress',
                [fn('COUNT', col('Log.id')), 'count'],
                [fn('SUM', col('Log.risk_score')), 'totalRiskScore']
            ],
            where: { timestamp: { [Op.gte]: last48h } },
            group: ['ipAddress'],
            order: [[fn('SUM', col('Log.risk_score')), 'DESC']], // Ordina per risk score
            limit: 5,
            raw: true
        });

        // 4. Time Series (Ultime 48h per ora)
        // Usa date_trunc per raggruppare per ora (PostgreSQL)
        const timeSeriesRaw = await Log.findAll({
            attributes: [
                [fn('date_trunc', 'hour', col('timestamp')), 'hour_bucket'],
                [fn('COUNT', col('id')), 'count']
            ],
            where: { timestamp: { [Op.gte]: last48h } },
            group: [fn('date_trunc', 'hour', col('timestamp'))],
            order: [[fn('date_trunc', 'hour', col('timestamp')), 'ASC']],
            raw: true
        });

        // Formatta per Recharts (es. "14:00")
        const timeSeries = timeSeriesRaw.map(entry => ({
            time: new Date(entry.hour_bucket).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            requests: parseInt(entry.count, 10)
        }));

        // 5. Analisi Fingerprint (Nuovo!)
        // Identifichiamo impronte che usano più IP diversi
        const topFingerprints = await Log.findAll({
            attributes: [
                'fingerprint',
                [fn('COUNT', fn('DISTINCT', col('ip_address'))), 'uniqueIPs'],
                [fn('COUNT', col('Log.id')), 'totalRequests'],
                [fn('MAX', col('Log.timestamp')), 'lastSeen']
            ],
            where: {
                timestamp: { [Op.gte]: last48h },
                fingerprint: { [Op.ne]: null }
            },
            group: ['fingerprint'],
            having: literal('COUNT(DISTINCT ip_address) > 0'),
            order: [[fn('COUNT', fn('DISTINCT', col('ip_address'))), 'DESC']],
            limit: 5,
            raw: true
        });

        res.json({
            period: '48h',
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
        const { limit = 50, offset = 0, category, risk_min } = req.query;
        console.log(`🔍 Logs Request: limit=${limit}, risk_min=${risk_min}, category=${category}`);

        const whereClause = {
            timestamp: { [Op.gte]: new Date(Date.now() - 48 * 60 * 60 * 1000) }
        };

        // Filtro per risk_min usa il campo riskScore del Log (non le Classifications)
        if (risk_min && parseInt(risk_min) > 0) {
            whereClause.riskScore = { [Op.gte]: parseInt(risk_min) };
        }

        // Filtro per indirizzo IP
        if (req.query.ipAddress) {
            whereClause.ipAddress = req.query.ipAddress;
        }

        // Filtro per Fingerprint (Nuovo!)
        if (req.query.fingerprint) {
            whereClause.fingerprint = req.query.fingerprint;
        }

        // Include Classifications sempre con LEFT JOIN
        // Se c'è un filtro per categoria, filtra sulle classifications
        const includeClause = [{
            model: Classification,
            required: false, // LEFT JOIN - include anche logs senza classificazioni
            ...(category && { where: { category } })
        }];

        const logs = await Log.findAndCountAll({
            where: whereClause,
            include: includeClause,
            order: [
                ['timestamp', 'DESC'], // Prima i nuovi per vedere il real-time
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

        const whereClause = { timestamp: { [Op.gte]: startTime } };
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
                                    fn('EXTRACT', fn('EPOCH', col('Log.timestamp'))),
                                    bucketSize
                                )
                            ),
                            bucketSize
                        )
                    ),
                    'time_bucket'
                ],
                [fn('COUNT', col('Log.id')), 'count']
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

