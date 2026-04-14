const express = require('express');
const router = express.Router();
const HoneytokenService = require('../../services/honeytokenService');
const AIService = require('../../services/aiService');
const IntrusionResponseService = require('../../services/intrusionResponseService');
const logQueue = require('../utils/logQueue');
const crypto = require('crypto');
const ApiKey = require('../../models/ApiKey');
const VirtualTerminal = require('../../services/virtualTerminal');
const { validateZod, schemas } = require('../../middleware/zodValidator');
const rateLimit = require('express-rate-limit');

/**
 * Rate Limiter differenziato per l'SDK.
 * Logica: /logs è leggero (solo enqueue in memoria) → soglia alta.
 * /analyze chiama LLM → soglia molto bassa per prevenire abuso dei costi AI.
 */
const makeRateLimiter = (max, windowMs = 60 * 1000) => rateLimit({
    windowMs,
    max,
    keyGenerator: (req) => req.tenantKeyId || req.ip,
    handler: (req, res) => {
        console.warn('[RateLimit] Superato per tenant:', req.tenantProjectName || req.ip);
        res.status(429).json({ success: false, error: 'Troppe richieste. Riprova tra poco.' });
    },
    standardHeaders: true,
    legacyHeaders: false,
});

const sdkLogLimiter     = makeRateLimiter(200);       // 200 log/min per tenant
const sdkDefaultLimiter = makeRateLimiter(60);        // 60 req/min per rotte generali
const sdkAiLimiter      = makeRateLimiter(10);        // 10 req/min per analisi AI (costo alto)

/**
 * SDK Authentication Middleware (Multi-Tenant - Hardened)
 *
 * ZERO TRUST: Autenticazione esclusivamente via database.
 * Nessun fallback su token statici (eliminato ADMIN_TOKEN bypass).
 *
 * Anti-Timing Attack: uso di crypto.timingSafeEqual per confronto API key.
 * Ogni richiesta autenticata popola req.tenant con dati verificati dal DB.
 */
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
    console.error('❌ [FATAL] JWT_SECRET non configurato. Il server non può partire in modo sicuro.');
    process.exit(1);
}

/**
 * Confronto API key in tempo costante per prevenire Timing Attacks.
 * Entrambi i buffer devono avere la stessa lunghezza per timingSafeEqual.
 * @param {string} provided - Chiave fornita dal client
 * @param {string} stored - Chiave nel database
 * @returns {boolean}
 */
function timingSafeCompare(provided, stored) {
    try {
        // Se le lunghezze differiscono, il timing è già leakato dal branch.
        // Usiamo un hash per normalizzare la lunghezza prima del confronto.
        const providedBuf = crypto.createHash('sha256').update(provided).digest();
        const storedBuf = crypto.createHash('sha256').update(stored).digest();
        return crypto.timingSafeEqual(providedBuf, storedBuf);
    } catch {
        return false;
    }
}

const sdkAuth = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    const rawApiKey = req.headers['x-api-key'];

    // --- Ramo 1: Bearer JWT (utenti SaaS autenticati tramite login) ---
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        try {
            const decoded = jwt.verify(token, JWT_SECRET);
            // Popola req.tenant come oggetto strutturato e immutabile
            req.tenant = Object.freeze({
                keyId: null,
                userId: decoded.sub || decoded.userId,
                projectName: req.headers['x-app-name'] || 'SaaS-JWT',
                scopes: decoded.scope || [],
                authMethod: 'jwt'
            });
            // Retrocompatibilità con codice che usa i vecchi campi flat
            req.tenantKeyId = req.tenant.keyId;
            req.tenantUserId = req.tenant.userId;
            req.tenantProjectName = req.tenant.projectName;
            return next();
        } catch (err) {
            // Non esponiamo il motivo specifico del fallimento JWT
            console.warn('[SDK Auth] JWT rifiutato:', err.constructor.name);
            return res.status(401).json({ success: false, error: 'Token non valido o scaduto' });
        }
    }

    // --- Ramo 2: API Key da header x-api-key (integrazione SDK diretta) ---
    if (!rawApiKey) {
        return res.status(401).json({
            success: false,
            error: 'Autenticazione richiesta: Bearer token o header x-api-key'
        });
    }

    // Validazione formato minima prima di interrogare il DB (evita query inutili)
    if (typeof rawApiKey !== 'string' || rawApiKey.length < 20 || rawApiKey.length > 128) {
        return res.status(401).json({ success: false, error: 'Formato chiave API non valido' });
    }

    try {
        // Cerchiamo TUTTE le chiavi attive e confrontiamo in tempo costante.
        // NON usiamo { where: { key: rawApiKey } } per evitare che il DB
        // faccia il confronto con timing dipendente dalla lunghezza del match.
        // In produzione ad alto volume, usare un indice su un hash della chiave.
            const { Op } = require('sequelize');
            const keyRecord = await ApiKey.findOne({
                where: { 
                    isActive: true,
                    key: {
                        [Op.startsWith]: rawApiKey.substring(0, 8)
                    }
                },
            attributes: ['id', 'key', 'userId', 'name', 'lastUsedAt']
        }).catch(() => null);

        if (keyRecord && timingSafeCompare(rawApiKey, keyRecord.key)) {
            // Aggiornamento asincrono non bloccante
            ApiKey.update({ lastUsedAt: new Date() }, { where: { id: keyRecord.id } })
                .catch((e) => console.warn('[SDK Auth] lastUsedAt update failed:', e.message));

            req.tenant = Object.freeze({
                keyId: keyRecord.id,
                userId: keyRecord.userId,
                projectName: keyRecord.name,
                scopes: ['sdk:write'],
                authMethod: 'api-key'
            });
            req.tenantKeyId = req.tenant.keyId;
            req.tenantUserId = req.tenant.userId;
            req.tenantProjectName = req.tenant.projectName;
            return next();
        }
    } catch (error) {
        // Log interno dettagliato, risposta generica all'esterno
        console.error('[SDK Auth] Errore DB durante autenticazione:', error.message);
        return res.status(503).json({ success: false, error: 'Servizio temporaneamente non disponibile' });
    }

    // Risposta generica per non rivelare se la chiave esiste o meno (anti-enumeration)
    return res.status(401).json({ success: false, error: 'Autenticazione fallita' });
};

// Autenticazione su tutte le rotte SDK
router.use(sdkAuth);

/**
 * POST /api/v1/sdk/logs
 * Ingestione log dall'SDK client.
 * Rate limiting 200/min per tenant (operazione leggera: solo enqueue).
 * Validazione Zod garantisce schema rigido prima di entrare nel sistema.
 */
router.post('/logs', sdkLogLimiter, validateZod(schemas.sdkLog), (req, res) => {
    const { event, metadata, ipAddress } = req.body;
    const appName = req.headers['x-app-name'] || 'ExternalApp';

    const sessionKey = req.body.sessionKey ||
        crypto.createHash('md5').update(`sdk_${appName}`).digest('hex');

    // Filtriamo gli header prima di accodarli: rimuoviamo i token per non salvarli nel DB
    const safeHeaders = { 'user-agent': req.headers['user-agent'] || 'Honeypot-SDK' };

    const logEntry = {
        timestamp: new Date().toISOString(),
        req: {
            id: crypto.randomUUID(),
            sessionKey,
            method: 'SDK_REPORT',
            path: `sdk://${appName}/${event}`,
            ipAddress: ipAddress || req.ip,
            body: metadata || {},
            headers: safeHeaders  // Solo header non sensibili
        },
        res: { statusCode: 200, durationMs: 0 },
        isExternal: true,
        apiKeyId: req.tenantKeyId
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

    const context = { apiKeyId: req.tenantKeyId };

    switch (type.toLowerCase()) {
        case 'aws': token = HoneytokenService.generateAWSKeys(context); break;
        case 'mongo': token = HoneytokenService.generateMongoCredentials(context); break;
        case 'stripe': token = HoneytokenService.generateStripeKeys(context); break;
        case 'jwt': token = HoneytokenService.generateJWTSecret(context); break;
        default:
            const envContent = HoneytokenService.generateEnvFile(context);
            token = { env: envContent };
    }

    res.json({ success: true, token });
});

/**
 * POST /api/v1/sdk/analyze
 * Performs AI analysis on a suspicious payload.
 * Rate limit molto basso (10/min): ogni chiamata invoca un LLM esterno.
 */
router.post('/analyze', sdkAiLimiter, validateZod(schemas.aiAnalyze), async (req, res) => {
    const { payload } = req.body;

    try {
        const result = await AIService.analyzePayload(payload);
        res.json({ success: true, analysis: result });
    } catch (error) {
        console.error('[SDK /analyze] AI analysis failed:', error.message);
        res.status(500).json({ success: false, error: 'Analysis service unavailable' });
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
