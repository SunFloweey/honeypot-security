require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const { adminAuthMiddleware, adminRateLimiter } = require('./src/honeypot/middleware/adminAuth');
const dashboardEndpoints = require('./src/honeypot/endpoints/dashboard');

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

// PROTECTED: All routes require auth + rate limiting
app.use(adminRateLimiter);
app.use(adminAuthMiddleware);

// Mount dashboard API
app.use('/api', dashboardEndpoints);
app.use('/api/ai', require('./src/honeypot/endpoints/ai-analysis'));

// Mount terminal forensics API (Needed for Virtual Shell Monitor)
const { router: terminalRouter } = require('./src/honeypot/endpoints/terminal');
app.use('/api', terminalRouter);

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
