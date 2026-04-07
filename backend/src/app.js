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

// Headers that suggest vulnerability
app.use((req, res, next) => {
    res.setHeader('X-Powered-By', 'PHP/7.2.34');
    res.setHeader('Server', 'Apache/2.4.41 (Ubuntu)');
    next();
});

// Serve static files from React frontend
const distPath = path.join(__dirname, '../../frontend/dist');
app.use(express.static(distPath));

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

    const indexPath = path.join(distPath, 'index.html');
    if (require('fs').existsSync(indexPath)) {
        res.sendFile(indexPath);
    } else {
        // Fallback realistico: un finto errore di manutenzione per non rivelare il crash del server
        res.status(404).send(`
            <!DOCTYPE html>
            <html>
            <head><title>System Maintenance</title></head>
            <body style="font-family: sans-serif; text-align: center; padding: 50px; background: #f4f4f4;">
                <div style="background: white; padding: 40px; border-radius: 8px; display: inline-block; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                    <h1 style="color: #d9534f;">503 - System Maintenance</h1>
                    <p>The Login Portal is currently undergoing scheduled maintenance.</p>
                    <p style="color: #777;">Estimated completion: ${new Date(Date.now() + 3600000).toLocaleTimeString()}</p>
                    <hr>
                    <p style="font-size: 0.8em; color: #aaa;">Internal System ID: HONEY-SEC-402</p>
                </div>
            </body>
            </html>
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
