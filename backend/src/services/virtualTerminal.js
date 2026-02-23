/**
 * VirtualTerminal - AI-Powered Fake Shell Environment
 * 
 * Creates a convincing Linux shell environment where every command
 * produces realistic but completely fabricated output. The attacker
 * believes they have RCE on a real server, but they're trapped in
 * a controlled hallucination.
 * 
 * Architecture:
 * - Per-session state (cwd, history, environment variables)
 * - OpenAI GPT generates contextual output
 * - Output sanitization prevents real infra leakage
 * - Honeytokens are embedded in generated files
 * - Command history is logged for forensic analysis
 * 
 * @module services/virtualTerminal
 */
const AIService = require('./aiService');
const prompts = require('../config/prompts');
const HoneytokenService = require('./honeytokenService');
const crypto = require('crypto');
const TerminalCommand = require('../models/TerminalCommand');
const VirtualShellSession = require('../models/VirtualShellSession');
const notificationService = require('../honeypot/utils/notificationService');

class VirtualTerminal {

    /**
     * Active terminal sessions, keyed by sessionKey.
     * Each session maintains its own virtual filesystem state.
     * TTL: 30 minutes of inactivity.
     */
    static sessions = new Map();

    /**
     * Max sessions to prevent memory exhaustion (DoS).
     */
    static MAX_SESSIONS = 500;

    /**
     * Session TTL in milliseconds (30 min)
     */
    static SESSION_TTL = 30 * 60 * 1000;

    // ============================
    // SESSION MANAGEMENT
    // ============================

    /**
     * Get or create a terminal session for the given attacker.
     */
    static async getSession(sessionKey, context = {}) {
        // Try in-memory first for speed
        if (this.sessions.has(sessionKey)) {
            const session = this.sessions.get(sessionKey);
            session.lastActivity = Date.now();
            return session;
        }

        // Try DB next (Persistence!)
        try {
            const dbSession = await VirtualShellSession.findByPk(sessionKey);
            if (dbSession) {
                // Rehydrate in-memory
                const session = {
                    sessionKey: dbSession.sessionKey,
                    cwd: dbSession.cwd,
                    user: dbSession.user,
                    hostname: dbSession.hostname,
                    history: await this._loadHistory(sessionKey),
                    environment: dbSession.environment || {},
                    entryVector: dbSession.entryVector,
                    persona: dbSession.persona,
                    createdAt: dbSession.createdAt.getTime(),
                    lastActivity: Date.now(),
                    commandCount: dbSession.commandCount,
                };
                this.sessions.set(sessionKey, session);
                return session;
            }
        } catch (error) {
            console.error('❌ Error rehydrating session from DB:', error);
        }

        // Create new session if not found
        const persona = this._selectPersona(context.entryPath);
        const session = {
            sessionKey,
            cwd: persona.homeDir,
            user: persona.user,
            hostname: persona.hostname,
            history: [],
            environment: { ...persona.env },
            entryVector: context.entryPath || 'unknown',
            persona: persona.name,
            createdAt: Date.now(),
            lastActivity: Date.now(),
            commandCount: 0,
        };

        // Persist new session to DB
        try {
            await VirtualShellSession.create({
                sessionKey,
                persona: persona.name,
                user: persona.user,
                hostname: persona.hostname,
                cwd: persona.homeDir,
                entryVector: context.entryPath,
                environment: session.environment,
                commandCount: 0,
                lastActivity: new Date()
            });
        } catch (error) {
            console.error('❌ Error saving new session to DB:', error);
        }

        this.sessions.set(sessionKey, session);
        return session;
    }

    static async _loadHistory(sessionKey) {
        try {
            const commands = await TerminalCommand.findAll({
                where: { sessionKey },
                order: [['timestamp', 'ASC']],
                limit: 50
            });
            return commands.map(c => ({
                command: c.command,
                timestamp: c.timestamp,
                cwd: c.cwd,
            }));
        } catch (error) {
            return [];
        }
    }

    /**
     * Select a filesystem persona based on how the attacker entered.
     * This makes the hallucination contextually coherent — if they
     * exploited a WordPress vuln, they land in a WordPress environment.
     */
    static _selectPersona(entryPath) {
        const path = (entryPath || '').toLowerCase();

        if (path.includes('wp-') || path.includes('wordpress')) {
            return {
                name: 'wordpress',
                user: 'www-data',
                hostname: 'wp-prod-01',
                homeDir: '/var/www/html/wordpress',
                env: {
                    HOME: '/var/www',
                    USER: 'www-data',
                    SHELL: '/bin/bash',
                    PATH: '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin',
                    LANG: 'en_US.UTF-8',
                    PWD: '/var/www/html/wordpress',
                    APACHE_LOG_DIR: '/var/log/apache2',
                    DOCUMENT_ROOT: '/var/www/html',
                },
            };
        }

        if (path.includes('api') || path.includes('.js') || path.includes('node')) {
            return {
                name: 'nodejs',
                user: 'app',
                hostname: 'api-prod-01',
                homeDir: '/opt/app',
                env: {
                    HOME: '/home/app',
                    USER: 'app',
                    SHELL: '/bin/bash',
                    PATH: '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/home/app/.nvm/versions/node/v18.19.0/bin',
                    LANG: 'en_US.UTF-8',
                    PWD: '/opt/app',
                    NODE_ENV: 'production',
                    PM2_HOME: '/home/app/.pm2',
                },
            };
        }

        // Default: generic Linux server
        return {
            name: 'linux_generic',
            user: 'deploy',
            hostname: 'srv-prod-03',
            homeDir: '/home/deploy',
            env: {
                HOME: '/home/deploy',
                USER: 'deploy',
                SHELL: '/bin/bash',
                PATH: '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin',
                LANG: 'en_US.UTF-8',
                PWD: '/home/deploy',
                DOCKER_HOST: 'unix:///var/run/docker.sock',
            },
        };
    }

    // ============================
    // COMMAND EXECUTION
    // ============================

    /**
     * Execute a shell command in the virtual terminal.
     * 
     * Pipeline:
     * 1. Parse and validate the command
     * 2. Handle built-in commands locally (cd, pwd, export)
     * 3. For everything else, ask Gemini for realistic output
     * 4. Sanitize the output (remove real infra references)
     * 5. Log the command for forensic analysis
     * 
     * @param {string} sessionKey - Attacker's session identifier
     * @param {string} command - The raw command string
     * @param {Object} context - Additional context (IP, entryPath, etc.)
     * @returns {Object} { output, exitCode, prompt }
     */
    static async execute(sessionKey, command, context = {}) {
        console.log(`[OpenAI] Corretto ingresso in VirtualTerminal.execute per sessione: ${sessionKey}`);
        const session = await this.getSession(sessionKey, context);
        session.commandCount++;

        // Trim and validate
        const cmd = (command || '').trim();
        if (!cmd) {
            return this._formatResponse(session, '', 0);
        }

        // Rate limit: max 100 commands per session (increased since persisted)
        if (session.commandCount > 100) {
            return this._formatResponse(session, '-bash: fork: retry: Resource temporarily unavailable', 1);
        }

        // Update DB session counter and lastActivity
        VirtualShellSession.update({
            commandCount: session.commandCount,
            lastActivity: new Date(),
            cwd: session.cwd // Update CWD in case it changed in builtins
        }, { where: { sessionKey } }).catch(() => { });

        // Handle built-in commands locally (no AI needed)
        const builtin = this._handleBuiltin(session, cmd);
        let result;

        if (builtin !== null) {
            result = builtin;
        } else {
            // Generate AI output
            try {
                const output = await this._generateOutput(session, cmd);
                const sanitized = this._sanitizeOutput(output);
                result = this._formatResponse(session, sanitized, 0);
            } catch (error) {
                console.error(`❌ [VirtualTerminal] AI Error: ${error.message}`);
                const fallbackCmd = cmd.split(' ')[0];
                result = this._formatResponse(session, `bash: ${fallbackCmd}: command not found`, 127);
            }
        }

        // Log the command and result to DB
        TerminalCommand.create({
            sessionKey,
            command: cmd,
            output: result.output,
            cwd: session.cwd,
            user: session.user,
            exitCode: result.exitCode
        }).catch(err => console.error('❌ Error saving command to DB:', err));

        // Notify dashboard in real-time
        notificationService.notifyTerminalActivity(sessionKey, cmd);

        // Add to in-memory history
        session.history.push({
            command: cmd,
            timestamp: new Date().toISOString(),
            cwd: session.cwd,
        });
        if (session.history.length > 50) session.history.shift();

        return result;
    }

    /**
     * Handle shell builtins locally without calling AI.
     * Returns null if the command is not a builtin.
     */
    static _handleBuiltin(session, cmd) {
        const parts = cmd.split(/\s+/);
        const binary = parts[0];

        // cd - change directory
        if (binary === 'cd') {
            const target = parts[1] || session.environment.HOME;
            if (target === '..') {
                const segments = session.cwd.split('/').filter(Boolean);
                segments.pop();
                session.cwd = '/' + segments.join('/') || '/';
            } else if (target === '~') {
                session.cwd = session.environment.HOME;
            } else if (target.startsWith('/')) {
                session.cwd = target;
            } else {
                session.cwd = session.cwd === '/'
                    ? `/${target}`
                    : `${session.cwd}/${target}`;
            }
            session.environment.PWD = session.cwd;
            return this._formatResponse(session, '', 0);
        }

        // pwd - print working directory
        if (binary === 'pwd') {
            return this._formatResponse(session, session.cwd, 0);
        }

        // whoami
        if (binary === 'whoami') {
            return this._formatResponse(session, session.user, 0);
        }

        // hostname
        if (binary === 'hostname') {
            return this._formatResponse(session, session.hostname, 0);
        }

        // id
        if (binary === 'id') {
            const uid = session.user === 'root' ? 0 : 1000;
            const gid = session.user === 'www-data' ? 33 : uid;
            return this._formatResponse(session, `uid=${uid}(${session.user}) gid=${gid}(${session.user}) groups=${gid}(${session.user})`, 0);
        }

        // export
        if (binary === 'export') {
            if (parts.length > 1 && parts[1].includes('=')) {
                const [key, ...valParts] = parts[1].split('=');
                session.environment[key] = valParts.join('=');
                return this._formatResponse(session, '', 0);
            }
            // export with no args: show env
            const envDump = Object.entries(session.environment)
                .map(([k, v]) => `declare -x ${k}="${v}"`)
                .join('\n');
            return this._formatResponse(session, envDump, 0);
        }

        // env / printenv
        if (binary === 'env' || binary === 'printenv') {
            const envDump = Object.entries(session.environment)
                .map(([k, v]) => `${k}=${v}`)
                .join('\n');
            return this._formatResponse(session, envDump, 0);
        }

        // history
        if (binary === 'history') {
            const hist = session.history
                .map((h, i) => `  ${i + 1}  ${h.command}`)
                .join('\n');
            return this._formatResponse(session, hist, 0);
        }

        // exit
        if (binary === 'exit' || binary === 'logout') {
            this.sessions.delete(session.sessionKey);
            return {
                output: 'logout\nConnection to srv-prod-03 closed.',
                exitCode: 0,
                prompt: '',
                sessionClosed: true,
            };
        }

        // sudo - pretend permission denied for non-root
        if (binary === 'sudo') {
            if (session.user === 'root') {
                // Remove "sudo" and recurse
                const innerCmd = parts.slice(1).join(' ');
                return null; // Fall through to AI with the inner command
            }
            // Realistic sudo denied
            return this._formatResponse(
                session,
                `[sudo] password for ${session.user}: \nSorry, user ${session.user} is not allowed to execute '${parts.slice(1).join(' ')}' as root on ${session.hostname}.`,
                1
            );
        }

        return null; // Not a builtin, fall through to AI
    }

    // ============================
    // AI OUTPUT GENERATION
    // ============================

    /**
     * Generate realistic command output using Gemini.
     * The prompt is carefully crafted to:
     * 1. Never reveal it's a honeypot
     * 2. Include honeytokens in sensitive files
     * 3. Plant breadcrumbs to other fake resources
     * 4. Maintain consistency with the session's persona
     */
    static async _generateOutput(session, command) {
        console.log(`[OpenAI] Chiamata AI avviata per generazione Shell output... (Command: ${command})`);
        // Inject honeytokens for sensitive commands
        const honeytokenContext = this._getHoneytokenContext(command);

        const prompt = prompts.VIRTUAL_TERMINAL(
            session.user,
            session.hostname,
            session.cwd,
            command,
            session.persona,
            session.history.slice(-10).map(h => `${h.command}`).join('\n'),
            honeytokenContext
        );

        let output = await AIService._generateText(prompt);

        if (!output) {
            throw new Error("AI generation failed or blocked by circuit breaker");
        }

        // Strip any markdown formatting the AI might add
        output = output.replace(/^```[a-z]*\n/i, '').replace(/\n```$/g, '').trim();

        return output;
    }

    /**
     * Determine if the command accesses sensitive data and prepare
     * honeytoken content to inject into the AI response.
     */
    static _getHoneytokenContext(command) {
        const cmd = command.toLowerCase();

        // cat .env, cat config.json, etc.
        if (/cat\s+.*\.env|cat\s+.*config|cat\s+.*credentials|cat\s+.*secret/.test(cmd)) {
            const envContent = HoneytokenService.generateEnvFile({ appName: 'InternalApp' });
            return `IMPORTANT: The file content MUST include these exact credentials (they are honeytokens):\n${envContent.split('\n').slice(5, 25).join('\n')}`;
        }

        // cat /etc/passwd
        if (/cat\s+\/etc\/passwd/.test(cmd)) {
            return `Generate a realistic /etc/passwd with these users: root, daemon, bin, sys, www-data, nobody, mysql, redis, postgres, app, deploy, jenkins, git. Use standard UIDs. Include a suspicious user "backup-svc" with UID 1001.`;
        }

        // cat /etc/shadow
        if (/cat\s+\/etc\/shadow/.test(cmd)) {
            // Generate fake but realistic password hashes
            const fakeHash = `$6$rounds=5000$${crypto.randomBytes(8).toString('base64').replace(/[^a-zA-Z0-9]/g, '')}$${crypto.randomBytes(32).toString('base64').replace(/[^a-zA-Z0-9]/g, '')}`;
            return `Generate a realistic /etc/shadow. Use this hash for the "deploy" user: ${fakeHash}. Other users should have * or ! (locked).`;
        }

        // ls -la, find, etc.
        if (/ls\s+-.*a|find\s+/.test(cmd)) {
            return `Include a hidden file ".backup_credentials" and a suspicious directory ".ssh" with recent modification dates. Also include a "docker-compose.yml" and a ".env.production" file.`;
        }

        // Docker/Kubernetes
        if (/docker\s|kubectl\s/.test(cmd)) {
            return `Show realistic Docker containers or Kubernetes pods running: app-api (Node.js 18), postgres-primary, redis-cache, nginx-proxy, celery-worker. Include realistic images, ports, and uptime values.`;
        }

        // Network commands
        if (/netstat|ss\s|ifconfig|ip\s+addr/.test(cmd)) {
            return `Show realistic network connections. Include: port 3000 (Node.js), 5432 (PostgreSQL), 6379 (Redis), 80/443 (Nginx). Use RFC1918 private IPs (10.0.x.x). NEVER use the real server's IP.`;
        }

        // MySQL / psql
        if (/mysql|psql|mongo/.test(cmd)) {
            return `Simulate a database connection error with realistic connection details. Include hostname "db-prod-01.internal", database "app_production", and a "connection refused" or "authentication failed" message.`;
        }

        // crontab
        if (/crontab|cron/.test(cmd)) {
            return `Show crontab entries including: daily backup at 2am to /backups/daily/, log rotation, SSL cert renewal, and a suspicious entry that runs a script from /tmp every 5 minutes (breadcrumb for the attacker).`;
        }

        return ''; // No special context needed
    }

    // ============================
    // OUTPUT SANITIZATION
    // ============================

    /**
     * Critical security filter: removes any content that could
     * accidentally reveal real infrastructure details.
     * 
     * This is the last line of defense against prompt injection
     * or AI hallucinations that reference real data.
     */
    static _sanitizeOutput(output) {
        if (!output) return '';

        let sanitized = output;

        // Remove real hostnames (Windows patterns)
        sanitized = sanitized.replace(/DESKTOP-[A-Z0-9]+/gi, 'srv-prod-03');
        sanitized = sanitized.replace(/LAPTOP-[A-Z0-9]+/gi, 'srv-prod-03');

        // Remove real Windows paths
        sanitized = sanitized.replace(/[A-Z]:\\Users\\[^\s\\]+/gi, '/home/deploy');
        sanitized = sanitized.replace(/[A-Z]:\\Program Files[^\s]*/gi, '/usr/local');

        // Remove real IP ranges (non-RFC1918 that might leak)
        // Keep private IPs (10.x, 172.16-31, 192.168)
        sanitized = sanitized.replace(
            /(?<!10\.)(?<!172\.(1[6-9]|2\d|3[01])\.)(?<!192\.168\.)\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
            (match) => {
                // Allow private ranges and loopback
                if (/^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|127\.|0\.)/.test(match)) {
                    return match;
                }
                return `10.0.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
            }
        );

        // Remove any "honeypot" or "fake" or "simulated" references
        sanitized = sanitized.replace(/honeypot/gi, 'monitoring');
        sanitized = sanitized.replace(/\bfake\b/gi, 'internal');
        sanitized = sanitized.replace(/\bsimulat(ed|ion|e)\b/gi, 'configured');
        sanitized = sanitized.replace(/\bdecoy\b/gi, 'service');

        // Remove mentions of AI providers
        sanitized = sanitized.replace(/\b(gemini|openai|claude|gpt|llm|artificial intelligence)\b/gi, '');

        // Remove any accidental JSON/markdown formatting 
        sanitized = sanitized.replace(/^```[a-z]*$/gm, '');

        // Prevent exfiltration of environment variables
        sanitized = sanitized.replace(/OPENAI_API_KEY=[^\s\n]+/gi, 'OPENAI_API_KEY=***REDACTED***');
        sanitized = sanitized.replace(/GEMINI_KEY=[^\s\n]+/gi, 'GEMINI_KEY=***REDACTED***');
        sanitized = sanitized.replace(/ADMIN_SECRET=[^\s\n]+/gi, 'ADMIN_SECRET=***REDACTED***');

        return sanitized.trim();
    }

    // ============================
    // FORMATTING & UTILITIES
    // ============================

    /**
     * Format the terminal response with a realistic bash prompt.
     */
    static _formatResponse(session, output, exitCode) {
        const promptStr = `${session.user}@${session.hostname}:${session.cwd}$`;

        return {
            output: output,
            exitCode: exitCode,
            prompt: promptStr,
            cwd: session.cwd,
            user: session.user,
            hostname: session.hostname,
        };
    }

    /**
     * Remove expired sessions to prevent memory leaks.
     */
    static _cleanupSessions() {
        const now = Date.now();
        for (const [key, session] of this.sessions.entries()) {
            if (now - session.lastActivity > this.SESSION_TTL) {
                console.log(`🖥️ [VirtualTerminal] Session expired: ${key.substring(0, 8)}...`);
                this.sessions.delete(key);
            }
        }
    }

    /**
     * Get forensic data for a session (for admin dashboard).
     */
    static async getSessionForensics(sessionKey) {
        // Try to get from DB as it's the source of truth for history
        try {
            const dbSession = await VirtualShellSession.findByPk(sessionKey);
            if (!dbSession) return null;

            const history = await TerminalCommand.findAll({
                where: { sessionKey },
                order: [['timestamp', 'ASC']]
            });

            return {
                sessionKey: dbSession.sessionKey,
                persona: dbSession.persona,
                user: dbSession.user,
                hostname: dbSession.hostname,
                cwd: dbSession.cwd,
                entryVector: dbSession.entryVector,
                commandCount: dbSession.commandCount,
                commandHistory: history,
                createdAt: dbSession.createdAt.toISOString(),
                lastActivity: dbSession.lastActivity.toISOString(),
                durationMinutes: Math.round((Date.now() - dbSession.createdAt.getTime()) / 60000),
            };
        } catch (error) {
            console.error('❌ Error fetching forensics from DB:', error);
            return null;
        }
    }

    /**
     * Get summary of all active terminal sessions (for admin).
     */
    static async getAllSessions() {
        try {
            const dbSessions = await VirtualShellSession.findAll({
                order: [['lastActivity', 'DESC']],
                limit: 100
            });

            return dbSessions.map(s => ({
                sessionKey: s.sessionKey,
                shortKey: s.sessionKey.substring(0, 12) + '...',
                persona: s.persona,
                user: s.user,
                commandCount: s.commandCount,
                lastCommand: 'Check forensics', // We could fetch last cmd but better keep it simple
                minutesActive: Math.round((Date.now() - s.createdAt.getTime()) / 60000),
            }));
        } catch (error) {
            return [];
        }
    }
}

module.exports = VirtualTerminal;
