const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const logQueue = require('../utils/logQueue');
const { generateSessionKey } = require('../utils/session');
const AIService = require('../../services/aiService');
const ApiKey = require('../../models/ApiKey');

const STATIC_EXTENSIONS = new Set([
    '.css', '.js', '.jpg', '.jpeg', '.png', '.gif', '.ico', '.svg',
    '.woff', '.woff2', '.ttf', '.eot', '.map', '.txt', '.pdf'
]);

/**
 * Genera un Fingerprint unico basato sui parametri del browser
 */
function generateFingerprint(req) {
    const headers = req.headers || {};

    // Elementi che compongono l'impronta:
    // 1. User Agent (identifica browser e OS)
    // 2. Accept-Language (identifica lingua/regione)
    // 3. Ordine delle chiavi degli header (molto difficile da falsificare correttamente)
    const fingerprintString = [
        headers['user-agent'] || 'none',
        headers['accept-language'] || 'none',
        Object.keys(headers).join(',')
    ].join('|');

    return crypto.createHash('sha256').update(fingerprintString).digest('hex');
}

/**
 * Redact Body con protezione anti-crash
 */
function redactBody(body, maxDepth = 5) {
    const SENSITIVE_KEYS = /password|pwd|secret|token|key|apikey|credential|auth/i;

    function safeCopy(obj, depth) {
        if (depth > maxDepth) return '[TRUNCATED_DEPTH]';
        if (obj === null || typeof obj !== 'object') return obj;

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

/**
 * Emergency Fallback Logger
 */
async function writeToFallbackLog(data) {
    try {
        const logDir = path.join(process.cwd(), 'logs');
        await fs.promises.mkdir(logDir, { recursive: true });
        const filePath = path.join(logDir, 'emergency.log');
        const entry = `[${new Date().toISOString()}] EMERGENCY: ${JSON.stringify(data)}\n`;
        await fs.promises.appendFile(filePath, entry, 'utf8');
    } catch (err) {
        console.error('❌ CRITICAL: Emergency logger failed!', err.message);
    }
}

/**
 * Middleware di cattura: Traccia richieste e risposte
 */
async function requestCaptureMiddleware(req, res, next) {
    // 1. SKIP VELOCE PER ASSET STATICI E RICHIESTE DASHBOARD
    const ext = path.extname(req.path).toLowerCase();
    const isAdminApi = req.path.startsWith('/api/overview') ||
        req.path.startsWith('/api/logs') ||
        req.path.startsWith('/api/stream') ||
        req.path.startsWith('/api/ai');

    if (STATIC_EXTENSIONS.has(ext) || req.path.startsWith('/assets/') || isAdminApi) {
        return next();
    }

    // 2. SETUP TRACCIAMENTO
    req.requestId = crypto.randomUUID();
    const startTime = Date.now();
    req.ipAddress = req.ip || req.headers['x-forwarded-for'] || '127.0.0.1';
    req.userAgent = req.headers['user-agent'] || '';

    // GENERAZIONE FINGERPRINT
    req.fingerprint = generateFingerprint(req);

    // SaaS Multi-tenant Check
    req.tenantKeyId = null;
    const apiKey = req.headers['x-api-key'];
    if (apiKey) {
        try {
            const keyRecord = await ApiKey.findOne({ where: { key: apiKey, isActive: true } });
            if (keyRecord) {
                req.tenantKeyId = keyRecord.id;
                keyRecord.update({ lastUsedAt: new Date() }).catch(() => { });
            }
        } catch (err) {
            // Silently fail auth check for decoys
        }
    }

    // Cookie-Based Session Tracking
    let sessionKey = null;
    if (req.headers.cookie) {
        const match = req.headers.cookie.match(/__hp_sess=([a-f0-9]{32})/);
        if (match) sessionKey = match[1];
    }

    if (!sessionKey) {
        sessionKey = generateSessionKey(req.ipAddress, req.userAgent);
        try {
            const isSecure = req.secure || req.headers['x-forwarded-proto'] === 'https';
            const cookieOptions = [
                `__hp_sess=${sessionKey}`,
                'Path=/',
                'HttpOnly',
                'SameSite=Strict',
                'Max-Age=31536000',
                isSecure ? 'Secure' : ''
            ].filter(Boolean).join('; ');

            const prevCookies = res.getHeader('Set-Cookie') || [];
            res.setHeader('Set-Cookie', Array.isArray(prevCookies) ? [...prevCookies, cookieOptions] : [prevCookies, cookieOptions]);
        } catch (e) {
            console.error('⚠️ Failed to set session cookie:', e.message);
        }
    }
    req.sessionKey = sessionKey;

    // 3. CAPTURE REQUEST DATA
    req.capturedHeaders = { ...req.headers };
    req.capturedQuery = { ...req.query };
    req.capturedBody = req.body ? redactBody(req.body) : null;

    // LOGICA DI ANALISI PAYLOAD (Threat Intelligence)
    const rawPayload = JSON.stringify(req.capturedQuery) + JSON.stringify(req.capturedBody);

    // Verifichiamo se il payload sembra sospetto (offuscamento, shell, comandi)
    const isSuspicious = /powershell|base64|cmd\.exe|eval\(|exec\(|bash|sh\s-c/i.test(rawPayload);

    if (isSuspicious) {
        // Avviamo l'analisi in background per non bloccare la risposta all'attaccante
        // Ma ci assicuriamo che req.threatIntel sia pronto prima del 'finish'
        req.threatIntelPromise = AIService.analyzePayload(rawPayload)
            .catch(err => ({ error: "Analisi IA fallita", details: err.message }));
    }

    // 4. MONKEY PATCHING RISPOSTA
    if (!res.__honeyPatched) {
        res.__honeyPatched = true;
        const _send = res.send;
        const _json = res.json;
        let isCaptured = false;

        const capture = (body) => {
            if (isCaptured) return;
            try {
                const contentType = res.get('Content-Type') || '';
                if (body && /json|text|javascript|xml/.test(contentType)) {
                    let data;
                    if (typeof body === 'string') data = body;
                    else if (Buffer.isBuffer(body)) data = body.toString('utf8');
                    else data = JSON.stringify(body);

                    const MAX_LEN = 32768; // 32KB limit per response body
                    res.responseBody = data.length > MAX_LEN
                        ? data.substring(0, MAX_LEN) + '... [TRUNCATED]'
                        : data;
                }
                isCaptured = true;
            } catch (e) { /* Silently fail logging */ }
        };

        res.send = function (body) { capture(body); return _send.apply(res, arguments); };
        res.json = function (body) { capture(body); return _json.apply(res, arguments); };
    }

    // 5. SALVATAGGIO ASINCRONO AL TERMINE
    res.on('finish', async () => {
        const duration = Date.now() - startTime;

        // Recuperiamo l'analisi IA se disponibile
        let threatIntel = null;
        if (req.threatIntelPromise) {
            threatIntel = await req.threatIntelPromise;
        }

        logQueue.enqueue({
            timestamp: new Date().toISOString(),
            req: {
                id: req.requestId,
                sessionKey: req.sessionKey,
                method: req.method,
                path: req.path,
                ipAddress: req.ipAddress,
                headers: req.capturedHeaders,
                query: req.capturedQuery,
                body: req.capturedBody,
                fingerprint: req.fingerprint, // Passo il fingerprint alla coda
                threatIntel: threatIntel
            },
            res: {
                statusCode: res.statusCode,
                durationMs: duration,
                body: res.responseBody
            },
            apiKeyId: req.tenantKeyId
        });
    });

    next();
}

module.exports = {
    requestCaptureMiddleware,
    writeToFallbackLog,
    redactBody
};
