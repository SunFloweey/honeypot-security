// src/honeypot/index.js
const express = require('express');
const { requestCaptureMiddleware: honeyLoggerMiddleware } = require('./middleware/honeyLogger');
const { responseDelayMiddleware, adaptiveDelayMiddleware } = require('./middleware/responseDelay');
const { adaptiveDecoyMiddleware } = require('./middleware/adaptiveDecoy');
const { isolationMiddleware, canaryMiddleware } = require('./middleware/securityEnforcement');

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
const intelEndpoints = require('./endpoints/intel');
const aiAnalysisEndpoints = require('./endpoints/ai-analysis');
const fakeDashboard = require('./endpoints/ai-fakedashboard');
const sdkEndpoints = require('./endpoints/sdk');
const { router: terminalEndpoints, commandInjectionCatcher } = require('./endpoints/terminal');
const { router: saasAuthEndpoints } = require('./endpoints/saas-auth');

const router = express.Router();

router.use((req, res, next) => {
    if (req.path.startsWith('/api')) {
        console.log(`[DEBUG] Honeypot Router: ${req.method} ${req.path}`);
    }
    next();
});

// ==========================================
// MIDDLEWARE GLOBALI HONEYPOT (ATTACKERS ONLY)
// ==========================================

// 0. CANARY – rileva accesso a file/path reali e attiva Auto-Protezione
router.use(canaryMiddleware);

// 1. Simula latenza realistica (Solo per rotte non gestite sopra)
router.use(responseDelayMiddleware);

// 2. Rallenta attaccanti aggressivi (opzionale)
router.use(adaptiveDelayMiddleware);

// 3. Detect OS command injection in ANY request parameter
router.use(commandInjectionCatcher);

// 4. Force Isolation/Deception for high-risk sessions
router.use(isolationMiddleware);

// ==========================================
// MOUNT ENDPOINT GROUPS
// ==========================================

// 0. Virtual Terminal & Webshells (High priority to avoid /admin conflicts)
router.use('/', terminalEndpoints);

// Auth endpoints (/login, /register, /reset-password)
router.use('/auth', authEndpoints);
router.use('/login', authEndpoints); // Alias comune
router.use('/api/auth', authEndpoints); // Variante API

// Admin endpoints (/admin, /administrator, /wp-admin)
router.use('/admin', adminEndpoints);
router.use('/administrator', adminEndpoints);
router.use('/wp-admin', adminEndpoints); // WordPress target popolare

// 1. PUBLIC/TRAP API ROUTES (No Auth)
router.use('/api/intel', intelEndpoints); // WebRTC leaks, etc.

// Montiamo la trappola IA PRIMA degli endpoint statici finti
router.use('/api/v1', fakeDashboard);
router.use('/api/v1/sdk', sdkEndpoints);
router.use('/api/v1/saas', saasAuthEndpoints); // SaaS: Registrazione, Login, Gestione Chiavi API

router.use('/api', apiEndpoints);          // Public bait (/api/users, etc.)

// 2. PROTECTED ADMIN ROUTES (Auth Required)
router.use('/api/ai', adminAuthMiddleware, aiAnalysisEndpoints);
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

// ==========================================
// PUBLIC ENDPOINTS (200 OK - Legitimate Facade)
// ==========================================
router.use('/', publicEndpoints);

// ==========================================
// ADAPTIVE DECOYS (AI Dynamic Bait)
// ==========================================
router.use(adaptiveDecoyMiddleware);

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