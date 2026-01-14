const crypto = require('crypto');
const Session = require('../../models/Session');
const Log = require('../../models/Log');
const Classifier = require('../utils/Classifier');

/**
 * Cattura TUTTI i dettagli della richiesta
 */
async function requestCaptureMiddleware(req, res, next) {
    // Timestamp preciso
    const startTime = Date.now();
    req.captureTime = new Date();

    // Estrai IP reale (considera proxy/load balancer)
    req.realIp = req.headers['x-forwarded-for']?.split(',')[0].trim()
        || req.headers['x-real-ip']
        || req.connection?.remoteAddress
        || req.socket?.remoteAddress
        || '127.0.0.1';

    // Crea fingerprint e session_key
    req.userAgent = req.headers['user-agent'] || '';
    req.session_key = generateSessionKey(req.realIp, req.userAgent);

    // Cattura e maschera dettagli
    req.capturedHeaders = { ...req.headers };
    req.capturedQuery = { ...req.query };
    req.capturedBody = redactBody(req.body);

    // Intercetta la risposta
    const originalSend = res.send;
    const originalJson = res.json;

    res.send = function (data) {
        res.responseBody = data;
        res.responseTime = Date.now() - startTime;
        return originalSend.call(this, data);
    };

    res.json = function (data) {
        res.responseBody = data;
        res.responseTime = Date.now() - startTime;
        return originalJson.call(this, data);
    };

    // Quando la risposta finisce, logga tutto nel DB
    res.on('finish', async () => {
        try {
            await logToDatabase(req, res);
        } catch (err) {
            console.error('❌ Error logging to DB:', err);
        }
    });

    next();
}

/**
 * Genera session_key (hash(ip + useragent + finestra 10 min))
 */
function generateSessionKey(ip, ua) {
    const timeWindow = Math.floor(Date.now() / (1000 * 60 * 10)); // 10 min window
    return crypto
        .createHash('sha256')
        .update(`${ip}${ua}${timeWindow}`)
        .digest('hex')
        .substring(0, 32);
}

/**
 * Maschera campi sensibili nel body (es: password)
 */
function redactBody(body) {
    if (!body || typeof body !== 'object') return body;
    const redacted = JSON.parse(JSON.stringify(body));
    const sensitiveKeys = ['password', 'pwd', 'secret', 'token', 'key', 'apikey', 'credential'];

    const traverse = (obj) => {
        for (const key in obj) {
            if (sensitiveKeys.some(sk => key.toLowerCase().includes(sk))) {
                obj[key] = '[REDACTED]';
            } else if (typeof obj[key] === 'object' && obj[key] !== null) {
                traverse(obj[key]);
            }
        }
    };

    traverse(redacted);
    return redacted;
}

/**
 * Salva i dati nel database PostgreSQL e attiva la classificazione
 */
async function logToDatabase(req, res) {
    // 1. Upsert Session
    const [session, created] = await Session.findOrCreate({
        where: { session_key: req.session_key },
        defaults: {
            ip_address: req.realIp,
            user_agent: req.userAgent,
            request_count: 1
        }
    });

    if (!created) {
        await session.increment('request_count');
        await session.update({ last_seen: new Date() });
    }

    // 2. Crea Log record
    const logRecord = await Log.create({
        session_key: req.session_key,
        method: req.method,
        path: req.path,
        query_params: req.capturedQuery,
        headers: req.capturedHeaders,
        body: typeof req.capturedBody === 'string' ? req.capturedBody : JSON.stringify(req.capturedBody),
        ip_address: req.realIp,
        status_code: res.statusCode,
        response_time_ms: res.responseTime || 0
    });

    // 3. Esegui Classificazione Avanzata
    const classifications = await Classifier.classify(req, logRecord, session);

    // Console logging per visibilità
    const color = classifications.length > 0 ? '\x1b[31m' : '\x1b[36m';
    console.log(`${color}[${new Date().toISOString()}] ${req.method} ${req.path} - ${res.statusCode} (${res.responseTime || 0}ms) [Session: ${req.session_key.substring(0, 8)}]${'\x1b[0m'}`);
}

module.exports = requestCaptureMiddleware;
