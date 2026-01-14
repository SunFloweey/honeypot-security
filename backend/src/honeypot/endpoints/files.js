// src/honeypot/endpoints/files.js
const express = require('express');
const router = express.Router();

// ==========================================
// GET /upload - Pagina upload
// ==========================================
// Upload UI is now handled by React.

// ==========================================
// POST /upload - Upload file
// ==========================================
router.post('/upload', express.raw({ type: '*/*', limit: '50mb' }), (req, res) => {
    // Simula upload (non salva realmente i file)
    const filename = req.headers['x-filename'] || 'uploaded_file';
    const size = req.body ? req.body.length : 0;

    // Genera path fake dove il file "sarebbe" salvato
    const fakePath = `/var/www/uploads/${Date.now()}_${filename}`;

    res.json({
        success: true,
        message: 'File uploaded successfully',
        file: {
            name: filename,
            size: size,
            path: fakePath, // Info disclosure
            uploaded_at: new Date().toISOString(),
            url: `/files/${filename}`,
            // Info pericolose
            permissions: '0644',
            owner: 'www-data'
        }
    });
});

// ==========================================
// GET /download - Download con path traversal
// ==========================================
router.get('/download', (req, res) => {
    const file = req.query.file || req.query.path || req.query.filename;

    if (!file) {
        return res.status(400).json({
            success: false,
            error: 'File parameter is required',
            usage: '/download?file=document.pdf'
        });
    }

    // Vulnerabile a path traversal!
    // Se contiene ../ mostra errore che rivela path
    if (file.includes('../') || file.includes('..\\')) {
        return res.status(400).json({
            success: false,
            error: 'Invalid file path',
            // Info disclosure: rivela path reale
            attempted_path: `/var/www/uploads/${file}`,
            resolved_path: require('path').resolve('/var/www/uploads', file),
            message: 'Path traversal detected'
        });
    }

    // Simula download di file comune
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${file}"`);
    res.send(`Fake file content for: ${file}`);
});

// ==========================================
// GET /files/:filename - Accesso diretto file
// ==========================================
router.get('/files/:filename', (req, res) => {
    const filename = req.params.filename;

    // Simula diversi tipi di file
    if (filename.endsWith('.pdf')) {
        res.setHeader('Content-Type', 'application/pdf');
    } else if (filename.endsWith('.jpg') || filename.endsWith('.jpeg')) {
        res.setHeader('Content-Type', 'image/jpeg');
    } else if (filename.endsWith('.png')) {
        res.setHeader('Content-Type', 'image/png');
    } else {
        res.setHeader('Content-Type', 'application/octet-stream');
    }

    res.send(`Fake content for ${filename}`);
});

// ==========================================
// GET /files - Lista file (info disclosure)
// ==========================================
router.get('/files', (req, res) => {
    // Lista file fake che rivela struttura
    res.json({
        success: true,
        path: '/var/www/uploads/',
        files: [
            {
                name: 'invoice_2024.pdf',
                size: 245678,
                type: 'application/pdf',
                modified: '2024-12-15T10:30:00Z',
                permissions: '0644',
                owner: 'www-data'
            },
            {
                name: 'customer_data.xlsx',
                size: 1234567,
                type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                modified: '2024-11-20T14:15:00Z',
                permissions: '0644',
                owner: 'www-data'
            },
            {
                name: 'backup.zip',
                size: 45678901,
                type: 'application/zip',
                modified: '2024-10-01T02:00:00Z',
                permissions: '0644',
                owner: 'root'
            },
            {
                name: 'config.json',
                size: 4567,
                type: 'application/json',
                modified: '2024-09-15T09:45:00Z',
                permissions: '0600',
                owner: 'www-data'
            }
        ],
        // Info disclosure
        disk_usage: {
            total: '500 GB',
            used: '340 GB',
            available: '160 GB'
        }
    });
});

// ==========================================
// DELETE /files/:filename - Elimina file
// ==========================================
router.delete('/files/:filename', (req, res) => {
    const filename = req.params.filename;

    // Nessun controllo di autorizzazione!
    res.json({
        success: true,
        message: 'File deleted successfully',
        file: filename,
        deleted_at: new Date().toISOString()
    });
});

// ==========================================
// GET /preview - Preview file (XXE vulnerable)
// ==========================================
router.get('/preview', (req, res) => {
    const file = req.query.file;

    if (!file) {
        return res.status(400).json({
            error: 'File parameter required'
        });
    }

    res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>File Preview</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 20px; }
        iframe { width: 100%; height: 800px; border: 1px solid #ddd; }
      </style>
    </head>
    <body>
      <h1>Preview: ${file}</h1>
      <iframe src="/files/${file}"></iframe>
    </body>
    </html>
  `);
});

module.exports = router;