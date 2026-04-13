const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const path = require('path');
const honeypot = require('./honeypot');


const { requestCaptureMiddleware } = require('./honeypot/middleware/honeyLogger'); // Importa qui
const { banMiddleware } = require('./honeypot/middleware/securityEnforcement');
const fakeDashboard = require('./honeypot/endpoints/ai-fakedashboard'); // Verifica il percorso corretto
const app = express();

// 1. PRIMO: Logger Globale (Cattura tutto: statici, 404, attacchi)

// Trust the first proxy (or configured number) to prevent IP spoofing
app.set('trust proxy', process.env.TRUST_PROXY || 1);

// Middleware base
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));

app.use(requestCaptureMiddleware);
app.use(banMiddleware); // First line of defense

// Security headers intentionally weak for honey bait
app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    frameguard: { action: 'sameorigin' }
}));

// Permissive CORS (red flag for attackers)
app.use(cors({
    origin: true,
    credentials: true
}));

// Headers that suggest vulnerability (Baiting for Honeypot)
// NOTE: We keep these ONLY for the honeypot part, not for the admin server.
app.use((req, res, next) => {
    // Only spoof headers for paths that are part of the honeypot
    const isBaitPath = !req.path.startsWith('/api/v1/saas') && !req.path.startsWith('/api/admin');
    
    if (isBaitPath) {
        res.setHeader('X-Powered-By', 'PHP/7.2.34');
        res.setHeader('Server', 'Apache/2.4.41 (Ubuntu)');
    } else {
        res.removeHeader('X-Powered-By');
    }
    next();
});

// Serve static files from React frontend
const distPath = path.resolve(__dirname, '../../frontend/dist');
app.use(express.static(distPath));

// Mount honeypot (API and bait routes)
app.use('/', honeypot);

// Handle React routing (catch-all) - CRITICAL for SPA navigation
app.get('*', (req, res, next) => {
    // 1. Skip if it's an API request (should have been handled by 'honeypot' router)
    const isApiRequest = req.path.startsWith('/api/') || req.path.startsWith('/auth/');
    if (isApiRequest) {
        return next();
    }

    // 2. Skip if it's a direct file request that doesn't exist
    if (req.path.includes('.')) {
        return next();
    }

    // 3. Serve index.html for any other route (React Router handles it)
    const indexPath = path.join(distPath, 'index.html');
    if (require('fs').existsSync(indexPath)) {
        res.sendFile(indexPath);
    } else {
        // Dev Fallback: Se il frontend non è buildato, informa lo sviluppatore
        res.status(500).send(`
            <h1>Frontend Not Built</h1>
            <p>Please run <code>npm run build</code> in the <b>frontend</b> directory.</p>
            <hr>
            <p><i>DIANA Debugger: Static path ${distPath} not found.</i></p>
        `);
    }
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        error: 'Not Found',
        message: `Cannot ${req.method} ${req.path}`,
        statusCode: 404
    });
});

// Error handler
app.use((err, req, res, next) => {
    console.error('Application error:', err);
    res.status(500).json({
        error: 'Internal Server Error',
        message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
    });
});

module.exports = app;
