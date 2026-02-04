/*
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
//const AuthHelper = require('../utils/authHelper');
const logQueue = require('../utils/logQueue');
const { generateSessionKey } = require('../utils/session');

const STATIC_EXTENSIONS = new Set([
    '.css', '.js', '.jpg', '.jpeg', '.png', '.gif', '.ico', '.svg',
    '.woff', '.woff2', '.ttf', '.eot', '.map', '.txt'
]);

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
}*/

/**
 * Emergency Fallback Logger
 */
/*
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
*/
/**
 * Middleware di cattura migliorato
 */
/*
async function requestCaptureMiddleware(req, res, next) {
    // 1. SKIP VELOCE PER ASSET
    const ext = path.extname(req.path).toLowerCase();
    if (STATIC_EXTENSIONS.has(ext) || req.path.startsWith('/assets/')) {
        return next();
    }

    // 2. SETUP TRACCIAMENTO
    req.requestId = crypto.randomUUID();
    const startTime = Date.now();
    req.ipAddress = req.ip || '127.0.0.1';
    req.userAgent = req.headers['user-agent'] || '';

    // Cookie-Based Session Tracking (Sticky Sessions)
    // Tenta di recuperare la sessione da cookie (__hp_sess) per gestire utenti dietro NAT/Proxy
    let sessionKey = null;
    if (req.headers.cookie) {
        const match = req.headers.cookie.match(/__hp_sess=([a-f0-9]{32})/);
        if (match) sessionKey = match[1];
    }

    if (!sessionKey) {
        // Fallback: Genera nuova chiave basata su IP+UA
        sessionKey = generateSessionKey(req.ipAddress, req.userAgent);

        // Imposta cookie persistente (1 anno) per tracciare questo client se cambia IP
        // Nota: Usiamo una logica difensiva per non sovrascrivere altri Set-Cookie potenziali
        try {
            // Aggiunto 'Secure' e 'SameSite=Lax' per compatibilità moderna
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

    // 3. CLONAZIONE DATI (DOPO IL BODY PARSER)
    req.capturedHeaders = { ...req.headers };
    req.capturedQuery = { ...req.query };
    // req.body è disponibile perché questo middleware ora gira dopo express.json()
    req.capturedBody = redactBody(req.body);

    // 4. MONKEY PATCHING SICURO (Defensive)
    // Necessario per catturare il body della risposta per analisi forense.
    // Usiamo un flag per evitare double-patching se il middleware viene caricato più volte.
    if (!res.__honeyPatched) {
        res.__honeyPatched = true;

        const _send = res.send;
        const _json = res.json;
        const _end = res.end;
        let isCaptured = false; // Evita loop o doppie catture

        function capture(body) {
            if (isCaptured) return;
            try {
                const contentType = res.get('Content-Type') || '';
                if (body && /text|json|javascript|xml/.test(contentType)) {
                    let captured;
                    if (typeof body === 'string') captured = body;
                    else if (Buffer.isBuffer(body)) captured = body.toString('utf8');
                    else if (typeof body === 'object') captured = JSON.stringify(body);

                    if (captured) {
                        const MAX_LEN = 32768;
                        res.responseBody = captured.length > MAX_LEN
                            ? captured.substring(0, MAX_LEN) + '... [TRUNCATED]'
                            : captured;
                    }
                }
                isCaptured = true;
            } catch (e) {
                console.error('⚠️ Logger error:', e.message);
            }
        }

        // Sovrascrittura dei metodi con preservazione del contesto
        res.send = function (body) {
            capture(body);
            return _send.apply(res, arguments);
        };

        res.json = function (body) {
            capture(body);
            return _json.apply(res, arguments);
        };

        res.end = function (chunk) {
            if (chunk) capture(chunk);
            return _end.apply(res, arguments);
        };
    }

    // 5. HOOK DI PERSISTENZA
    res.on('finish', () => {
        const duration = Date.now() - startTime;

        logQueue.enqueue({
            req: {
                requestId: req.requestId,
                sessionKey: req.sessionKey,
                method: req.method,
                path: req.path,
                ipAddress: req.ipAddress,
                headers: req.capturedHeaders,
                query: req.capturedQuery,
                body: req.capturedBody
            },
            res: {
                statusCode: res.statusCode,
                responseTimeMs: duration,
                responseBody: res.responseBody
            }
        });
    });

    next();
}*/

/**
 * Redact Body con protezione anti-crash
 */
/*
function redactBody(body) {
    const MAX_DEPTH = 5; // Ridotto leggermente per performance
    const SENSITIVE_KEYS = /password|pwd|secret|token|key|apikey|credential|auth/i;

    function safeCopy(obj, depth) {
        if (depth > MAX_DEPTH) return '[TRUNCATED_DEPTH]';
        // Gestione null e tipi non object
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

module.exports = {
    requestCaptureMiddleware,
    writeToFallbackLog
};
*/

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const logQueue = require('../utils/logQueue');
const { generateSessionKey } = require('../utils/session');

const STATIC_EXTENSIONS = new Set([
    '.css', '.js', '.jpg', '.jpeg', '.png', '.gif', '.ico', '.svg',
    '.woff', '.woff2', '.ttf', '.eot', '.map', '.txt', '.pdf'
]);

/**
 * Redact Body con protezione anti-crash (Stack Overflow)
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
    // 1. SKIP VELOCE PER ASSET STATICI
    const ext = path.extname(req.path).toLowerCase();
    if (STATIC_EXTENSIONS.has(ext) || req.path.startsWith('/assets/')) {
        return next();
    }

    // 2. SETUP TRACCIAMENTO
    req.requestId = crypto.randomUUID();
    const startTime = Date.now();
    req.ipAddress = req.ip || req.headers['x-forwarded-for'] || '127.0.0.1';
    req.userAgent = req.headers['user-agent'] || '';

    // Cookie-Based Session Tracking
    let sessionKey = null;
    if (req.headers.cookie) {
        const match = req.headers.cookie.match(/__hp_sess=([a-f0-9]{32})/);
        if (match) sessionKey = match[1];
    }

    if (!sessionKey) {
        sessionKey = generateSessionKey(req.ipAddress, req.userAgent);
        try {
            // Aggiunto 'Secure' e 'SameSite=Lax' per compatibilità moderna
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
    res.on('finish', () => {
        const duration = Date.now() - startTime;
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
                body: req.capturedBody
            },
            res: {
                statusCode: res.statusCode,
                durationMs: duration,
                body: res.responseBody
            }
        });
    });

    next();
}

module.exports = {
    requestCaptureMiddleware,
    writeToFallbackLog,
    redactBody // Esportato per eventuali test unitari
};
