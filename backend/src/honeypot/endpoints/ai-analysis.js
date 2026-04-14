const express = require('express');
const router = express.Router();
const Session = require('../../models/Session');
const Log = require('../../models/Log');
const AIService = require('../../services/aiService');
const HoneytokenService = require('../../services/honeytokenService');

const { adminAuthMiddleware } = require('../middleware/adminAuth');
const { ApiKey } = require('../../models');
const { Op } = require('sequelize');

// Apply auth to all routes
router.use(adminAuthMiddleware);

/**
 * Helper: Crea filtro where per isolamento tenant (condiviso con dashboard.js)
 */
async function getTenantFilter(req) {
    if (req.user && req.user.isGlobal) return {};
    if (req.user && req.user.userId) {
        const userKeys = await ApiKey.findAll({
            where: { userId: req.user.userId },
            attributes: ['id']
        });
        return { apiKeyId: { [Op.in]: userKeys.map(k => k.id) } };
    }
    return { apiKeyId: '00000000-0000-0000-0000-000000000000' };
}

// ==========================================
// SESSION ANALYSIS (Deep Forensic)
// ==========================================
router.post('/session', async (req, res) => {
    try {
        const { sessionKey } = req.body;
        if (!sessionKey) return res.status(400).json({ error: 'Session Key is required' });

        const tenantClause = await getTenantFilter(req);

        const session = await Session.findOne({
            where: { sessionKey },
            include: [{
                model: Log,
                where: tenantClause, // FILTRO TENANT: Analizza solo i log che appartengono al cliente
                required: true,
                attributes: ['method', 'path', 'timestamp', 'statusCode', 'body', 'queryParams', 'leakedIp', 'localIp'],
                order: [['timestamp', 'ASC']]
            }]
        });

        if (!session) {
            return res.status(404).json({ error: 'Session not found or access denied' });
        }

        const analysis = await AIService.analyzeSession(session);
        return res.json(analysis);

    } catch (error) {
        console.error('❌ Endpoint Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// ==========================================
// ON-DEMAND PAYLOAD DECODE
// ==========================================

/**
 * POST /api/ai/decode-payload
 * 
 * Decodes and analyzes a potentially obfuscated payload.
 * Supports two modes:
 *   - 'full': Local decoder + AI (slower, more detailed)
 *   - 'light': Local decoder only (instant, no API cost)
 * 
 * Body: { payload: string, mode?: 'full' | 'light' }
 */
router.post('/decode-payload', async (req, res) => {
    try {
        const { payload, mode = 'full' } = req.body;

        if (!payload || typeof payload !== 'string') {
            return res.status(400).json({ error: 'Payload string is required' });
        }

        if (payload.length > 50000) {
            return res.status(400).json({ error: 'Payload too large (max 50KB)' });
        }

        console.log(`🔍 [Payload Decode] Mode: ${mode}, Length: ${payload.length} chars`);

        let analysis;
        if (mode === 'light') {
            analysis = AIService.analyzePayloadLight(payload);
        } else {
            analysis = await AIService.analyzePayload(payload, true); // forceAI = true
        }

        if (!analysis) {
            return res.status(200).json({
                technique: 'None Detected',
                decoded_script: payload,
                explanation: 'No obfuscation or suspicious patterns detected.',
                indicators: { ips: [], domains: [], urls: [], files: [] },
                risk_level: 0,
                analysis_source: mode,
            });
        }

        return res.json(analysis);

    } catch (error) {
        console.error('❌ Decode Payload Error:', error);
        res.status(500).json({ error: 'Analysis failed', details: error.message });
    }
});

// ==========================================
// HONEYTOKEN MONITORING
// ==========================================

/**
 * GET /api/ai/honeytokens/summary
 * Returns the current state of all active honeytokens and usage events.
 */
router.get('/honeytokens/summary', async (req, res) => {
    try {
        const filter = req.user.isGlobal ? {} : { userId: req.user.userId };
        const summary = await HoneytokenService.getTokenSummary(filter);
        res.json(summary);
    } catch (error) {
        console.error('❌ Honeytoken Summary Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

/**
 * POST /api/ai/honeytokens/check
 * Checks if a credential matches any known honeytoken.
 * 
 * Body: { credential: string }
 */
router.post('/honeytokens/check', (req, res) => {
    try {
        const { credential } = req.body;
        if (!credential) {
            return res.status(400).json({ error: 'Credential string is required' });
        }

        const match = HoneytokenService.checkToken(credential);
        res.json({
            isHoneytoken: !!match,
            details: match || null,
        });
    } catch (error) {
        console.error('❌ Honeytoken Check Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

module.exports = router;