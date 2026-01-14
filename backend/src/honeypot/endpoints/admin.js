// src/honeypot/endpoints/admin.js
const express = require('express');
const router = express.Router();

// Admin UI is now handled by React.
// The backend provides API endpoints for admin data and actions.

// ==========================================
// GET /admin/users - Lista utenti
// ==========================================
router.get('/users', (req, res) => {
    res.json({
        success: true,
        total: 2847,
        page: 1,
        per_page: 20,
        users: [
            { id: 1, username: 'admin', email: 'admin@secureapp.com', role: 'admin', status: 'active', created_at: '2024-01-15T10:30:00Z' },
            { id: 2, username: 'john.doe', email: 'john@example.com', role: 'user', status: 'active', created_at: '2024-03-22T14:20:00Z' },
            { id: 3, username: 'jane.smith', email: 'jane@example.com', role: 'moderator', status: 'active', created_at: '2024-05-10T09:15:00Z' },
            { id: 4, username: 'test', email: 'test@example.com', role: 'user', status: 'suspended', created_at: '2024-07-01T16:45:00Z' },
            { id: 5, username: 'demo', email: 'demo@example.com', role: 'user', status: 'active', created_at: '2024-08-12T11:30:00Z' }
        ]
    });
});

// ==========================================
// GET /admin/settings - Info sensibili
// ==========================================
router.get('/settings', (req, res) => {
    // Info disclosure pericoloso
    res.json({
        success: true,
        settings: {
            app: {
                name: 'SecureApp',
                version: '2.1.3',
                environment: 'production',
                debug_mode: false,
                maintenance_mode: false
            },
            database: {
                host: 'db.internal.secureapp.com',
                port: 5432,
                name: 'secureapp_prod',
                user: 'app_user',
                // Password redatta ma suggerisce formato
                password: '***************',
                max_connections: 100
            },
            cache: {
                driver: 'redis',
                host: 'redis.internal.secureapp.com',
                port: 6379,
                ttl: 3600
            },
            email: {
                smtp_host: 'smtp.gmail.com',
                smtp_port: 587,
                from_address: 'noreply@secureapp.com'
            },
            security: {
                session_timeout: 1800,
                max_login_attempts: 5,
                password_min_length: 8,
                require_2fa: false, // Vulnerabilità!
                allow_password_reset: true
            }
        }
    });
});

// ==========================================
// GET /admin/logs - Log di sistema
// ==========================================
router.get('/logs', (req, res) => {
    const logType = req.query.type || 'all';

    res.json({
        success: true,
        log_type: logType,
        entries: [
            { timestamp: '2026-01-13T14:32:15Z', level: 'info', message: 'User admin logged in', ip: '192.168.1.100' },
            { timestamp: '2026-01-13T14:15:33Z', level: 'warning', message: 'Failed login attempt for user admin', ip: '203.0.113.42' },
            { timestamp: '2026-01-13T13:58:09Z', level: 'info', message: 'Database backup completed successfully', ip: 'localhost' },
            { timestamp: '2026-01-13T13:45:22Z', level: 'error', message: 'Connection timeout to external API', ip: 'localhost' },
            { timestamp: '2026-01-13T13:30:00Z', level: 'info', message: 'Cron job executed: daily_cleanup', ip: 'localhost' }
        ],
        // Info disclosure sul path dei log
        log_file: '/var/log/secureapp/app.log'
    });
});

// GET /database now handled by React

// ==========================================
// GET /admin/backup - File di backup
// ==========================================
router.get('/backup', (req, res) => {
    res.json({
        success: true,
        backups: [
            {
                id: 1,
                filename: 'backup_2026-01-13_02-00.sql.gz',
                size: '245 MB',
                created_at: '2026-01-13T02:00:00Z',
                download_url: '/admin/backup/download/backup_2026-01-13_02-00.sql.gz'
            },
            {
                id: 2,
                filename: 'backup_2026-01-12_02-00.sql.gz',
                size: '243 MB',
                created_at: '2026-01-12T02:00:00Z',
                download_url: '/admin/backup/download/backup_2026-01-12_02-00.sql.gz'
            },
            {
                id: 3,
                filename: 'backup_2026-01-11_02-00.sql.gz',
                size: '241 MB',
                created_at: '2026-01-11T02:00:00Z',
                download_url: '/admin/backup/download/backup_2026-01-11_02-00.sql.gz'
            }
        ],
        // Info sensibili
        backup_schedule: 'Daily at 02:00 UTC',
        backup_location: '/var/backups/secureapp/',
        retention_days: 30
    });
});

router.get('/backup/download/:filename', (req, res) => {
    // Simula download di backup (ma ritorna dati fake)
    res.setHeader('Content-Type', 'application/x-gzip');
    res.setHeader('Content-Disposition', `attachment; filename="${req.params.filename}"`);
    res.send('Fake backup data - this is a honeypot');
});

// ==========================================
// GET /admin/api-keys - Gestione API keys
// ==========================================
router.get('/api-keys', (req, res) => {
    res.json({
        success: true,
        api_keys: [
            {
                id: 1,
                name: 'Production API Key',
                key: 'sk_live_' + 'x'.repeat(32), // Redatta
                created_at: '2025-06-15T10:00:00Z',
                last_used: '2026-01-13T12:45:00Z',
                permissions: ['read', 'write'],
                status: 'active'
            },
            {
                id: 2,
                name: 'Development Key',
                key: 'sk_test_abc123xyz789', // Key di test (fake ma realistica)
                created_at: '2025-08-20T14:30:00Z',
                last_used: '2026-01-10T09:15:00Z',
                permissions: ['read'],
                status: 'active'
            }
        ]
    });
});

module.exports = router;