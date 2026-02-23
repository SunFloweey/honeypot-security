const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const path = require('path');
const honeypot = require('./honeypot');

const { requestCaptureMiddleware } = require('./honeypot/middleware/honeyLogger'); // Importa qui
const fakeDashboard = require('./honeypot/endpoints/ai-fakedashboard'); // Verifica il percorso corretto
app = express();

// 1. PRIMO: Logger Globale (Cattura tutto: statici, 404, attacchi)

// Trust the first proxy (or configured number) to prevent IP spoofing
app.set('trust proxy', process.env.TRUST_PROXY || 1);

// Middleware base
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));

app.use(requestCaptureMiddleware);

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

// Headers that suggest vulnerability
app.use((req, res, next) => {
    res.setHeader('X-Powered-By', 'PHP/7.2.34');
    res.setHeader('Server', 'Apache/2.4.41 (Ubuntu)');
    next();
});

// Serve static files from React frontend
const distPath = path.join(__dirname, '../../frontend/dist');
app.use(express.static(distPath));

// 1. La Trappola IA (Priorità alta, nessuna protezione)
app.use('/api/v1', fakeDashboard);

// Mount honeypot
app.use('/', honeypot);

// Handle React routing (catch-all)
app.get('*', (req, res, next) => {
    // Only serve index.html for non-api, non-file requests
    const isFileRequest = req.path.includes('.');
    const isApiRequest = req.path.startsWith('/api/') || req.path.startsWith('/auth/');

    if (isApiRequest || isFileRequest) {
        return next();
    }

    res.sendFile(path.join(distPath, 'index.html'));
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
