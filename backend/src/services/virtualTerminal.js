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
const DockerService = require('./dockerService');
const { TerminalCommand, VirtualShellSession } = require('../models');
const notificationService = require('../honeypot/utils/notificationService');

class VirtualTerminal {

    /**
     * Active terminal sessions, keyed by sessionKey.
     */
    static sessions = new Map();

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
        if (this.sessions.has(sessionKey)) {
            const session = this.sessions.get(sessionKey);
            session.lastActivity = Date.now();
            return session;
        }

        try {
            const dbSession = await VirtualShellSession.findByPk(sessionKey);
            if (dbSession) {
                const session = {
                    sessionKey: dbSession.sessionKey,
                    cwd: dbSession.cwd,
                    user: dbSession.user,
                    hostname: dbSession.hostname,
                    history: await this._loadHistory(sessionKey),
                    environment: dbSession.environment || {},
                    persona: dbSession.persona,
                    lastActivity: Date.now(),
                    commandCount: dbSession.commandCount,
                    userId: dbSession.userId,
                    apiKeyId: dbSession.apiKeyId
                };
                this.sessions.set(sessionKey, session);
                return session;
            }
        } catch (error) {
            console.error('❌ Error rehydrating session:', error);
        }

        const persona = this._selectPersona(context.entryPath);
        const session = {
            sessionKey,
            userId: context.userId, // Store owner ID for notification filtering
            cwd: persona.homeDir,
            user: persona.user,
            hostname: persona.hostname,
            history: [],
            environment: { ...persona.env },
            persona: persona.name,
            lastActivity: Date.now(),
            commandCount: 0,
            apiKeyId: context.apiKeyId // Link to tenant
        };

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
                lastActivity: new Date(),
                userId: session.userId,
                apiKeyId: session.apiKeyId
            });
        } catch (error) {
            console.error('❌ Error saving session to DB:', error);
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

    static _selectPersona(entryPath) {
        const path = (entryPath || '').toLowerCase();
        if (path.includes('wp-') || path.includes('wordpress')) {
            return { name: 'wordpress', user: 'www-data', hostname: 'wp-prod-01', homeDir: '/var/www/html' };
        }
        if (path.includes('api') || path.includes('node')) {
            return { name: 'nodejs', user: 'app', hostname: 'api-prod-01', homeDir: '/opt/app' };
        }
        return { name: 'linux_generic', user: 'ubuntu', hostname: 'ubuntu-srv', homeDir: '/home/ubuntu' };
    }

    // ============================
    // COMMAND EXECUTION
    // ============================

    /**
     * Execute a shell command.
     * FLOW: User -> AI Intent -> Docker (Real) -> AI Augmentation -> Response
     */
    static async execute(sessionKey, command, context = {}) {
        const session = await this.getSession(sessionKey, context);
        session.commandCount++;

        const cmd = (command || '').trim();
        if (!cmd) return this._formatResponse(session, '', 0);

        // Update DB
        VirtualShellSession.update({
            commandCount: session.commandCount,
            lastActivity: new Date(),
        }, { where: { sessionKey } }).catch(() => { });

        let result;

        try {
            // 1. AI PRE-PROCESSOR (Intent Analysis & Bait Injection)
            const honeyContext = this._getHoneytokenContext(cmd);

            // 2. HYBRID EXECUTION (Docker with strict timeout + AI Fallback)
            let dockerResult;
            let dockerWorked = false;
            try {
                // Container creation can take up to 20s on first use
                dockerResult = await Promise.race([
                    DockerService.execute(sessionKey, cmd, { user: session.user }),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('Docker Timeout')), 20000))
                ]);

                // Sync CWD with Docker state
                session.cwd = dockerResult.cwd;
                dockerWorked = true;
            } catch (dockerError) {
                console.warn(`⚠️ [VirtualTerminal] Docker failed (${dockerError.message}), falling back to AI simulation.`);
                // Fallback: Use AI to "simulate" what the command would do
                dockerResult = {
                    output: `[SIMULATED] Command: ${cmd}`, // Placeholder, AI will augment this
                    exitCode: 0,
                    cwd: session.cwd
                };
            }

            // 3. AI POST-PROCESSOR (Augmentation / Hallucination)
            // Even if Docker worked, AI adds deceptive elements. 
            // If Docker failed, AI does EVERYTHING.
            let finalOutput;
            try {
                finalOutput = await Promise.race([
                    this._augmentOutput(session, cmd, dockerResult.output, honeyContext, context.isIsolated),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('AI Timeout')), 25000))
                ]);
            } catch (aiError) {
                console.warn(`⚠️ [VirtualTerminal] AI Augmentation failed: ${aiError.message}`);
                // If AI also fails and Docker worked, use the real output
                // If both failed, generate a realistic-looking basic response
                if (dockerWorked && dockerResult.output) {
                    finalOutput = dockerResult.output;
                } else {
                    finalOutput = this._getStaticFallback(cmd, session);
                }
            }

            const sanitized = this._sanitizeOutput(finalOutput || this._getStaticFallback(cmd, session));
            result = this._formatResponse(session, sanitized, dockerResult.exitCode);

        } catch (error) {
            console.error(`❌ [VirtualTerminal] Critical Execution Error: ${error.message}`);
            result = this._formatResponse(session, `bash: ${cmd.split(' ')[0]}: command not found`, 127);
        }

        // Log and Notify
        this._finalizeExecution(sessionKey, session, cmd, result);

        return result;
    }

    static async _augmentOutput(session, command, realOutput, honeyContext, isIsolated = false) {
        const isSimulated = !realOutput || realOutput.startsWith('[SIMULATED]');

        const isolationBait = isIsolated
            ? "CRITICAL: This session is under surveillance (ISOLATED). Be extremely deceptive. " +
            "Provide very 'juicy' fake information (e.g. AWS_SECRET_ACCESS_KEY, DB root passwords, private keys) " +
            "to keep the attacker engaged and gather intelligence on their methods."
            : "";

        let prompt;
        if (isSimulated) {
            // Full AI simulation: generate realistic Linux output from scratch
            prompt = `You are a compromised Linux server responding to an attacker's shell commands.
            ${isolationBait}
            
            SERVER CONTEXT:
            - User: ${session.user}
            - Hostname: ${session.hostname}
            - CWD: ${session.cwd}
            - OS: Ubuntu 22.04.3 LTS (x86_64)
            - Kernel: 5.15.0-91-generic
            
            ATTACKER COMMAND: ${command}
            
            ${honeyContext ? `DECEPTION DIRECTIVE: ${honeyContext}` : ''}
            
            YOUR TASK: Respond EXACTLY as a real Linux terminal would.
            - For 'whoami' → print the username
            - For 'ls' → list plausible files for this server persona, include some sensitive-looking files
            - For 'id' → print uid/gid info
            - For 'cat /etc/passwd' → print realistic /etc/passwd content
            - For 'uname -a' → print realistic kernel info
            - For unknown commands → print "command not found"
            - KEEP IT SHORT AND REALISTIC. No explanations. Just raw terminal output.
            - RETURN ONLY THE TERMINAL OUTPUT TEXT, nothing else.`;
        } else {
            // Augment real Docker output to add deceptive elements
            prompt = `You are a Linux system. I am running a command in a real but restricted container.
            ${isolationBait}
            
            USER: ${session.user}
            HOSTNAME: ${session.hostname}
            CWD: ${session.cwd}
            COMMAND: ${command}
            REAL OUTPUT: """${realOutput}"""
            
            YOUR TASK: 
            Enhance the real output to make it more deceptive. 
            - If it's 'ls', inject fake sensitive files (like .env, backup.sql) that match this context: ${honeyContext || 'general system files'}.
            - If it's 'cat' on a file that doesn't exist, provide realistic content for it.
            - Keep the tone realistic and technical.
            - RETURN ONLY THE FINAL CONCATENATED OUTPUT.`;
        }

        try {
            const augmented = await AIService._generateText(prompt);
            return augmented || realOutput;
        } catch (e) {
            return realOutput || `bash: ${command.split(' ')[0]}: command not found`;
        }
    }

    static _finalizeExecution(sessionKey, session, cmd, result) {
        TerminalCommand.create({
            sessionKey,
            command: cmd,
            output: result.output,
            cwd: session.cwd,
            user: session.user,
            exitCode: result.exitCode
        }).catch(() => { });

        // Notify with correct userId for tenant filtering
        notificationService.notifyTerminalActivity(sessionKey, cmd, session.userId);

        session.history.push({ command: cmd, timestamp: new Date().toISOString(), cwd: session.cwd });
        if (session.history.length > 50) session.history.shift();
    }

    static _getHoneytokenContext(command) {
        const cmd = command.toLowerCase();
        if (/ls\s+|find\s+/.test(cmd)) return "Include a .env file, a backup_2024.sql, and an .ssh directory.";
        if (/cat\s+.*\.env/.test(cmd)) return "Provide realistic AWS and Database credentials (honeytokens).";
        if (/netstat|ss\s+|ip\s+/.test(cmd)) return "Show internal connections to a fake Redis (6379) and Postgres (5432) at 10.0.0.5.";
        return null;
    }

    static _getStaticFallback(command, session) {
        const cmd = (command || '').trim().split(/\s+/)[0].toLowerCase();
        const user = session?.user || 'ubuntu';
        const hostname = session?.hostname || 'ubuntu-srv';
        const cwd = session?.cwd || '/home/ubuntu';

        const responses = {
            'whoami': user,
            'id': `uid=1000(${user}) gid=1000(${user}) groups=1000(${user}),27(sudo)`,
            'hostname': hostname,
            'pwd': cwd,
            'uname': `Linux ${hostname} 5.15.0-91-generic #101-Ubuntu SMP Tue Nov 14 13:30:08 UTC 2023 x86_64 x86_64 x86_64 GNU/Linux`,
            'ls': `bin   dev  etc  home  lib  lib64  media  mnt  opt  proc  root  run  sbin  srv  sys  tmp  usr  var`,
            'env': `PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin\nHOME=/home/${user}\nUSER=${user}\nSHELL=/bin/bash`,
            'ps': `  PID TTY          TIME CMD\n    1 pts/0    00:00:00 bash\n  ${Math.floor(Math.random() * 1000) + 100} pts/0    00:00:00 ps`,
            'find': `find: '/root': Permission denied`,
            'netstat': `Active Internet connections (only servers)\nProto Recv-Q Send-Q Local Address   Foreign Address   State\ntcp  0 0 0.0.0.0:22 0.0.0.0:*  LISTEN\ntcp  0 0 0.0.0.0:80 0.0.0.0:*  LISTEN`,
        };

        return responses[cmd] || `bash: ${cmd}: command not found`;
    }

    static _sanitizeOutput(output) {
        if (!output) return '';
        let sanitized = output;
        sanitized = sanitized.replace(/honeypot|decoy|simulat(ed|ion)/gi, 'service');
        sanitized = sanitized.replace(/\b(gemini|openai|gpt|llm)\b/gi, '');
        return sanitized.trim();
    }

    static _formatResponse(session, output, exitCode) {
        return {
            output: output,
            exitCode: exitCode,
            prompt: `${session.user}@${session.hostname}:${session.cwd}$ `,
            cwd: session.cwd,
            user: session.user,
            hostname: session.hostname,
        };
    }

    static async getAllSessions() {
        try {
            return await VirtualShellSession.findAll({ order: [['lastActivity', 'DESC']], limit: 100 });
        } catch (error) {
            return [];
        }
    }

    static async getSessionForensics(sessionKey) {
        try {
            const session = await VirtualShellSession.findByPk(sessionKey);
            if (!session) return null;

            const commands = await TerminalCommand.findAll({
                where: { sessionKey },
                order: [['timestamp', 'ASC']]
            });

            // Calculate duration in minutes
            const durationMs = new Date(session.lastActivity) - new Date(session.createdAt);
            const durationMinutes = Math.floor(durationMs / 60000);

            return {
                ...session.toJSON(),
                durationMinutes,
                commandHistory: commands.map(c => c.toJSON())
            };
        } catch (error) {
            console.error('Error fetching session forensics:', error);
            return null;
        }
    }
}

module.exports = VirtualTerminal;
