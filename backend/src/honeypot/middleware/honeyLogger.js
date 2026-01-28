const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const AuthHelper = require('../utils/authHelper');
const logQueue = require('../utils/logQueue');
const { generateSessionKey } = require('../utils/session');

// ==========================================
// MIDDLEWARE HONEYPOT
// ==========================================

/**
 * Emergency Fallback Logger: Writes to file if DB is down.
 */
function writeToFallbackLog(data) {
    const logDir = path.join(process.cwd(), 'logs');
    if (!fs.existsSync(logDir)) fs.mkdirSync(logDir);

    const filePath = path.join(logDir, 'emergency.log');
    const entry = `[${new Date().toISOString()}] EMERGENCY LOG: ${JSON.stringify(data)}\n`;
    fs.appendFileSync(filePath, entry);
    console.error('⚠️ DB Logging Failed (Captured in emergency.log)');
}

/**
 * Intercetta e Cattura TUTTI i dettagli della richiesta
 */
async function requestCaptureMiddleware(req, res, next) {
    // 0. QUICK SKIP: Ignora asset statici per risparmiare risorse e ridurre rumore nel DB
    const isStatic = req.path.match(/\.(css|js|jpg|jpeg|png|gif|ico|svg|woff|woff2|ttf|eot|map)$/i)
        || req.path.startsWith('/assets/')
        || req.path.includes('hot-update');

    if (isStatic) return next();

    // Traceability: Genera un RequestID unico per l'intero ciclo di vita della richiesta
    req.requestId = crypto.randomUUID();

    const startTime = Date.now();
    req.captureTime = new Date();

    // SMART EXCLUSION: Log traffic for researchers only if authenticated
    const adminPaths = ['/stats', '/real-dashboard', '/researcher-login'];
    const isAdminPath = adminPaths.some(p => req.path.startsWith(p));

    if (isAdminPath) {
        const ADMIN_TOKEN = process.env.ADMIN_TOKEN;
        const token = req.headers['x-admin-token'];

        if (AuthHelper.isTokenValid(token, ADMIN_TOKEN)) {
            return next();
        }
    }

    // Extract real IP (Express handles this securely via 'trust proxy' setting)
    req.ipAddress = req.ip || '127.0.0.1';

    // Generate Fingerprint & Session Key
    req.userAgent = req.headers['user-agent'] || '';
    // Use centralized session key generation
    req.sessionKey = generateSessionKey(req.ipAddress, req.userAgent);

    req.capturedHeaders = { ...req.headers };
    req.capturedQuery = { ...req.query };
    req.capturedBody = redactBody(req.body);

    // SAFER RESPONSE CAPTURE: Override res.send
    const originalSend = res.send;

    res.send = function (body) {
        const contentType = res.get('Content-Type') || '';
        const isText = contentType.includes('text') || contentType.includes('json') || contentType.includes('javascript') || contentType.includes('xml');

        if (body && isText) {
            if (typeof body === 'string') {
                res.responseBody = body;
            } else if (Buffer.isBuffer(body)) {
                res.responseBody = body.toString('utf8');
            } else if (typeof body === 'object') {
                res.responseBody = JSON.stringify(body);
            }

            const maxLength = 32 * 1024; // 32KB
            if (res.responseBody && res.responseBody.length > maxLength) {
                res.responseBody = res.responseBody.substring(0, maxLength) + '... [TRUNCATED]';
            }
        }

        return originalSend.apply(res, arguments);
    };

    // DB Logging Hook
    res.on('finish', () => {
        res.responseTimeMs = Date.now() - startTime;

        // ASYNC ENQUEUE: Offload heavy DB operations to a background worker
        logQueue.enqueue({
            req: {
                requestId: req.requestId,
                sessionKey: req.sessionKey,
                method: req.method,
                path: req.path,
                ipAddress: req.ipAddress,
                userAgent: req.userAgent,
                capturedHeaders: req.capturedHeaders,
                capturedQuery: req.capturedQuery,
                capturedBody: req.capturedBody
            },
            res: {
                statusCode: res.statusCode,
                responseTimeMs: res.responseTimeMs,
                responseBody: res.responseBody
            },
            sessionMetadata: {
                fingerprint: req.body?.fingerprint || null
            }
        });
    });

    next();
}

/**
 * Safer Body Redaction
 * Creates a redacted copy without expensive JSON serialization/deserialization.
 * Enforces depth limits to prevent stack overflow from malicious payloads.
 */
function redactBody(body) {
    const MAX_DEPTH = 10;
    const SENSITIVE_KEYS = /password|pwd|secret|token|key|apikey|credential/i;

    function safeCopy(obj, depth) {
        if (depth > MAX_DEPTH) return '[TRUNCATED_DEPTH]';
        if (!obj || typeof obj !== 'object') return obj;

        if (Array.isArray(obj)) {
            return obj.map(item => safeCopy(item, depth + 1));
        }

        const newObj = {};
        for (const key in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, key)) {
                if (SENSITIVE_KEYS.test(key)) {
                    newObj[key] = '[REDACTED]';
                } else {
                    newObj[key] = safeCopy(obj[key], depth + 1);
                }
            }
        }
        return newObj;
    }

    return safeCopy(body, 0);
}

module.exports = requestCaptureMiddleware;


