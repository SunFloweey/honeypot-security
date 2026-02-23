require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const { adminAuthMiddleware, adminRateLimiter } = require('./src/honeypot/middleware/adminAuth');
const dashboardEndpoints = require('./src/honeypot/endpoints/dashboard');

const app = express();
const PORT = process.env.ADMIN_PORT || 4003;

// STRICT SECURITY: Admin dashboard is isolated from honeypot
app.use(express.json({ limit: '1mb' }));

// CORS: Only allow specific origins (configure in production)
app.use(cors({
    origin: process.env.ADMIN_ALLOWED_ORIGIN || 'http://localhost:5173',
    credentials: true
}));

// Real headers (no spoofing on admin dashboard)
app.use((req, res, next) => {
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.removeHeader('X-Powered-By');
    next();
});

// PROTECTED: All routes require auth + rate limiting
app.use(adminRateLimiter);
app.use(adminAuthMiddleware);

// Mount dashboard API
app.use('/api', dashboardEndpoints);
app.use('/api/ai', require('./src/honeypot/endpoints/ai-analysis'));

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'admin-dashboard' });
});

// Error handler
app.use((err, req, res, next) => {
    console.error('Admin Dashboard Error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
});

// Initialize database and start server
const { sequelize } = require('./src/config/database');

async function startAdminServer() {
    try {
        // Test DB connection
        await sequelize.authenticate();
        console.log('✅ Admin Server: PostgreSQL connection established');

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
