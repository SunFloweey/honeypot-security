const express = require('express');
const router = express.Router();
const HoneytokenService = require('../../services/honeytokenService');
const AIService = require('../../services/aiService');
const logQueue = require('../utils/logQueue');
const crypto = require('crypto');
const ApiKey = require('../../models/ApiKey');

/**
 * SDK Authentication Middleware (Multi-Tenant)
 * 
 * Valida la chiave API in questo ordine:
 * 1. Cerca nella tabella ApiKey del database (SaaS mode)
 * 2. Fallback: controlla ADMIN_TOKEN (retrocompatibilità)
 */
const sdkAuth = async (req, res, next) => {
    const apiKey = req.headers['x-api-key'];
    if (!apiKey) {
        return res.status(401).json({
            success: false,
            error: 'Unauthorized: Chiave API mancante (x-api-key)'
        });
    }

    // 1. Cerca nella tabella ApiKey (SaaS multi-tenant)
    try {
        const keyRecord = await ApiKey.findOne({ where: { key: apiKey, isActive: true } });

        if (keyRecord) {
            // Aggiorna lastUsedAt in background
            keyRecord.lastUsedAt = new Date();
            await keyRecord.save().catch(() => { });

            req.tenantKeyId = keyRecord.id;
            req.tenantUserId = keyRecord.userId;
            req.tenantProjectName = keyRecord.name;
            return next();
        } else {
            console.log(`🔍 [SDK Auth] Chiave non trovata o inattiva: ${apiKey.substring(0, 10)}...`);
        }
    } catch (error) {
        console.error('❌ [SDK Auth] Error:', error.message);
    }

    // 2. Fallback: ADMIN_TOKEN (retrocompatibilità)
    if (apiKey === process.env.ADMIN_TOKEN) {
        req.tenantKeyId = null;
        req.tenantUserId = null;
        req.tenantProjectName = req.headers['x-app-name'] || 'LegacyAdmin';
        return next();
    }

    console.log(`🚫 [SDK Auth] Accesso negato per chiave: ${apiKey.substring(0, 10)}... (AdminToken: ${String(process.env.ADMIN_TOKEN).substring(0, 5)}...)`);

    return res.status(401).json({
        success: false,
        error: 'Unauthorized: Chiave API non valida'
    });
};

// Apply authentication to all SDK routes
router.use(sdkAuth);

/**
 * POST /api/v1/sdk/logs
 * Ingests external logs from SDK clients.
 */
router.post('/logs', (req, res) => {
    const { event, metadata, ipAddress } = req.body;
    const appName = req.headers['x-app-name'] || 'ExternalApp';

    if (!event) {
        return res.status(400).json({ success: false, error: 'Event name is required' });
    }

    // sessionKey deve essere STRING(32) → usiamo MD5 di appName per avere un hash deterministico
    const sessionKey = req.body.sessionKey ||
        crypto.createHash('md5').update(`sdk_${appName}`).digest('hex'); // 32 char hex

    const logEntry = {
        timestamp: new Date().toISOString(),
        req: {
            id: crypto.randomUUID(), // UUID puro, senza prefissi: compatibile con PostgreSQL UUID
            sessionKey,
            method: 'SDK_REPORT',
            path: `sdk://${appName}/${event}`,
            ipAddress: ipAddress || req.ip,
            body: metadata || {},
            headers: { ...req.headers, 'user-agent': 'Honeypot-SDK/NodeJS' }
        },
        res: {
            statusCode: 200,
            durationMs: 0
        },
        isExternal: true, // Flag to distinguish SDK logs
        apiKeyId: req.tenantKeyId // Associate with the authenticated API Key
    };

    logQueue.enqueue(logEntry);

    res.json({ success: true, message: 'Event logged successfully' });
});

/**
 * GET /api/v1/sdk/honeytoken
 * Generates a new honeytoken and returns it to the client.
 */
router.get('/honeytoken', (req, res) => {
    const type = req.query.type || 'env';
    let token = {};

    switch (type.toLowerCase()) {
        case 'aws': token = HoneytokenService.generateAWSKeys(); break;
        case 'mongo': token = HoneytokenService.generateMongoCredentials(); break;
        case 'stripe': token = HoneytokenService.generateStripeKeys(); break;
        case 'jwt': token = HoneytokenService.generateJWTSecret(); break;
        default:
            const envContent = HoneytokenService.generateEnvFile();
            token = { env: envContent };
    }

    res.json({ success: true, token });
});

/**
 * POST /api/v1/sdk/analyze
 * Performs AI analysis on a suspicious payload.
 */
router.post('/analyze', async (req, res) => {
    const { payload } = req.body;

    if (!payload) {
        return res.status(400).json({ success: false, error: 'Payload is required' });
    }

    try {
        const result = await AIService.analyzePayload(payload);
        res.json({ success: true, analysis: result });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
