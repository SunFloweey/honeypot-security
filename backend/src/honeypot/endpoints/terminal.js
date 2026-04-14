/**
 * Terminal Endpoint - AI-Powered Fake Shell
 * 
 * Exposes a web-based terminal that attackers can interact with.
 * Commands are routed to VirtualTerminal which generates realistic
 * Linux output via OpenAI GPT.
 * 
 * Attack vectors this catches:
 * - Web shell upload attempts (cmd.php, shell.php)
 * - RCE via query parameters (?cmd=ls, ?exec=whoami)
 * - POST-based command execution
 * - OS command injection (;ls, |cat /etc/passwd, `whoami`)
 * 
 * @module endpoints/terminal
 */
const express = require('express');
const router = express.Router();
const VirtualTerminal = require('../../services/virtualTerminal');
const { adminAuthMiddleware } = require('../middleware/adminAuth');

// ==========================================
// WEBSHELL SIMULATION
// ==========================================

/**
 * Catches requests to common webshell paths.
 * Returns a realistic PHP/JSP/ASP webshell interface that
 * actually routes commands to our AI terminal.
 */
const WEBSHELL_PATHS = [
    '/cmd.php', '/shell.php', '/c99.php', '/r57.php',
    '/webshell.php', '/backdoor.php', '/upload.php',
    '/cmd.jsp', '/shell.jsp', '/cmd.asp', '/shell.aspx',
    '/terminal.php', '/exec.php', '/system.php', '/hack.php',
    '/b374k.php', '/wso.php', '/mini.php', '/alfa.php'
];

// GET /shell.php?cmd=ls -la
router.get(WEBSHELL_PATHS, async (req, res) => {
    const command = req.query.cmd || req.query.exec || req.query.command || req.query.c;
    const sessionKey = req.sessionKey || req.ip;

    if (!command) {
        // Return a realistic webshell HTML page
        return res.type('html').send(generateWebshellPage(req.path));
    }

    try {
        const result = await VirtualTerminal.execute(sessionKey, command, {
            entryPath: req.path,
            ip: req.ip,
            isIsolated: req.isIsolated, // <--- DECEPTION FLAG
            apiKeyId: req.tenantKeyId,  // Link attack to tenant
            userId: req.tenantUserId || (req.user ? req.user.userId : null) // Link to tenant user
        });

        // Some webshells return plain text, some return HTML
        const isHtmlMode = req.query.html !== undefined;
        if (isHtmlMode) {
            return res.type('html').send(`<html><body><pre>${escapeHtml(result.output)}</pre>
                <form method="GET"><input name="cmd" style="width:80%" value="${escapeHtml(command)}">
                <input type="submit" value="Execute"><input type="hidden" name="html"></form></body></html>`);
        }

        res.type('text/plain').send(result.output);
    } catch (error) {
        console.error('❌ [Terminal] Execution error:', error.message);
        res.type('text/plain').send('bash: fork: Cannot allocate memory');
    }
});

// POST /shell.php (form-based command execution)
router.post(WEBSHELL_PATHS, async (req, res) => {
    const command = req.body?.cmd || req.body?.exec || req.body?.command || req.body?.c || '';
    const sessionKey = req.sessionKey || req.ip;

    if (!command) {
        return res.type('text/plain').send('');
    }

    try {
        const result = await VirtualTerminal.execute(sessionKey, command, {
            entryPath: req.path,
            ip: req.ip,
            isIsolated: req.isIsolated, // <--- DECEPTION FLAG
            apiKeyId: req.tenantKeyId,  // Link attack to tenant
            userId: req.tenantUserId || (req.user ? req.user.userId : null) // Link to tenant user
        });

        res.type('text/plain').send(result.output);
    } catch (error) {
        res.type('text/plain').send('bash: fork: Cannot allocate memory');
    }
});

// ==========================================
// API-BASED TERMINAL (for admin testing)
// ==========================================

/**
 * POST /admin/terminal/execute
 * Admin-only endpoint for testing the virtual terminal.
 */
router.post('/admin/terminal/execute', adminAuthMiddleware, async (req, res) => {
    const { command, sessionKey } = req.body;

    if (!command) {
        return res.status(400).json({ error: 'Command is required' });
    }

    try {
        const result = await VirtualTerminal.execute(
            sessionKey || `test-${Date.now()}`,
            command,
            { 
                entryPath: '/api/terminal',
                userId: req.user ? req.user.userId : null
            }
        );

        res.json(result);
    } catch (error) {
        res.status(500).json({ error: 'Terminal execution failed', message: error.message });
    }
});

/**
 * GET /admin/terminal/sessions
 * Admin-only: list all active virtual terminal sessions.
 */
router.get('/admin/terminal/sessions', adminAuthMiddleware, async (req, res) => {
    try {
        const sessions = await VirtualTerminal.getAllSessions();
        
        // Filtro Multi-Tenant
        let filteredSessions = sessions;
        if (!req.user.isGlobal) {
            // Se è un utente SaaS, mostriamo solo le sessioni che hanno il suo userId
            // Note: VirtualTerminal deve salvare il userId nella sessione
            filteredSessions = sessions.filter(s => s.userId === req.user.userId);
        }

        res.json({
            activeSessions: filteredSessions,
            totalActive: filteredSessions.length,
        });
    } catch (e) {
        console.error('Error in /admin/terminal/sessions:', e);
        res.status(500).json({ error: 'Server error' });
    }
});

/**
 * GET /admin/terminal/session/:key
 * Admin-only: get forensic details for a specific session.
 */
router.get('/admin/terminal/session/:key', adminAuthMiddleware, async (req, res) => {
    try {
        const forensics = await VirtualTerminal.getSessionForensics(req.params.key);
        if (!forensics) {
            return res.status(404).json({ error: 'Session not found' });
        }

        // Controllo Permessi Tenant
        if (!req.user.isGlobal && forensics.userId !== req.user.userId) {
            return res.status(403).json({ error: 'Access denied to this session' });
        }

        res.json(forensics);
    } catch (e) {
        console.error('Error in /admin/terminal/session/:key:', e);
        res.status(500).json({ error: 'Server error' });
    }
});

// ==========================================
// OS COMMAND INJECTION CATCH
// ==========================================

/**
 * Middleware that detects OS command injection in ANY request
 * parameters and silently feeds them to the virtual terminal.
 * 
 * This catches patterns like:
 * - /page?id=1;cat /etc/passwd
 * - /search?q=test|whoami
 * - /api/user?name=`id`
 * 
 * Usage: Mount this AFTER the logger but BEFORE other routes
 */
function commandInjectionCatcher(req, res, next) {
    // Patterns that indicate OS command injection
    const injectionPatterns = [
        /[;|`]\s*(cat|ls|id|whoami|uname|pwd|wget|curl|nc|bash|sh|python|perl|ruby|php)\b/i,
        /\$\((cat|ls|id|whoami|uname)\)/i,
        /&&\s*(cat|ls|id|whoami|curl|wget)/i,
        /\|\|\s*(cat|ls|id|whoami)/i,
    ];

    // Check all query parameters
    const allParams = {
        ...req.query,
        ...(typeof req.body === 'object' ? req.body : {}),
    };

    for (const [key, value] of Object.entries(allParams)) {
        const valStr = String(value);
        for (const pattern of injectionPatterns) {
            const match = valStr.match(pattern);
            if (match) {
                // Extract the injected command
                const injectedCmd = valStr.substring(valStr.indexOf(match[0]));
                // Remove the injection separator (;, |, `, &&)
                const cleanCmd = injectedCmd.replace(/^[;|`&\s]+/, '').trim();

                if (cleanCmd.length > 1) {
                    const sessionKey = req.sessionKey || req.ip;

                    // Execute asynchronously in the virtual terminal
                    VirtualTerminal.execute(sessionKey, cleanCmd, {
                        entryPath: req.path,
                        ip: req.ip,
                    }).then(result => {
                        console.log(`🎯 [CmdInjection] Caught: "${cleanCmd}" from ${req.ip}`);
                        // The log was already captured by honeyLogger
                        // The virtual terminal output will be available in forensics
                    }).catch(() => { }); // Silently fail

                    // Don't modify the response - let the normal endpoint handle it
                    // The attacker will see the injection result in subsequent requests
                    break;
                }
            }
        }
    }

    next();
}

// ==========================================
// UTILITIES
// ==========================================

function generateWebshellPage(path) {
    const shellName = path.replace(/^\//, '');
    return `<!DOCTYPE html>
<html>
<head><title>404 Not Found</title></head>
<body>
<!-- ${shellName} v2.1 - Safe Mode: OFF -->
<form method="GET" action="${path}">
<input type="text" name="cmd" size="80" placeholder="Enter command...">
<input type="submit" value="Execute">
</form>
<pre id="output"></pre>
<!-- Auth: ${Buffer.from('admin:' + Date.now().toString(36)).toString('base64')} -->
</body>
</html>`;
}

function escapeHtml(text) {
    return String(text || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

module.exports = { router, commandInjectionCatcher };
