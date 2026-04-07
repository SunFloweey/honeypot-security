const axios = require('axios');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Load .env if available (won't crash if dotenv is not installed in the host project)
try { require('dotenv').config(); } catch (e) { /* dotenv optional for host */ }

/**
 * DianaClient - Core SDK for the DIANA Honeypot Security Platform
 * 
 * This is a GENERIC, IMMUTABLE client:
 *  - NO hardcoded API keys or URLs
 *  - All configuration comes from constructor params or env vars
 *  - Installable via `npm install @diana-security/sdk`
 * 
 * Authentication Modes:
 *  1. API Key (x-api-key header) — generated from the DIANA Dashboard
 *  2. JWT Bearer Token — obtained via `diana login` CLI command
 * 
 * Both are supported transparently. The SDK detects the format automatically:
 *  - If the key starts with "hp_sk_" → use x-api-key header
 *  - If the key looks like a JWT (contains dots) → use Authorization: Bearer header
 *  - Otherwise → use x-api-key header as default
 */
class DianaClient {
    /**
     * @param {Object} config
     * @param {string} [config.apiKey] - API key (hp_sk_...) or JWT token
     * @param {string} [config.baseUrl] - The URL of the DIANA honeypot server
     * @param {string} [config.appName] - Name of your application
     * @param {Object} [config.options] - Security configuration
     * @param {boolean} [config.options.autoProtect] - Auto-evacuate on critical threats
     * @param {string} [config.options.securityLevel] - 'low' | 'medium' | 'high'
     * @param {string[]} [config.options.sensitiveFiles] - Files to protect during evacuation
     * @param {string[]} [config.options.canaryPaths] - Trap paths to detect intrusions
     * @param {string[]} [config.options.baitPaths] - Fake webshell paths to lure attackers
     */
    constructor(config = {}) {
        // Support both 'apiKey' and legacy 'token' parameter names
        this.apiKey = config.apiKey || config.token || process.env.DIANA_API_KEY || process.env.HONEYPOT_TOKEN;
        this.baseUrl = config.baseUrl || process.env.DIANA_BASE_URL || process.env.HONEYPOT_BASE_URL;
        this.appName = config.appName || process.env.DIANA_APP_NAME || process.env.HONEYPOT_APP_NAME || 'DianaApp';

        if (!this.apiKey) {
            console.warn('⚠️  [DIANA SDK] API key not set. Set DIANA_API_KEY in your .env file or pass apiKey in config.');
        }
        if (!this.baseUrl) {
            console.warn('⚠️  [DIANA SDK] Base URL not set. Set DIANA_BASE_URL in your .env file or pass baseUrl in config.');
        }

        // Normalize baseUrl
        if (this.baseUrl && this.baseUrl.endsWith('/')) {
            this.baseUrl = this.baseUrl.slice(0, -1);
        }

        // Security options with sensible defaults
        this.options = {
            autoProtect: config.options?.autoProtect !== undefined ? 
                config.options.autoProtect : 
                (process.env.DIANA_AUTO_PROTECT === 'true' || process.env.DIANA_AUTO_PROTECT === undefined),
            securityLevel: config.options?.securityLevel || process.env.DIANA_SECURITY_LEVEL || 'medium',
            blockSuspicious: config.options?.blockSuspicious !== undefined ?
                config.options.blockSuspicious :
                (process.env.DIANA_BLOCK_SUSPICIOUS === 'true' || process.env.DIANA_BLOCK_SUSPICIOUS === undefined),
            canaryPaths: config.options?.canaryPaths || ['/.env.real', '/admin/config.php', '/.git/config', '/backup.sql'],
            sensitiveFiles: config.options?.sensitiveFiles || ['.env', 'sessions_data.json', 'config.json'],
            baitPaths: config.options?.baitPaths || [
                '/shell.php', '/cmd.php', '/webshell.php', '/upload.php',
                '/cmd.jsp', '/shell.jsp', '/cmd.asp', '/shell.aspx'
            ]
        };

        // Automatic blocking logic based on security level if not explicitly set
        if (config.options?.blockSuspicious === undefined && process.env.DIANA_BLOCK_SUSPICIOUS === undefined) {
            this.options.blockSuspicious = (this.options.securityLevel === 'medium' || this.options.securityLevel === 'high');
        }

        // Determine auth strategy based on the key format
        this._authHeaders = this._buildAuthHeaders();

        // Create HTTP client
        this.client = axios.create({
            baseURL: this.baseUrl ? `${this.baseUrl}/api/v1/sdk` : undefined,
            headers: {
                ...this._authHeaders,
                'Content-Type': 'application/json',
                'X-App-Name': this.appName
            },
            timeout: 10000
        });

        this.evacuationTriggered = false;
    }

    /**
     * Build authentication headers based on key format
     * @private
     */
    _buildAuthHeaders() {
        if (!this.apiKey) return {};

        const isJWT = typeof this.apiKey === 'string' &&
            this.apiKey.split('.').length === 3 &&
            !this.apiKey.startsWith('hp_sk_');

        if (isJWT) {
            return { 'Authorization': `Bearer ${this.apiKey}` };
        }
        return { 'x-api-key': this.apiKey };
    }

    // ================================================================
    //  EXPRESS MIDDLEWARE
    // ================================================================

    /**
     * Express middleware that automatically monitors all HTTP requests for:
     *  - Bait path access (fake webshells)
     *  - Canary path access (intrusion indicators)
     *  - Suspicious payloads (SQLi, XSS, Path Traversal)
     * 
     * Usage:
     *   const diana = require('@diana-security/sdk').createClient();
     *   app.use(diana.monitor());
     * 
     * @returns {Function} Express middleware
     */
    monitor() {
        return async (req, res, next) => {
            const reqPath = req.path;
            const ip = req.ip || (req.connection && req.connection.remoteAddress) || 'unknown';
            const sessionKey = crypto.createHash('md5').update(`sdk_${this.appName}_${ip}`).digest('hex');

            try {
                // 1. Bait paths — fake webshells to lure attackers
                if (this.options.baitPaths.includes(reqPath)) {
                    const command = req.query?.cmd || req.query?.exec || req.body?.cmd || req.body?.exec;

                    if (!command) {
                        this.trackEvent('BAIT_TOUCHED', { path: reqPath, ip }, ip).catch(() => {});
                        return res.status(200).type('html').send(this._generateWebshellPage(reqPath));
                    }

                    try {
                        const result = await this.executeTerminal(command, sessionKey, reqPath, ip);
                        this.trackEvent('BAIT_COMMAND_EXECUTED', { path: reqPath, command, ip }, ip).catch(() => {});

                        if (req.query?.html !== undefined) {
                            return res.type('html').send(`<html><body style="background:#000;color:#0f0;"><pre>${result.output}</pre>
                                <form method="GET"><input name="cmd" style="width:80%;background:#111;color:#0f0;border:1px solid #333;" value="${command}">
                                <input type="submit" value="Execute"></form></body></html>`);
                        }
                        return res.type('text/plain').send(result.output);
                    } catch (err) {
                        return res.status(200).type('text/plain').send('bash: fork: Cannot allocate memory');
                    }
                }

                // 2. Canary paths — intrusion detection traps
                if (this.options.canaryPaths.includes(reqPath)) {
                    console.error(`🚨 [DIANA] CANARY TOUCHED: ${reqPath} from ${ip}`);
                    this.trackEvent('CANARY_TOUCHED', { path: reqPath, method: req.method, ip }, ip).catch(() => {});

                    if (this.options.autoProtect) {
                        this.triggerEvacuation(`Canary path accessed: ${reqPath}`).catch(() => {});
                    }

                    return res.status(404).send('Not Found');
                }

                // 3. Suspicious payload analysis
                const payload = JSON.stringify({ query: req.query, body: req.body });
                if (this._isSuspicious(payload)) {
                    console.warn(`🛡️  [DIANA] SUSPICIOUS PAYLOAD DETECTED from ${ip}: ${reqPath}`);
                    this.trackEvent('SUSPICIOUS_PAYLOAD', { path: reqPath, payload, ip }, ip).catch(() => {});

                    // Background AI analysis for critical threats
                    this.analyzePayload(payload).then(analysis => {
                        if (analysis.success && analysis.analysis?.risk_level === 'Critical' && this.options.autoProtect) {
                            this.triggerEvacuation(`AI detected critical threat: ${analysis.analysis.explanation}`).catch(() => {});
                        }
                    }).catch(() => {});

                    // Blocking if enabled or in protection mode (STEALTH & DECEPTION MODE)
                    if (this.options.blockSuspicious) {
                        try {
                            // Chiediamo a DIANA di generare una risposta d'inganno (MIRAGE)
                            const result = await this.getDeceptiveResponse(req.method, reqPath, req.query, req.body);
                            
                            if (result.success && result.deception) {
                                // Se l'IA ha generato l'inganno, serviamolo all'attaccante con 200 OK
                                return res.status(200).json(result.deception);
                            }
                        } catch (deceptionError) {
                            console.error('⚠️ [DIANA Mirage] Fallback to static error:', deceptionError.message);
                        }

                        // Fallback: simuliamo un errore generico del DB/Server se l'IA fallisce
                        return res.status(500).json({
                            success: false,
                            error: 'Internal Server Error',
                            message: 'An unexpected database error occurred while processing your request.',
                            code: 'ERR_DB_QUERY_FAILED'
                        });
                    }
                }
            } catch (err) {
                // Never block the request if SDK fails
                console.error('[DIANA SDK] Monitor error (non-blocking):', err.message);
            }

            next();
        };
    }

    // ================================================================
    //  API METHODS
    // ================================================================

    /**
     * Track a custom security event
     * @param {string} event - Event name (e.g., 'LOGIN_ATTEMPT', 'SUSPICIOUS_ACTIVITY')
     * @param {Object} [metadata] - Additional event data
     * @param {string} [ipAddress] - Source IP address
     * @returns {Promise<Object>} Server response
     */
    async trackEvent(event, metadata = {}, ipAddress = null) {
        try {
            const response = await this.client.post('/logs', {
                event,
                metadata,
                ipAddress
            });
            return response.data;
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Analyze a suspicious payload using the DIANA AI engine
     * @param {string|Object} payload - The suspicious data to analyze
     * @returns {Promise<Object>} AI analysis result
     */
    async analyzePayload(payload) {
        try {
            const payloadStr = typeof payload === 'string' ? payload : JSON.stringify(payload);
            const response = await this.client.post('/analyze', { payload: payloadStr });
            return response.data;
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Get a deceptive AI-generated response for a suspicious request
     * @param {string} method - HTTP method
     * @param {string} path - Request path
     * @param {Object} query - Query parameters
     * @param {Object} body - Request body
     * @returns {Promise<Object>} Deceptive response
     */
    async getDeceptiveResponse(method, path, query = {}, body = {}) {
        try {
            const response = await this.client.post('/deceive', { method, path, query, body });
            return response.data;
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Generate a honeytoken (fake credential) to place in your codebase as a trap
     * @param {string} [type='env'] - Type: 'aws' | 'mongo' | 'stripe' | 'jwt' | 'env'
     * @returns {Promise<Object>} The generated honeytoken
     */
    async generateHoneytoken(type = 'env') {
        try {
            const response = await this.client.get('/honeytoken', { params: { type } });
            return response.data;
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Execute a command in the DIANA Virtual Terminal (sandboxed)
     * @param {string} command - Command to execute
     * @param {string} sessionKey - Session identifier
     * @param {string} [entryPath] - Entry identification path
     * @param {string} [ip] - Source IP
     * @returns {Promise<Object>} Terminal execution result
     */
    async executeTerminal(command, sessionKey, entryPath = 'sdk-bait', ip = null) {
        try {
            const response = await this.client.post('/terminal', {
                command,
                sessionKey,
                entryPath,
                ip,
                isIsolated: this.options.securityLevel === 'high'
            });
            return response.data;
        } catch (error) {
            throw new Error(`Terminal error: ${error.response?.data?.error || error.message}`);
        }
    }

    /**
     * Trigger the immediate data evacuation and protection chain.
     * Encrypts and destroys sensitive files locally to prevent data theft.
     * @param {string} [reason] - Reason for evacuation
     */
    async triggerEvacuation(reason = 'Manual SDK Trigger') {
        if (this.evacuationTriggered) return;
        this.evacuationTriggered = true;

        console.error(`\n🚨🚨🚨 [DIANA ACTIVE DEFENSE] TRIGGERED! Reason: ${reason}`);
        console.error('🔒 Starting Local Data Protection Chain...\n');

        await this.trackEvent('EVACUATION_STARTED', { reason });

        // Also trigger server-side evacuation
        try {
            await this.client.post('/evacuate', { reason });
        } catch (err) {
            console.error('  ⚠️  Server-side evacuation request failed:', err.message);
        }

        const successful = [];
        const failed = [];

        for (const fileName of this.options.sensitiveFiles) {
            const filePath = path.resolve(process.cwd(), fileName);
            if (!fs.existsSync(filePath)) continue;

            try {
                console.log(`  🔐 Protecting: ${fileName}`);
                await this._shredFile(filePath);
                successful.push(fileName);
                console.log(`  ✅ ${fileName} destroyed and protected.\n`);
            } catch (err) {
                console.error(`  ❌ Error protecting ${fileName}:`, err.message);
                failed.push(fileName);
            }
        }

        await this.trackEvent('EVACUATION_COMPLETE', { successful, failed });
    }

    // ================================================================
    //  PRIVATE HELPERS
    // ================================================================

    /**
     * Check if the text contains common attack patterns
     * @private
     */
    _isSuspicious(text) {
        if (!text) return false;
        const patterns = [
            /UNION\s+SELECT/i,
            /<script[\s>]/i,
            /\.\.\//,
            /DROP\s+TABLE/i,
            /OR\s+1\s*=\s*1/i,
            /SELECT\s+\*\s+FROM/i,
            /;\s*(?:DROP|DELETE|UPDATE|INSERT)/i,
            /etc\/(?:passwd|shadow)/i,
            /\bexec\s*\(/i,
            /\beval\s*\(/i
        ];
        return patterns.some(p => p.test(text));
    }

    /**
     * Secure file destruction — overwrites data before deletion
     * @private
     */
    async _shredFile(filePath) {
        const stats = fs.statSync(filePath);
        const size = stats.size;
        const fd = fs.openSync(filePath, 'r+');
        try {
            // Pass 1: random data
            fs.writeSync(fd, crypto.randomBytes(size), 0, size, 0);
            fs.fdatasyncSync(fd);
            // Pass 2: zeros
            fs.writeSync(fd, Buffer.alloc(size, 0), 0, size, 0);
            fs.fdatasyncSync(fd);
        } finally {
            fs.closeSync(fd);
        }
        fs.unlinkSync(filePath);
    }

    /**
     * Generate a convincing fake webshell page to trap attackers
     * @private
     */
    _generateWebshellPage(shellPath) {
        const shellName = shellPath.replace(/^\//, '');
        return `<!DOCTYPE html>
<html>
<head>
    <title>404 Not Found</title>
    <style>
        body { background: #000; color: #0f0; font-family: monospace; padding: 20px; }
        input { background: #111; color: #0f0; border: 1px solid #333; width: 80%; padding: 5px; }
        .header { color: #555; margin-bottom: 20px; }
    </style>
</head>
<body>
    <div class="header"><!-- ${shellName} v2.1.3 - Safe Mode: OFF --></div>
    <form method="GET" action="${shellPath}">
        <label>www-data@server:~$ </label>
        <input type="text" name="cmd" autofocus placeholder="Enter command...">
        <input type="submit" value="Execute">
    </form>
    <pre id="output"></pre>
</body>
</html>`;
    }
}

module.exports = DianaClient;
