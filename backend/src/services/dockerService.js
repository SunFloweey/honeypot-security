const Docker = require('dockerode');

/**
 * Connessione Docker tramite proxy TCP (produzione) o socket diretto (sviluppo locale).
 * In produzione, DOCKER_HOST è settato da docker-compose a tcp://docker_proxy:2375.
 * Il proxy limita le operazioni permesse (CONTAINERS, IMAGES, EXEC) per sicurezza.
 */
const dockerConfig = process.env.DOCKER_HOST
    ? (() => {
        const url = new URL(process.env.DOCKER_HOST);
        return { host: url.hostname, port: parseInt(url.port) };
    })()
    : { socketPath: '/var/run/docker.sock' };

const docker = new Docker(dockerConfig);

/**
 * DockerService - Manages high-interaction honeypot containers.
 * 
 * Provides real Ubuntu environments for attackers to interact with.
 * Each attacker gets their own isolated container.
 */
class DockerService {
    // Map to track active containers: sessionKey -> { containerId, lastActivity, cwd }
    static activeContainers = new Map();

    // Config
    // Usiamo l'immagine sandbox definita nel docker-compose per i terminali reali
    static IMAGE = 'honeypot-security-sandbox';
    static CONTAINER_TTL = 15 * 60 * 1000; // 15 minutes of inactivity
    static MAX_CONTAINERS = 50;

    /**
     * Initialize the service (ensure image exists)
     */
    static available = true; // Will be set to false if Docker is unavailable

    static async init() {
        try {
            console.log(`🐳 [DockerService] Checking Docker availability and image ${this.IMAGE}...`);
            const images = await docker.listImages();
            const imageTag = `${this.IMAGE}:latest`;
            const exists = images.some(img => img.RepoTags && img.RepoTags.some(t => t === imageTag || t === this.IMAGE));

            if (!exists) {
                // Instead of pulling (which can fail in Docker-in-Docker on WSL2),
                // just mark Docker as unavailable and let AI handle everything.
                console.warn(`⚠️ [DockerService] Image '${this.IMAGE}' not found locally. Docker mode DISABLED. AI simulation will handle all commands.`);
                this.available = false;
                return;
            }

            this.available = true;
            console.log(`✅ [DockerService] Ready. Image '${this.IMAGE}' found. Docker mode ENABLED.`);
        } catch (error) {
            console.error('❌ [DockerService] Docker socket unavailable:', error.message);
            this.available = false;
            console.warn('⚠️ [DockerService] Falling back to AI-only simulation mode.');
        }

        // Start cleanup interval only if Docker is available
        if (this.available) {
            setInterval(() => this._cleanupExpiredContainers(), 60000);
        }
    }

    /**
     * Get or create a container for a session.
     */
    static async getOrCreateContainer(sessionKey) {
        if (this.activeContainers.has(sessionKey)) {
            const entry = this.activeContainers.get(sessionKey);
            entry.lastActivity = Date.now();
            return entry;
        }

        if (this.activeContainers.size >= this.MAX_CONTAINERS) {
            throw new Error('Server capacity reached. Try again later.');
        }

        console.log(`🐳 [DockerService] Creating new container for session ${sessionKey.substring(0, 8)}...`);

        try {
            const container = await docker.createContainer({
                Image: this.IMAGE,
                Cmd: ['/bin/bash'],
                Tty: true,
                OpenStdin: true,
                AttachStdin: true,
                HostConfig: {
                    Memory: 128 * 1024 * 1024, // 128MB limit
                    CpuQuota: 50000, // 50% of one core
                    NetworkMode: 'none', // Isolated by default
                    AutoRemove: true
                },
                WorkingDir: '/home/ubuntu'
            });

            await container.start();

            // Setup basic home environment
            await this._exec(container, ['mkdir', '-p', '/home/ubuntu']);
            await this._exec(container, ['useradd', '-d', '/home/ubuntu', 'ubuntu']);
            await this._exec(container, ['chown', 'ubuntu:ubuntu', '/home/ubuntu']);

            const entry = {
                containerId: container.id,
                lastActivity: Date.now(),
                cwd: '/home/ubuntu',
                user: 'ubuntu'
            };

            this.activeContainers.set(sessionKey, entry);
            return entry;
        } catch (error) {
            console.error('❌ [DockerService] Failed to create container:', error);
            throw error;
        }
    }

    /**
     * Execute a command in the session's container.
     */
    static async execute(sessionKey, command, options = {}) {
        if (!this.available) {
            throw new Error('Docker not available - AI simulation mode active');
        }

        const entry = await this.getOrCreateContainer(sessionKey);
        entry.lastActivity = Date.now();

        const container = docker.getContainer(entry.containerId);

        // Handle 'cd' commands locally to update our state
        const parts = command.trim().split(/\s+/);
        if (parts[0] === 'cd') {
            return this._handleCd(sessionKey, entry, parts[1]);
        }

        try {
            const exec = await container.exec({
                Cmd: ['/bin/bash', '-c', command],
                AttachStdout: true,
                AttachStderr: true,
                User: options.user || entry.user,
                WorkingDir: entry.cwd
            });

            const stream = await exec.start();

            return new Promise((resolve, reject) => {
                let output = '';
                stream.on('data', (chunk) => {
                    output += chunk.toString();
                });
                stream.on('end', async () => {
                    const inspect = await exec.inspect();
                    resolve({
                        output,
                        exitCode: inspect.ExitCode,
                        cwd: entry.cwd
                    });
                });
                stream.on('error', reject);

                // Safety timeout
                setTimeout(() => resolve({ output: 'Command timed out.', exitCode: 124 }), 10000);
            });
        } catch (error) {
            console.error(`❌ [DockerService] Exec error:`, error);
            return { output: `bash: ${parts[0]}: execution error`, exitCode: 1 };
        }
    }

    /**
     * Internal helper to handle directory changes
     */
    static async _handleCd(sessionKey, entry, target) {
        // We need to verify if the directory exists in the container
        const container = docker.getContainer(entry.containerId);
        const resolvedPath = this._resolvePath(entry.cwd, target || '/home/ubuntu');

        try {
            const check = await container.exec({
                Cmd: ['ls', '-d', resolvedPath],
                WorkingDir: entry.cwd
            });
            const stream = await check.start();

            return new Promise((resolve) => {
                let found = false;
                stream.on('data', () => { found = true; });
                stream.on('end', () => {
                    if (found) {
                        entry.cwd = resolvedPath;
                        resolve({ output: '', exitCode: 0, cwd: entry.cwd });
                    } else {
                        resolve({ output: `bash: cd: ${target}: No such file or directory`, exitCode: 1, cwd: entry.cwd });
                    }
                });
            });
        } catch (e) {
            return { output: `bash: cd: system error`, exitCode: 1, cwd: entry.cwd };
        }
    }

    static _resolvePath(current, target) {
        if (!target) return '/home/ubuntu';
        if (target.startsWith('/')) return target;
        if (target === '~') return '/home/ubuntu';

        const parts = current.split('/').filter(Boolean);
        const targetParts = target.split('/').filter(Boolean);

        for (const p of targetParts) {
            if (p === '..') parts.pop();
            else if (p !== '.') parts.push(p);
        }

        return '/' + parts.join('/');
    }

    static async _exec(container, cmd) {
        const exec = await container.exec({ Cmd: cmd, AttachStdout: true, AttachStderr: true });
        const stream = await exec.start();
        return new Promise(r => stream.on('end', r));
    }

    static async _cleanupExpiredContainers() {
        const now = Date.now();
        for (const [key, entry] of this.activeContainers.entries()) {
            if (now - entry.lastActivity > this.CONTAINER_TTL) {
                console.log(`🐳 [DockerService] Cleaning up expired container ${entry.containerId.substring(0, 8)}`);
                try {
                    const container = docker.getContainer(entry.containerId);
                    await container.stop().catch(() => { });
                    this.activeContainers.delete(key);
                } catch (e) {
                    this.activeContainers.delete(key);
                }
            }
        }
    }
}

module.exports = DockerService;
