// src/honeypot/index.js
const express = require('express');
const { requestCaptureMiddleware: honeyLoggerMiddleware } = require('./middleware/honeyLogger');
const { responseDelayMiddleware, adaptiveDelayMiddleware } = require('./middleware/responseDelay');

// Import endpoint routers
const authEndpoints = require('./endpoints/auth');
const adminEndpoints = require('./endpoints/admin');
const apiEndpoints = require('./endpoints/api');
const filesEndpoints = require('./endpoints/files');
const exposedEndpoints = require('./endpoints/exposed');
const legacyEndpoints = require('./endpoints/legacy');
const dashboardEndpoints = require('./endpoints/dashboard');
const { adminAuthMiddleware } = require('./middleware/adminAuth');
const publicEndpoints = require('./endpoints/public');
const protectedEndpoints = require('./endpoints/protected');

const router = express.Router();

// ==========================================
// MIDDLEWARE GLOBALI HONEYPOT
// ==========================================

// 1. Cattura ogni dettaglio della richiesta (Disattivato qui perché è già globale in app.js)
// router.use(honeyLoggerMiddleware);

// 2. Simula latenza realistica
router.use(responseDelayMiddleware);

// 3. Rallenta attaccanti aggressivi (opzionale)
router.use(adaptiveDelayMiddleware);

// ==========================================
// MOUNT ENDPOINT GROUPS
// ==========================================

// Auth endpoints (/login, /register, /reset-password)
router.use('/auth', authEndpoints);
router.use('/login', authEndpoints); // Alias comune
router.use('/api/auth', authEndpoints); // Variante API

// Admin endpoints (/admin, /administrator, /wp-admin)
router.use('/admin', adminEndpoints);
router.use('/administrator', adminEndpoints);
router.use('/wp-admin', adminEndpoints); // WordPress target popolare

// API endpoints (/api/users, /api/posts, ecc.) - HONEYPOT BAIT
router.use('/api', apiEndpoints);

// Real Dashboard API (Authenticated) - DATA SOURCES
router.use('/api', adminAuthMiddleware, dashboardEndpoints);

// ==========================================
// PROTECTED ENDPOINTS (403/401 - Realistic Security)
// ==========================================
router.use('/', protectedEndpoints);

// File operations (/upload, /download, /files)
router.use('/', filesEndpoints);

// Exposed/leaked files (/.git, /backup.sql, /config.php)
router.use('/', exposedEndpoints);

// Legacy endpoints (*.php, *.asp, /cgi-bin)
router.use('/', legacyEndpoints);

// NOTE: Admin dashboard is now on separate server (admin-server.js:4003)

// ==========================================
// PUBLIC ENDPOINTS (200 OK - Legitimate Facade)
// ==========================================
router.use('/', publicEndpoints);

// ==========================================
// ROOT ENDPOINTS (Now handled by React, but kept for API/Health)
// ==========================================

// Health check (ma vulnerabile a info disclosure)
router.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: '2.1.3',
        database: 'connected',
        cache: 'redis-6.2.5',
        environment: 'production',
        debug_mode: false,
        php_version: '7.2.34',
        server_software: 'Apache/2.4.41 (Ubuntu)'
    });
});

module.exports = router;