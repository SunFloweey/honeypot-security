const express = require('express');
const { Op, fn, col } = require('sequelize');
const Log = require('../../models/Log');
const Session = require('../../models/Session');
const Classification = require('../../models/Classification');
const adminAuthMiddleware = require('../middleware/adminAuth');

const router = express.Router();

// FORNISCE DATI REALI alla dashboard reale 

// Proteggi TUTTE le rotte di questo router
router.use(adminAuthMiddleware);

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
        const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

        // 1. Totale richieste e sessioni
        const totalLogs = await Log.count({ where: { timestamp: { [Op.gte]: last24h } } });
        const totalSessions = await Session.count({ where: { lastSeen: { [Op.gte]: last24h } } });

        // 2. Distribuzione categorie attacchi
        const attackStats = await Classification.findAll({
            attributes: [
                'category',
                [fn('COUNT', col('Classification.id')), 'count']
            ],
            include: [{
                model: Log,
                attributes: [],
                where: { timestamp: { [Op.gte]: last24h } },
                required: true // INNER JOIN
            }],
            group: ['Classification.category'],
            raw: true
        });

        // 3. Top IP
        const topIPs = await Log.findAll({
            attributes: [
                'ipAddress',
                [fn('COUNT', col('Log.id')), 'count']
            ],
            where: { timestamp: { [Op.gte]: last24h } },
            group: ['ipAddress'],
            order: [[fn('COUNT', col('Log.id')), 'DESC']],
            limit: 5,
            raw: true
        });

        res.json({
            period: '24h',
            summary: { totalLogs, totalSessions },
            attacks: attackStats,
            topIPs
        });
    } catch (err) {
        console.error('❌ Overview Error:', err);
        res.status(500).json({ error: 'Internal Server Error', message: err.message });
    }
});

/**
 * Lista Log con filtri
 */
router.get('/logs', async (req, res) => {
    try {
        const { limit = 50, offset = 0, category, risk_min } = req.query;
        console.log(`🔍 Logs Request: limit=${limit}, risk_min=${risk_min}, category=${category}`);

        const whereClause = {};
        const includeClause = [];

        if (category) {
            includeClause.push({
                model: Classification,
                where: { category }
            });
        } else if (risk_min && parseInt(risk_min) > 0) {
            includeClause.push({
                model: Classification,
                where: { riskScore: { [Op.gte]: parseInt(risk_min) } }
            });
        } else {
            includeClause.push({ model: Classification });
        }

        const logs = await Log.findAndCountAll({
            where: whereClause,
            include: includeClause,
            order: [['timestamp', 'DESC']],
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
 * Cronologia IP
 */
router.get('/ip/:ip', async (req, res) => {
    try {
        const logs = await Log.findAll({
            where: { ipAddress: req.params.ip },
            include: [Classification],
            order: [['timestamp', 'DESC']]
        });
        res.json(logs);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal Server Error' });
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

