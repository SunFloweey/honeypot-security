require('dotenv').config();

const express      = require('express');
const cors         = require('cors');
const path         = require('path');
const fs           = require('fs');
const crypto       = require('crypto');
const { adminAuthMiddleware, adminRateLimiter } = require('./src/honeypot/middleware/adminAuth');
const dashboardEndpoints = require('./src/honeypot/endpoints/dashboard');

// =============================================================
// VAULT CONFIG – directory dove vengono salvati i blob .enc
// =============================================================
const VAULT_DIR   = path.resolve(__dirname, './secure_vault');
const VAULT_TOKEN = process.env.VAULT_TOKEN;   // Token monouso (deve coincidere con honeypot)
if (!fs.existsSync(VAULT_DIR)) {
    fs.mkdirSync(VAULT_DIR, { recursive: true });
}

// Registro token usati (anti-replay)
const usedTokens = new Set();

const app = express();
app.set('trust proxy', 1); // Trust only the immediate proxy (Nginx) to prevent IP spoofing
const PORT = process.env.PORT || process.env.ADMIN_PORT || 4003;

// STRICT SECURITY: Admin dashboard is isolated from honeypot
app.use(express.json({ limit: '1mb' }));

// CORS: Allow both dev server and production (port 80)
app.use(cors({
    origin: [process.env.ADMIN_ALLOWED_ORIGIN || 'http://localhost:5173', 'http://localhost'],
    credentials: true
}));

// Real headers (no spoofing on admin dashboard)
app.use((req, res, next) => {
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.removeHeader('X-Powered-By');
    next();
});

// Health check (placed BEFORE auth to allow docker healthchecks)
app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'admin-dashboard' });
});

// =============================================================
// VAULT ENDPOINT – canale unidirezionale per ricevere blob .enc (ANTEPORRE AD AUTH)
// =============================================================
app.use('/api/secure-vault', express.raw({ type: '*/*', limit: '100mb' }));
app.post('/api/secure-vault/upload', (req, res) => {
    const token = req.headers['x-vault-token'];

    // 1. Valida il token specifico del vault (da .env)
    if (!VAULT_TOKEN || token !== VAULT_TOKEN) {
        console.warn(`[Vault] Tentativo non autorizzato da ${req.ip}`);
        return res.status(401).json({ error: 'Unauthorized' });
    }

    // 3. Parse multipart manuale: estrai i segmenti dal body raw
    const contentType = req.headers['content-type'] || '';
    const boundaryMatch = contentType.match(/boundary=(.+)$/);
    if (!boundaryMatch) {
        return res.status(400).json({ error: 'Missing boundary' });
    }
    const boundary = boundaryMatch[1];
    const bodyBuf  = req.body; 

    const parts = splitMultipart(bodyBuf, boundary);
    let meta = {};
    let fileBuffer = null;
    let fileName   = `evacuated_${Date.now()}.enc`;

    for (const part of parts) {
        const disposition = part.headers['content-disposition'] || '';
        if (disposition.includes('name="meta"')) {
            try { meta = JSON.parse(part.body.toString()); } catch {} 
        } else if (disposition.includes('name="file"')) {
            fileBuffer = part.body;
            const nameMatch = disposition.match(/filename="([^"]+)"/);
            if (nameMatch) fileName = nameMatch[1];
        }
    }

    if (!fileBuffer || fileBuffer.length === 0) {
        return res.status(400).json({ error: 'File payload vuoto' });
    }

    const savePath = path.join(VAULT_DIR, fileName);
    fs.writeFileSync(savePath, fileBuffer);

    const metaPath = savePath.replace(/\.enc$/, '.meta.json');
    fs.writeFileSync(metaPath, JSON.stringify({ ...meta, receivedAt: new Date().toISOString(), from: req.ip }, null, 2));

    console.log(`🔐 [Vault] Blob salvato: ${fileName} (${fileBuffer.length} bytes) da ${req.ip}`);
    res.status(201).json({ status: 'stored', file: fileName });
});

// =============================================================
// ROTTE AMBIENTE (NOTIFICHE INTERNE) - Devono essere accessibili dall'honeypot
// =============================================================
// Le notifiche interne spesso usano adminAuthMiddleware che convalida via token/IP
app.use(adminRateLimiter);
app.use(adminAuthMiddleware);

// Mount dashboard API (Include le notifiche interne /api/internal/notify)
app.use('/api', dashboardEndpoints);
app.use('/api/ai', require('./src/honeypot/endpoints/ai-analysis'));

// Mount terminal forensics API
const { router: terminalRouter } = require('./src/honeypot/endpoints/terminal');
app.use('/api', terminalRouter);

// Mount DIANA Terminal API
const terminalOrchestratorRouter = require('./src/routes/terminal');
app.use('/api', terminalOrchestratorRouter);

/**
 * Parser multipart minimalista (senza dipendenze esterne)
 * @param {Buffer} raw
 * @param {string} boundary
 * @returns {{ headers: Record<string,string>, body: Buffer }[]}
 */
function splitMultipart(raw, boundary) {
    const parts   = [];
    const delim   = Buffer.from(`\r\n--${boundary}`);
    let   idx     = raw.indexOf(`--${boundary}`);
    if (idx < 0) return parts;

    while (true) {
        const start = raw.indexOf('\r\n', idx) + 2;
        if (start < 2) break;
        const end = raw.indexOf(delim, start);
        if (end < 0) break;

        const block = raw.slice(start, end);
        const headerEnd = block.indexOf('\r\n\r\n');
        if (headerEnd < 0) { idx = end + delim.length; continue; }

        const headerStr = block.slice(0, headerEnd).toString();
        const body      = block.slice(headerEnd + 4);
        const headers   = {};
        for (const line of headerStr.split('\r\n')) {
            const c = line.indexOf(':');
            if (c > 0) headers[line.slice(0, c).trim().toLowerCase()] = line.slice(c + 1).trim();
        }
        parts.push({ headers, body });
        idx = end + delim.length;
        if (raw.slice(idx, idx + 2).toString() === '--') break;
    }
    return parts;
}

// 404 handler for Admin (JSON only, no HTML fallback)
app.use((req, res) => {
    res.status(404).json({ error: 'Not Found', path: req.path });
});

// Error handler
app.use((err, req, res, next) => {
    console.error('Admin Dashboard Error:', err);
    res.status(500).json({ error: 'Internal Server Error', message: err.message });
});

// Initialize database and start server
const { sequelize } = require('./src/config/database');

async function startAdminServer() {
    try {
        // Test DB connection
        await sequelize.authenticate();
        await sequelize.sync({ alter: true }); // Sync models to DB (adds BannedIP table)
        console.log('✅ Admin Server: PostgreSQL connection established and synced');

        const notificationService = require('./src/honeypot/utils/notificationService');
        console.log(`📡 Admin Server: Notification Identity: ${notificationService.isAdminServer ? 'ADMIN (BROADCASTER)' : 'HONEYPOT (FORWARDER)'}`);

        // Start isolated admin server
        app.listen(PORT, () => {
            console.log('');
            console.log('╔════════════════════════════════════════╗');
            console.log('║   🔒  ADMIN DASHBOARD (ISOLATED)       ║');
            console.log('║                                        ║');
            console.log(`║   Port: ${PORT}                            ║`);
            console.log('║   Auth: TOKEN REQUIRED                 ║');
            console.log('║   Rate Limit: 5 req/15min              ║');
            console.log('╚════════════════════════════════════════╝');
            console.log('');
        });
    } catch (error) {
        console.error('❌ Admin Server: Failed to start', error);
        process.exit(1);
    }
}

startAdminServer();
