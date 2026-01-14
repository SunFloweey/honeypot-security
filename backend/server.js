// server.js
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const path = require('path');
const { testConnection } = require('./src/config/database');
const honeypot = require('./src/honeypot');

// Test DB Connection
testConnection();

const app = express();
const PORT = process.env.HONEYPOT_PORT || 3005;

// Middleware base
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Security headers DEBOLI intenzionalmente (per sembrare vulnerabile)
app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    frameguard: { action: 'sameorigin' } // Permette iframe
}));

// CORS permissivo (bandiera rossa per attaccanti)
app.use(cors({
    origin: '*',
    credentials: true
}));

// Headers che suggeriscono vulnerabilità
app.use((req, res, next) => {
    res.setHeader('X-Powered-By', 'PHP/7.2.34'); // Fake PHP
    res.setHeader('Server', 'Apache/2.4.41 (Ubuntu)'); // Fake server
    next();
});

// Serve static files from React frontend
app.use(express.static(path.join(__dirname, '../frontend/dist')));

// Mount honeypot
app.use('/', honeypot);

// Handle React routing (catch-all)
app.get('*', (req, res, next) => {
    // Se la richiesta è per un endpoint API o un file esposto, lascia che honeypot gestore
    if (req.path.startsWith('/api') || req.path.startsWith('/auth') || req.path.includes('.')) {
        return next();
    }
    res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
});

// 404 handler realistico
app.use((req, res) => {
    res.status(404).json({
        error: 'Not Found',
        message: `Cannot ${req.method} ${req.path}`,
        statusCode: 404
    });
});

// Error handler
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({
        error: 'Internal Server Error',
        message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
    });
});

app.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════════╗
║   🍯  HONEYPOT SERVER ACTIVE           ║
║                                        ║
║   Port: ${PORT}                           ║
║   Mode: TRAP                           ║
║   Status: LISTENING FOR THREATS        ║
╚════════════════════════════════════════╝
  `);
});

module.exports = app;