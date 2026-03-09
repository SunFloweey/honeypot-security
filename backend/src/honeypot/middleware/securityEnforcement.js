const path = require('path');
// Diagnostic log to verify version
console.log('🛡️ [SecurityEnforcement] Loading Version 1.1 (Fixed Paths)');

// Using absolute path resolution for maximum Docker compatibility
const modelsPath = path.resolve(__dirname, '../../models');
const { BannedIP, Session } = require(modelsPath);

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
 * Isolation Middleware: Flags sessions for deception/surveillance
 */
const isolationMiddleware = async (req, res, next) => {
    try {
        const sessionKey = req.sessionKey;
        if (!sessionKey) return next();

        const session = await Session.findByPk(sessionKey);
        if (session && session.maxRiskScore >= 100) {
            req.isIsolated = true;
        }
        next();
    } catch (err) {
        next();
    }
};

module.exports = {
    banMiddleware,
    isolationMiddleware
};
