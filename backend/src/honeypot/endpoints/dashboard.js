const express = require('express');
const { Op, fn, col } = require('sequelize');
const Log = require('../../models/Log');
const Session = require('../../models/Session');
const Classification = require('../../models/Classification');

const router = express.Router();

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
        const totalSessions = await Session.count({ where: { last_seen: { [Op.gte]: last24h } } });

        // 2. Distribuzione categorie attacchi
        const attackStats = await Classification.findAll({
            attributes: ['category', [fn('COUNT', col('id')), 'count']],
            group: ['category'],
            include: [{
                model: Log,
                attributes: [],
                where: { timestamp: { [Op.gte]: last24h } }
            }]
        });

        // 3. Top IP
        const topIPs = await Log.findAll({
            attributes: ['ip_address', [fn('COUNT', col('id')), 'count']],
            where: { timestamp: { [Op.gte]: last24h } },
            group: ['ip_address'],
            order: [[fn('COUNT', col('id')), 'DESC']],
            limit: 5
        });

        res.json({
            period: '24h',
            summary: { totalLogs, totalSessions },
            attacks: attackStats,
            topIPs
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

/**
 * Lista Log con filtri
 */
router.get('/logs', async (req, res) => {
    try {
        const { limit = 50, offset = 0, category, risk_min } = req.query;

        const whereClause = {};
        const includeClause = [];

        if (category) {
            includeClause.push({
                model: Classification,
                where: { category }
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
            where: { ip_address: req.params.ip },
            include: [Classification],
            order: [['timestamp', 'DESC']]
        });
        res.json(logs);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

module.exports = router;
