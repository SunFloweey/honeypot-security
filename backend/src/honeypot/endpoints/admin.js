// src/honeypot-security/backend/src/honeypot/endpoints/admin.js
const express = require('express');
const router = express.Router();

// Import static bait data from external JSON files
const usersData = require('../../data/users.json');
const settingsData = require('../../data/settings.json');
const logsData = require('../../data/logs.json');
const backupsData = require('../../data/backups.json');
const apiKeysData = require('../../data/apiKeys.json');

// Admin UI is now handled by React.
// The backend provides API endpoints for admin data and actions.

// ==========================================
// GET /admin/users - Lista utenti
// ==========================================
router.get('/users', (req, res) => {
    res.json(usersData);
});

// ==========================================
// GET /admin/settings - Info sensibili
// ==========================================
router.get('/settings', (req, res) => {
    res.json(settingsData);
});

// ==========================================
// GET /admin/logs - Log di sistema
// ==========================================
router.get('/logs', (req, res) => {
    res.json(logsData);
});

// ==========================================
// GET /admin/backup - File di backup
// ==========================================
router.get('/backup', (req, res) => {
    res.json(backupsData);
});

router.get('/backup/download/:filename', (req, res) => {
    const filename = req.params.filename || 'backup.sql';

    // TARPIT STRATEGY: Waste attacker's time and bandwidth
    // Send a stream that looks like a valid SQL dump but is full of junk

    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    // Non settare Content-Length per tenere l'attaccante in sospeso o settalo molto alto

    // 1. Fake Header Credibile
    res.write(`-- PostgreSQL database dump\n-- Dumped from DB: secureapp_prod\n-- Date: ${new Date().toISOString()}\n\n`);
    res.write('SET statement_timeout = 0;\nSET lock_timeout = 0;\nSET client_encoding = \'UTF8\';\n\n');

    // 2. Junk Stream (Max 100MB per evitare Self-DoS)
    const MAX_SIZE = 100 * 1024 * 1024; // 100 MB
    const CHUNK_SIZE = 64 * 1024; // 64 KB chunks
    const junkChunk = Buffer.alloc(CHUNK_SIZE, 'INSERT INTO "audit_logs" VALUES (9999, "Lorem ipsum dolor sit amet...");\n');

    let sentSize = 0;

    // Funzione ricorsiva per scrivere chunks senza bloccare l'event loop
    function sendJunk() {
        if (sentSize >= MAX_SIZE) {
            res.write('\n-- Dump complete (truncated)\n');
            res.end();
            return;
        }

        // Se il client si è disconnesso, smetti di inviare
        if (res.writableEnded || res.closed) return;

        // Scrivi e gestisci backpressure
        const canContinue = res.write(junkChunk);
        sentSize += CHUNK_SIZE;

        if (canContinue) {
            setImmediate(sendJunk);
        } else {
            // Aspetta che il buffer si svuoti (drain)
            res.once('drain', sendJunk);
        }
    }

    sendJunk();

    // Logga l'evento tarpit (senza salvare il body della risposta ovviamente)
    console.log(`🪤 Tarpit triggered for ${req.ip} - Streaming fake backup...`);
});

// ==========================================
// GET /admin/api-keys - Gestione API keys
// ==========================================
router.get('/api-keys', (req, res) => {
    res.json(apiKeysData);
});

module.exports = router;
