const express = require('express');
const router = express.Router();
const HoneytokenService = require('../../services/honeytokenService');
const AIService = require('../../services/aiService');
const IntrusionResponseService = require('../../services/intrusionResponseService');
const logQueue = require('../utils/logQueue');
const crypto = require('crypto');
const ApiKey = require('../../models/ApiKey');
const VirtualTerminal = require('../../services/virtualTerminal');

/**
 * SDK Authentication Middleware (Multi-Tenant)
 * 
 * Valida la chiave API in questo ordine:
 * 1. Cerca nella tabella ApiKey del database (SaaS mode)
 * 2. Fallback: controlla ADMIN_TOKEN (retrocompatibilità)
 */
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || process.env.ADMIN_TOKEN;

const sdkAuth = async (req, res, next) => {
    let apiKey = req.headers['x-api-key'];
    const authHeader = req.headers.authorization;

    // 1. Supporto per Bearer Token (JWT)
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        
        // Se è l'admin token statico
        if (token === process.env.ADMIN_TOKEN) {
            req.tenantKeyId = null;
            req.tenantUserId = null;
            req.tenantProjectName = req.headers['x-app-name'] || 'LegacyAdmin';
            return next();
        }

        try {
            const decoded = jwt.verify(token, JWT_SECRET);
            req.tenantUserId = decoded.sub || decoded.userId;
            req.tenantProjectName = req.headers['x-app-name'] || 'SaaS-App';
            req.scopes = decoded.scope || [];
            
            // Per il multitenancy basato su chiavi vecchie, cerchiamo se c'è una chiave associata
            // In futuro il token potrebbe includere direttamente il projectId/keyId
            return next();
        } catch (err) {
            console.warn(`[SDK Auth] JWT non valido: ${err.message}`);
        }
    }

    if (!apiKey) {
        return res.status(401).json({
            success: false,
            error: 'Unauthorized: Autenticazione richiesta (Bearer token o x-api-key)'
        });
    }

    // 2. Cerca nella tabella ApiKey (SaaS multi-tenant legacy)
    try {
        const keyRecord = await ApiKey.findOne({ where: { key: apiKey, isActive: true } });

        if (keyRecord) {
            keyRecord.lastUsedAt = new Date();
            await keyRecord.save().catch(() => { });

            req.tenantKeyId = keyRecord.id;
            req.tenantUserId = keyRecord.userId;
            req.tenantProjectName = keyRecord.name;
            return next();
        }
    } catch (error) {
        console.error('❌ [SDK Auth] Error:', error.message);
    }

    // 3. Fallback: ADMIN_TOKEN (retrocompatibilità x-api-key)
    if (apiKey === process.env.ADMIN_TOKEN) {
        req.tenantKeyId = null;
        req.tenantUserId = null;
        req.tenantProjectName = req.headers['x-app-name'] || 'LegacyAdmin';
        return next();
    }

    return res.status(401).json({
        success: false,
        error: 'Unauthorized: Chiave API o Token non valido'
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

/**
 * POST /api/v1/sdk/evacuate
 * Triggers the Intrusion Response Evacuation Chain manually via SDK.
 * Only accessible with a valid API key.
 */
router.post('/evacuate', async (req, res) => {
    const { reason } = req.body;
    const appName = req.headers['x-app-name'] || 'SDK-Client';

    console.log(`📡 [SDK] Trigger di evacuazione richiesto da: ${appName}`);

    // Avvia la catena in background per non bloccare la risposta HTTP
    IntrusionResponseService.secureEvacuationChain(`SDK Trigger: ${reason || 'Manual activation'} (App: ${appName})`)
        .catch(err => console.error('❌ [SDK Evacuation Error]:', err));

    res.json({ 
        success: true, 
        message: 'Evacuation chain triggered successfully. Data protection in progress.',
        status: 'PROTECTION_STARTED'
    });
});

/**
 * POST /api/v1/sdk/terminal
 * Proxy for virtual terminal execution from SDK clients.
 */
router.post('/terminal', async (req, res) => {
    const { command, sessionKey, entryPath, isIsolated } = req.body;
    const ip = req.body.ip || req.ip;

    if (!command) {
        return res.status(400).json({ success: false, error: 'Command is required' });
    }

    try {
        const result = await VirtualTerminal.execute(sessionKey || ip, command, {
            entryPath: entryPath || 'sdk-terminal',
            ip: ip,
            isIsolated: !!isIsolated,
            apiKeyId: req.tenantKeyId,
            userId: req.tenantUserId
        });

        res.json({ success: true, ...result });
    } catch (error) {
        console.error('❌ [SDK Terminal] Error:', error.message);
        res.status(500).json({ success: false, error: 'Terminal execution failed' });
    }
});

/**
 * POST /api/v1/sdk/deceive
 * Generates a deceptive AI response for a specific attack.
 */
router.post('/deceive', async (req, res) => {
    const { method, path, query, body } = req.body;
    
    try {
        console.log(`[SDK-DECEPTION] Generando finta risposta per: ${path}`);
        const fakeData = await AIService.getDeceptiveResponse({ 
            method: method || 'GET', 
            path: path || '/', 
            query: query || {}, 
            body: body || {} 
        });
        
        res.json({ success: true, deception: fakeData });
    } catch (error) {
        console.error('❌ [SDK Deception] Error:', error.message);
        res.status(500).json({ success: false, error: 'Deception generation failed' });
    }
});

module.exports = router;
