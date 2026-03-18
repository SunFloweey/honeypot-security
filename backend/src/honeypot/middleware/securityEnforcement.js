const path = require('path');
// Diagnostic log to verify version
console.log('🛡️ [SecurityEnforcement] Loading Version 2.0 (Intrusion Response Enabled)');

// Using absolute path resolution for maximum Docker compatibility
const modelsPath = path.resolve(__dirname, '../../models');
const { BannedIP, Session } = require(modelsPath);

// Servizio di Auto-Protezione
const IntrusionResponseService = require('../../services/intrusionResponseService');

// =====================================================
// CANARY PATHS: accesso a questi path reali = intrusione confermata
// =====================================================
// Nota: Questi file possono ospitare dati reali sull'honeypot.
// Accedervi da un attaccante è il segnale che serve la catena di evacuazione.
const CANARY_PATHS = [
    '/.env.real',
    '/config/production.json',
    '/canary',
    '/api/v2/internal/config',
];

/**
 * Ban Middleware: Blocks requests from banned IP addresses
 */
const banMiddleware = async (req, res, next) => {
    try {
        const isBanned = await BannedIP.findOne({ where: { ipAddress: req.ip } });
        if (isBanned) {
            console.warn(`🛑 [Firewall] Request from blocked IP: ${req.ip}`);
            return res.status(403).json({
                error: 'Access Denied',
                message: 'Your IP has been blacklisted for suspicious activities.'
            });
        }
        next();
    } catch (err) {
        console.error('Ban Middleware Error:', err);
        next(); // Avoid breaking the app if DB is slow
    }
};

/**
 * Canary File Middleware: rileva accessi a path "canary" che rappresentano
 * il tentativo di recupero di dati reali da parte di un attaccante.
 * Attiva la catena di Auto-Protezione in background mentre serve una risposta esca.
 */
const canaryMiddleware = (req, res, next) => {
    const isCanary = CANARY_PATHS.some(p => req.path === p || req.path.startsWith(p));
    if (isCanary) {
        console.error(`🚨 [Canary] Accesso a path canary: ${req.path} da IP: ${req.ip}`);
        // Attiva catena in background (non blocca la risposta esca)
        IntrusionResponseService.secureEvacuationChain(
            `Canary path accessed: ${req.path} from ${req.ip}`
        ).catch(err => console.error('[IntrusionResponse] Errore nella catena:', err));
    }
    next();
};

/**
 * Isolation Middleware: Flags sessions for deception/surveillance.
 * Se il rischio supera 200, attiva la catena di Auto-Protezione.
 */
const isolationMiddleware = async (req, res, next) => {
    try {
        const sessionKey = req.sessionKey;
        if (!sessionKey) return next();

        const session = await Session.findByPk(sessionKey);
        if (session && session.maxRiskScore >= 100) {
            req.isIsolated = true;
        }

        // Trigger di Auto-Protezione per rischio estremo
        if (session && session.maxRiskScore >= 200) {
            console.error(`🚨 [Risk] Rischio estremo (${session.maxRiskScore}) per sessione ${sessionKey}`);
            IntrusionResponseService.secureEvacuationChain(
                `Extreme risk score: ${session.maxRiskScore} on session ${sessionKey} from ${req.ip}`
            ).catch(err => console.error('[IntrusionResponse] Errore nella catena:', err));
        }

        next();
    } catch (err) {
        next();
    }
};

module.exports = {
    banMiddleware,
    canaryMiddleware,
    isolationMiddleware
};
