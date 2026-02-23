const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const HoneytokenService = require('../../services/honeytokenService');

const BAITS_PATH = path.join(__dirname, '../baits/exposed');

const getBait = (filename) => {
    try {
        return fs.readFileSync(path.join(BAITS_PATH, filename), 'utf8');
    } catch (err) {
        return '';
    }
};

// ==========================================
// File e directory "accidentalmente" esposti
// Questi attirano scanner automatici
// ==========================================

// ==========================================
// Standard SEO/Scanner files
// ==========================================
router.get('/robots.txt', (req, res) => {
    res.type('text/plain').send(
        "User-agent: *\n" +
        "Disallow: /admin/\n" +
        "Disallow: /api/\n" +
        "Disallow: /config/\n" +
        "Disallow: /backup/\n" +
        "Allow: /\n"
    );
});

router.get('/sitemap.xml', (req, res) => {
    res.type('application/xml').send(
        `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
   <url>
      <loc>https://secureapp.com/</loc>
      <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
      <changefreq>daily</changefreq>
      <priority>1.0</priority>
   </url>
   <url>
      <loc>https://secureapp.com/login</loc>
      <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
      <priority>0.8</priority>
   </url>
   <!-- Trappola per scanner -->
   <url>
      <loc>https://secureapp.com/admin</loc>
      <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
      <priority>0.5</priority>
   </url>
</urlset>`
    );
});

// ==========================================
// .git directory (molto comune)
// ==========================================
router.get('/.git/config', (req, res) => {
    res.type('text/plain').send(getBait('git_config.txt'));
});

router.get('/.git/HEAD', (req, res) => {
    res.type('text/plain').send('ref: refs/heads/main\n');
});

router.get('/.git/logs/HEAD', (req, res) => {
    res.type('text/plain').send(`0000000000000000000000000000000000000000 a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0 Admin <admin@secureapp.com> 1640000000 +0000	commit: Initial commit
a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0 b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1 Developer <dev@secureapp.com> 1650000000 +0000	commit: Add authentication
b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1 c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2 Admin <admin@secureapp.com> 1660000000 +0000	commit: Fix security vulnerability
  `);
});

// ==========================================
// Environment files (Dynamic Honeytokens)
// ==========================================
router.get(['/.env', '/env', '/.env.local', '/.env.production', '/.env.staging', '/.env.backup'], (req, res) => {
    console.log(`🍯 [Honeytoken] .env accessed from ${req.ip} - Path: ${req.path}`);
    const envContent = HoneytokenService.generateEnvFile({
        appName: 'SecureApp',
        appUrl: 'https://api.secureapp.io',
    });
    res.type('text/plain').send(envContent);
});

// ==========================================
// Backup files
// ==========================================
router.get(['/backup.sql', '/database.sql', '/dump.sql'], (req, res) => {
    res.type('text/plain').send(getBait('backup.sql'));
});

router.get(['/backup.zip', '/site-backup.zip', '/www.zip'], (req, res) => {
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="backup.zip"');
    res.send('PK (fake zip header) - This is a honeypot');
});

// ==========================================
// Configuration files
// ==========================================
router.get(['/config.php', '/configuration.php'], (req, res) => {
    res.type('text/plain').send(getBait('config.php'));
});

router.get('/config.json', (req, res) => {
    console.log(`🍯 [Honeytoken] config.json accessed from ${req.ip}`);
    const config = HoneytokenService.generateConfigJson({
        appName: 'SecureApp',
    });
    res.json(config);
});

router.get('/web.config', (req, res) => {
    res.type('application/xml').send(getBait('web.config'));
});

// ==========================================
// Server info files
// ==========================================
router.get('/phpinfo.php', (req, res) => {
    res.send(getBait('phpinfo.html'));
});

router.get('/server-status', (req, res) => {
    res.type('text/html').send(getBait('server-status.html').replace('{{TIMESTAMP}}', new Date().toISOString()));
});

// ==========================================
// Common "hidden" files
// ==========================================
router.get('/.htaccess', (req, res) => {
    res.type('text/plain').send(getBait('htaccess.txt'));
});

router.get('/.htpasswd', (req, res) => {
    res.type('text/plain').send(getBait('htpasswd.txt'));
});

router.get('/composer.json', (req, res) => {
    res.json({
        name: "secureapp/webapp",
        description: "SecureApp Web Application",
        require: {
            "php": ">=7.2",
            "laravel/framework": "^8.0",
            "guzzlehttp/guzzle": "^7.0",
            "doctrine/dbal": "^3.0"
        },
        "require-dev": {
            "phpunit/phpunit": "^9.0"
        },
        autoload: {
            "psr-4": {
                "App\\": "app/"
            }
        }
    });
});

router.get('/package.json', (req, res) => {
    res.json({
        name: "secureapp-frontend",
        version: "2.1.3",
        description: "SecureApp Frontend",
        main: "index.js",
        scripts: {
            start: "node server.js",
            dev: "nodemon server.js"
        },
        dependencies: {
            express: "^4.18.0",
            mongoose: "^8.0.0",
            jsonwebtoken: "^9.0.0",
            bcrypt: "^5.1.0"
        }
    });
});

// ==========================================
// README and docs
// ==========================================
router.get('/README.md', (req, res) => {
    res.type('text/plain').send(getBait('README.md'));
});

// ==========================================
// WordPress common files (honeypot for WP scanners)
// ==========================================
router.get('/wp-config.php', (req, res) => {
    res.type('text/plain').send(getBait('wp-config.php'));
});

// ==========================================
// ADVANCED HONEYTOKEN TRAPS
// New high-value targets that DevOps attackers look for
// ==========================================

// Docker Compose (common in CI/CD reconnaissance)
router.get(['/docker-compose.yml', '/docker-compose.yaml', '/docker-compose.prod.yml'], (req, res) => {
    console.log(`🍯 [Honeytoken] Docker Compose accessed from ${req.ip}`);
    const content = HoneytokenService.generateDockerCompose();
    res.type('text/yaml').send(content);
});

// Kubernetes Secrets (high-value cloud target)
router.get(['/k8s-secrets.yml', '/k8s-secrets.yaml', '/secrets.yaml', '/.kube/config'], (req, res) => {
    console.log(`🍯 [Honeytoken] K8s Secrets accessed from ${req.ip}`);
    const content = HoneytokenService.generateK8sSecrets();
    res.type('text/yaml').send(content);
});

// Fake SSH directory (extremely enticing for attackers)
router.get(['/.ssh/authorized_keys', '/.ssh/id_rsa', '/.ssh/id_rsa.pub'], (req, res) => {
    console.log(`🍯 [Honeytoken] SSH file accessed from ${req.ip} - Path: ${req.path}`);
    if (req.path.includes('id_rsa.pub')) {
        res.type('text/plain').send(
            `ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAACAQC+${require('crypto').randomBytes(32).toString('base64').replace(/[^a-zA-Z0-9]/g, '')} admin@secureapp-prod\n`
        );
    } else if (req.path.includes('id_rsa') && !req.path.includes('.pub')) {
        // Fake private key (obviously fake but looks real at first glance)
        res.type('text/plain').send(
            `-----BEGIN OPENSSH PRIVATE KEY-----\n` +
            Array.from({ length: 12 }, () => require('crypto').randomBytes(48).toString('base64')).join('\n') +
            `\n-----END OPENSSH PRIVATE KEY-----\n`
        );
    } else {
        res.type('text/plain').send(
            `ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABgQC+${require('crypto').randomBytes(24).toString('base64').replace(/[^a-zA-Z0-9]/g, '')} deploy@ci-server\n` +
            `ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAI${require('crypto').randomBytes(16).toString('base64').replace(/[^a-zA-Z0-9]/g, '')} admin@secureapp.io\n`
        );
    }
});

// Fake debug endpoint (breadcrumb from .env TODO comments)
router.get('/api/debug/trace', (req, res) => {
    console.log(`🍯 [Honeytoken] Debug endpoint accessed from ${req.ip}`);
    res.json({
        status: 'debug_enabled',
        server: 'app-prod-01.internal',
        uptime: `${Math.floor(Math.random() * 90 + 10)} days`,
        database_pool: { active: 12, idle: 8, max: 25 },
        memory_mb: { used: 487, total: 2048 },
        // Breadcrumbs to other fake endpoints
        endpoints: [
            '/api/debug/db-query?sql=SELECT+1',
            '/api/debug/env',
            '/api/debug/sessions',
            '/internal/admin-v2/',
        ],
        _warning: 'This endpoint will be removed in v3.3. See SEC-1589.',
    });
});

// Another debug breadcrumb
router.get('/api/debug/env', (req, res) => {
    console.log(`🍯 [Honeytoken] Debug env accessed from ${req.ip}`);
    const envContent = HoneytokenService.generateEnvFile({ appName: 'SecureApp-Debug' });
    res.type('text/plain').send(envContent);
});

module.exports = router;