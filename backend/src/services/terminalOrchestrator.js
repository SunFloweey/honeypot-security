/**
 * DIANA Terminal Orchestrator - Real Terminal Execution
 * Transforms simulated terminal to real isolated execution
 */
const Docker = require('dockerode');
const { askGeminiToFormat } = require('./aiService');
const logger = require('../utils/logger');
const crypto = require('crypto');

class TerminalOrchestrator {
    constructor() {
        this.docker = new Docker();
        this.containerName = 'diana_sandbox';
        this.activeSessions = new Map();
        this.commandHistory = new Map();
        this.rateLimits = new Map();
    }

    async initializeSandbox() {
        try {
            // Check if container already exists
            const containers = await this.docker.listContainers({ all: true });
            const existingContainer = containers.find(c => c.Names.includes(`/${this.containerName}`));
            
            if (existingContainer) {
                logger.info(`🔄 Reusing existing sandbox container`);
                return this.docker.getContainer(this.containerName);
            }

            logger.info(`🛡️ Initializing new sandbox container...`);
            return await this.createSandbox();
        } catch (error) {
            logger.error('❌ Sandbox initialization failed:', error);
            throw error;
        }
    }

    async createSandbox() {
        const container = await this.docker.createContainer({
            Image: 'honeypot-security_sandbox:latest',
            name: this.containerName,
            Hostname: 'diana-server',
            HostConfig: {
                NetworkMode: 'honeypot-security_isolated_network',
                Memory: 256 * 1024 * 1024, // 256MB
                CpuQuota: 20000, // 0.2 CPU
                PidsLimit: 50, // Anti-fork bomb
                ReadonlyRootfs: true,
                SecurityOpt: ['no-new-privileges:true'],
                Tmpfs: {
                    '/tmp': 'rw,noexec,nosuid,size=10m',
                    '/home/sysadmin': 'rw,noexec,nosuid,size=50m'
                }
            },
            User: 'sysadmin',
            WorkingDir: '/home/sysadmin',
            Cmd: ['/bin/bash', '-c', 'tail -f /dev/null'],
            AttachStdin: false,
            AttachStdout: false,
            AttachStderr: false
        });

        await container.start();
        logger.info(`✅ Sandbox container started: ${container.id}`);
        return container;
    }

    async executeCommand(sessionId, userInput, clientInfo = {}) {
        const startTime = Date.now();
        
        try {
            // 1. Pre-validation
            if (!this.validateCommand(userInput)) {
                const error = "bash: syntax error near unexpected token";
                this.logCommand(sessionId, userInput, '', error, clientInfo);
                return error;
            }

            // 2. Rate limiting
            if (this.isRateLimited(sessionId)) {
                const error = "bash: command timed out (rate limit exceeded)";
                this.logCommand(sessionId, userInput, '', error, clientInfo);
                return error;
            }

            // 3. Get container
            const container = await this.docker.getContainer(this.containerName);
            
            // 4. Execute command
            const exec = await container.exec({
                Cmd: ['/bin/bash', '-c', userInput],
                AttachStdout: true,
                AttachStderr: true,
                User: 'sysadmin',
                Env: [
                    'TERM=xterm-256color',
                    'PS1=\\u@diana-server:\\w\\$ ',
                    'PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin'
                ],
                WorkingDir: '/home/sysadmin'
            });

            const stream = await exec.start({ hijack: false, stdin: false });
            const rawOutput = await this.captureOutput(stream, 5000); // 5s timeout

            // 5. AI masking
            const finalOutput = await this.maskOutput(userInput, rawOutput);
            
            // 6. Update rate limiting
            this.updateRateLimit(sessionId);
            
            // 7. Complete logging
            const executionTime = Date.now() - startTime;
            this.logCommand(sessionId, userInput, rawOutput, finalOutput, clientInfo, executionTime);

            return finalOutput;

        } catch (error) {
            logger.error(`Command execution failed: ${userInput}`, error);
            const plausibleError = this.generatePlausibleError(userInput, error);
            this.logCommand(sessionId, userInput, '', plausibleError, clientInfo);
            return plausibleError;
        }
    }

    async captureOutput(stream, timeout = 5000) {
        return new Promise((resolve, reject) => {
            let output = '';
            let errorOutput = '';
            
            const timeoutId = setTimeout(() => {
                stream.destroy();
                resolve('Command timed out\n');
            }, timeout);

            stream.on('data', (chunk) => {
                const data = chunk.toString('utf8');
                if (chunk[0] === 1) { // stdout
                    output += data.slice(8);
                } else if (chunk[0] === 2) { // stderr
                    errorOutput += data.slice(8);
                }
            });

            stream.on('end', () => {
                clearTimeout(timeoutId);
                const finalOutput = errorOutput || output;
                resolve(finalOutput);
            });

            stream.on('error', (error) => {
                clearTimeout(timeoutId);
                reject(error);
            });
        });
    }

    validateCommand(command) {
        if (!command || command.length > 500) {
            return false;
        }

        // Blacklist comandi pericolosi
        const dangerousPatterns = [
            /rm\s+-rf\s+\//,                    // rm -rf /
            /dd\s+if=\/dev\/zero/,              // dd if=/dev/zero
            /:\(\)\{\s*\|\s*&\s*\}\s*;/,        // Fork bomb
            /chmod\s+777/,                        // chmod 777
            /chown\s+root/,                       // chown root
            /sudo\s+su/,                          // sudo su
            /mount\s+.*\/proc/,                   // mount /proc
            /echo\s+.*>\s*\/proc/,               // echo > /proc
            /wget\s+.*\|\s*sh/,                  // wget | sh
            /curl\s+.*\|\s*sh/,                  // curl | sh
            /nc\s+.*-l/,                         // netcat listener
            /python.*-c.*import.*os/,            // Python system commands
        ];

        return !dangerousPatterns.some(pattern => pattern.test(command));
    }

    isRateLimited(sessionId) {
        const now = Date.now();
        const limits = this.rateLimits.get(sessionId) || [];
        
        // Remove old entries (older than 1 minute)
        const recent = limits.filter(time => now - time < 60000);
        
        // Max 10 commands per minute
        if (recent.length >= 10) {
            return true;
        }
        
        return false;
    }

    updateRateLimit(sessionId) {
        const now = Date.now();
        const limits = this.rateLimits.get(sessionId) || [];
        limits.push(now);
        
        // Keep only last minute
        const recent = limits.filter(time => now - time < 60000);
        this.rateLimits.set(sessionId, recent);
    }

    async maskOutput(command, rawOutput) {
        try {
            const prompt = `
            USER COMMAND: ${command}
            ACTUAL SYSTEM OUTPUT: """${rawOutput}"""
            
            INSTRUCTIONS:
            - Convert Docker/container errors to standard Linux errors
            - Hide container-specific paths and identifiers
            - Maintain original formatting (colors, newlines)
            - If output is empty (cd, touch, export), return empty string
            - Never mention Docker, container, sandbox, or virtualization
            - Replace "container_linux.go" with generic bash errors
            - Replace "permission denied" with appropriate context
            
            RESPONSE ONLY:
            `;

            return await askGeminiToFormat(prompt);
        } catch (error) {
            logger.error('AI masking failed:', error);
            return rawOutput; // Fallback to raw output
        }
    }

    generatePlausibleError(command, error) {
        const errorMap = {
            'container_linux.go': 'bash: command not found',
            'permission denied': 'bash: permission denied',
            'no such file': 'bash: No such file or directory',
            'operation not permitted': 'bash: Operation not permitted',
            'resource temporarily unavailable': 'bash: Resource temporarily unavailable',
            'connection refused': 'bash: connect: Connection refused',
            'network is unreachable': 'bash: Network is unreachable'
        };

        const errorMessage = error.message || '';
        
        for (const [dockerError, bashError] of Object.entries(errorMap)) {
            if (errorMessage.toLowerCase().includes(dockerError.toLowerCase())) {
                return bashError;
            }
        }

        return 'bash: command failed';
    }

    logCommand(sessionId, command, rawOutput, finalOutput, clientInfo, executionTime = 0) {
        const logEntry = {
            sessionId,
            command,
            rawOutput,
            finalOutput,
            clientInfo,
            executionTime,
            timestamp: new Date().toISOString(),
            riskScore: this.calculateRiskScore(command, rawOutput)
        };

        logger.info('🔍 Terminal Command Executed', logEntry);
        
        // Store in history for analysis
        const history = this.commandHistory.get(sessionId) || [];
        history.push(logEntry);
        this.commandHistory.set(sessionId, history.slice(-100)); // Keep last 100 commands
    }

    calculateRiskScore(command, output) {
        let score = 0;
        
        // High-risk commands
        if (/cat\s+\/etc\/passwd/.test(command)) score += 50;
        if (/wget|curl|nc/.test(command)) score += 30;
        if (/chmod|chown/.test(command)) score += 40;
        if (/ps|top|kill/.test(command)) score += 20;
        
        // Suspicious output
        if (/root|admin|password/.test(output)) score += 25;
        if (/error|denied|failed/.test(output)) score += 15;
        
        return Math.min(score, 100);
    }

    async getContainerStatus() {
        try {
            const container = this.docker.getContainer(this.containerName);
            const info = await container.inspect();
            return {
                running: info.State.Running,
                status: info.State.Status,
                created: info.Created,
                finishedAt: info.State.FinishedAt
            };
        } catch (error) {
            return { running: false, error: error.message };
        }
    }

    async resetContainer() {
        try {
            const container = this.docker.getContainer(this.containerName);
            await container.remove({ force: true });
            logger.info('🔄 Sandbox container reset');
            return await this.createSandbox();
        } catch (error) {
            logger.error('Container reset failed:', error);
            throw error;
        }
    }
}

module.exports = TerminalOrchestrator;
