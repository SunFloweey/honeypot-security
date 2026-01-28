const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

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
// Environment files
// ==========================================
router.get('/.env', (req, res) => {
    res.type('text/plain').send(getBait('env.txt'));
});

router.get(['/env', '/.env.local', '/.env.production'], (req, res) => {
    res.redirect('/.env');
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
    res.json({
        database: {
            host: "db.internal.secureapp.com",
            port: 5432,
            name: "secureapp_prod",
            user: "app_user",
            password: "P@ssw0rd123!SecureDB"
        },
        redis: {
            host: "redis.internal.secureapp.com",
            port: 6379,
            password: "RedisP@ss456!"
        },
        api: {
            key: "sk_live_abc123xyz789",
            secret: "secret_key_do_not_share_123"
        },
        debug: false
    });
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

module.exports = router;