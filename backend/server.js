// server.js
require('dotenv').config();
const http = require('http');
const { Server } = require('socket.io');
const app = require('./src/app');
const DockerService = require('./src/services/dockerService');
const VirtualTerminal = require('./src/services/virtualTerminal');

const { sequelize, testConnection } = require('./src/config/database');
const threatCache = require('./src/honeypot/utils/threatCache');
const logQueue = require('./src/honeypot/utils/logQueue');

const PORT = process.env.HONEYPOT_PORT || 4001;

const httpServer = http.createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const jwt = require('jsonwebtoken');

// WebSocket Authentication Middleware
io.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    
    if (!token) {
        // Allow unauthenticated connections (for attackers), but tag them as anonymous
        socket.user = { isAnonymous: true };
        return next();
    }

    try {
        // Try SaaS JWT first
        const decoded = jwt.verify(token, process.env.JWT_SECRET || process.env.ADMIN_TOKEN);
        socket.user = {
            userId: decoded.userId || decoded.id,
            isGlobal: false
        };
        next();
    } catch (err) {
        // Check for Legacy Admin Token
        if (token === process.env.ADMIN_TOKEN) {
            socket.user = { role: 'admin', isGlobal: true };
            return next();
        }
        
        // Invalid token? Treat as anonymous attacker
        socket.user = { isAnonymous: true };
        next();
    }
});

// WebSocket Terminal Handler
io.on('connection', (socket) => {
    console.log(`🔌 [Terminal] New connection: ${socket.id} (User: ${socket.user?.userId || 'anon'})`);

    socket.on('init-terminal', async ({ sessionKey, context }) => {
        // If authenticated, SCOPE the session key to the user
        let scopedKey = sessionKey;
        if (socket.user && !socket.user.isAnonymous) {
            const userId = socket.user.userId || 'global-admin';
            // We use a internal prefix to avoid collision with attacker keys
            scopedKey = `user-${userId}-${sessionKey}`;
        }

        socket.join(scopedKey);
        try {
            const session = await VirtualTerminal.getSession(scopedKey, {
                ...context,
                userId: socket.user?.userId
            });
            socket.emit('terminal-ready', {
                prompt: `${session.user}@${session.hostname}:${session.cwd}$ `,
                cwd: session.cwd
            });
        } catch (error) {
            socket.emit('terminal-error', { message: 'Failed to initialize terminal' });
        }
    });

    socket.on('command', async ({ sessionKey, command, context }) => {
        if (!sessionKey || !command) return;

        let scopedKey = sessionKey;
        if (socket.user && !socket.user.isAnonymous) {
            const userId = socket.user.userId || 'global-admin';
            scopedKey = `user-${userId}-${sessionKey}`;
        }
        
        try {
            const result = await VirtualTerminal.execute(scopedKey, command, {
                ...context,
                userId: socket.user?.userId
            });
            socket.emit('command-result', result);
        } catch (error) {
            socket.emit('command-result', { 
                output: 'bash: system error during execution', 
                exitCode: 1 
            });
        }
    });

    socket.on('disconnect', () => {
        console.log(`🔌 [Terminal] Disconnected: ${socket.id}`);
    });
});

async function bootstrap() {
    try {
        // 1. Database Connection
        await testConnection();

        // Sync models
        console.log('⏳ Sincronizzazione modelli DB...');
        await sequelize.sync({ alter: true });
        console.log('✅ Modelli DB sincronizzati.');

        // 2. Initialize Docker Engine
        await DockerService.init();

        // Hydrate ThreatCache
        await threatCache.hydrate();

        // 3. Start Listening
        httpServer.listen(PORT, () => {
            console.log(`
╔════════════════════════════════════════╗
║   🍯  HIGH-INTERACTION HONEYPOT ACTIVE ║
║                                        ║
║   Port: ${PORT}                           ║
║   Mode: DOCKER + AI                    ║
║   Image: ubuntu:minimal                ║
║   Status: LISTENING FOR THREATS        ║
╚════════════════════════════════════════╝
          `);
        });
    } catch (error) {
        console.error('❌ FATAL: Bootstrap sequence failed');
        console.error(error);
        process.exit(1);
    }
}

bootstrap();

async function gracefulShutdown(signal) {
    console.log(`\n🛑 ${signal} ricevuto. Inizio procedura di spegnimento...`);

    if (httpServer) {
        httpServer.close(async () => {
            console.log('Server chiuso.');
            try {
                if (logQueue.flush) await logQueue.flush(true);
                await sequelize.close();
                console.log('✅ Shutdown completato.');
                process.exit(0);
            } catch (err) {
                console.error('⚠️ Errore durante lo shutdown:', err);
                process.exit(1);
            }
        });
    } else {
        process.exit(0);
    }

    setTimeout(() => {
        console.error('❌ Shutdown forzato.');
        process.exit(1);
    }, 10000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));