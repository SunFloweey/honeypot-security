const express = require('express');
const baitService = require('../utils/baitService');
const router = express.Router();

// espone documentazione API finta che suggerisce la presenza di chiavi segrete 


// ==========================================
// POST /v1/login - Fake Login Endpoint
// ==========================================
router.post('/v1/login', (req, res) => {
    // Logica flessibile: accetta tutto, fallisce sempre
    const { email, password, username } = req.body;

    // Delay naturale già gestito dal middleware (200-500ms)

    res.status(401).json({
        success: false,
        error: 'Invalid credentials',
        code: 'AUTH_FAILED',
        timestamp: new Date().toISOString()
    });
});

// ==========================================
// POST /v1/upload - Fake Upload
// ==========================================
router.post('/v1/upload', (req, res) => {
    const file = req.headers['content-type'] || 'unknown';
    // Logga successo finto
    res.status(200).json({
        success: true,
        message: 'File uploaded successfully',
        path: '/uploads/temp/' + Math.random().toString(36).substring(7)
    });
});


// ==========================================
// API Documentation Page
// ==========================================
router.get(['/docs', '/documentation'], (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>API Documentation - SecureApp</title>
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 1200px; margin: 0 auto; padding: 20px; background: #f8f9fa; }
        h1 { color: #333; border-bottom: 3px solid #007bff; padding-bottom: 10px; }
        .endpoint { background: white; margin: 20px 0; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .method { display: inline-block; padding: 4px 12px; border-radius: 4px; font-weight: bold; font-size: 14px; margin-right: 10px; }
        .method.get { background: #61affe; color: white; }
        .method.post { background: #49cc90; color: white; }
        .method.put { background: #fca130; color: white; }
        .method.delete { background: #f93e3e; color: white; }
        .path { font-family: monospace; font-size: 18px; color: #333; }
        .description { color: #666; margin: 10px 0; }
        code { background: #f4f4f4; padding: 2px 6px; border-radius: 3px; font-family: monospace; }
        .param { background: #f8f9fa; padding: 10px; margin: 10px 0; border-left: 3px solid #007bff; }
      </style>
    </head>
    <body>
      <h1>📚 SecureApp API Documentation</h1>
      <p><strong>Base URL:</strong> <code>https://api.secureapp.com</code></p>
      <p><strong>Version:</strong> 2.1.3</p>
      
      <div class="endpoint">
        <span class="method get">GET</span>
        <span class="path">/api/users</span>
        <p class="description">Retrieve list of all users</p>
        <div class="param">
          <strong>Query Parameters:</strong><br>
          • <code>page</code> - Page number (default: 1)<br>
          • <code>limit</code> - Results per page (default: 20)<br>
          • <code>role</code> - Filter by role (admin, user)
        </div>
      </div>
      
      <div class="endpoint">
        <span class="method get">GET</span>
        <span class="path">/api/users/:id</span>
        <p class="description">Get user details by ID</p>
      </div>
      
      <div class="endpoint">
        <span class="method post">POST</span>
        <span class="path">/api/users</span>
        <p class="description">Create new user</p>
        <div class="param">
          <strong>Body (JSON):</strong><br>
          <code>{ "username": "string", "email": "string", "password": "string" }</code>
        </div>
      </div>
      
      <div class="endpoint">
        <span class="method put">PUT</span>
        <span class="path">/api/users/:id</span>
        <p class="description">Update user information</p>
      </div>
      
      <div class="endpoint">
        <span class="method delete">DELETE</span>
        <span class="path">/api/users/:id</span>
        <p class="description">Delete user account</p>
      </div>
      
      <div class="endpoint">
        <span class="method get">GET</span>
        <span class="path">/api/posts</span>
        <p class="description">Retrieve all posts</p>
      </div>
      
      <div class="endpoint">
        <span class="method get">GET</span>
        <span class="path">/api/search</span>
        <p class="description">Search across all content</p>
        <div class="param">
          <strong>Query Parameters:</strong><br>
          • <code>q</code> - Search query (required)<br>
          • <code>type</code> - Content type (users, posts, all)
        </div>
      </div>
      
      <h2>Authentication</h2>
      <p>Include your API key in the Authorization header:</p>
      <code>Authorization: Bearer YOUR_API_KEY</code>
      
      <h2>Rate Limits</h2>
      <p>• Free tier: 100 requests/hour<br>• Pro tier: 1000 requests/hour</p>
    </body>
    </html>
  `);
});

// ==========================================
// GET /api/users - Lista utenti
// ==========================================
router.get('/users', (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const role = req.query.role;

    let users = baitService.getUsers();

    // Filtro per role (vulnerabile a injection)
    if (role) {
        users = users.filter(u => u.role === role);
    }

    // Paginazione
    const start = (page - 1) * limit;
    const end = start + limit;
    const paginatedUsers = users.slice(start, end);

    res.json({
        success: true,
        page,
        limit,
        total: users.length,
        total_pages: Math.ceil(users.length / limit),
        data: paginatedUsers
    });
});

// ==========================================
// GET /api/users/:id - Dettaglio utente
// ==========================================
router.get('/users/:id', (req, res) => {
    const user = baitService.getUserById(req.params.id);

    if (!user) {
        return res.status(404).json({
            success: false,
            error: 'User not found',
            code: 'USER_NOT_FOUND'
        });
    }

    // Restituisce TUTTE le info (anche sensibili)
    res.json({
        success: true,
        data: {
            ...user,
            lastLogin: new Date().toISOString(),
            ipAddress: '192.168.1.' + (user.id % 255),
            sessionCount: Math.floor(Math.random() * 100),
            apiKey: `sk_user_${Math.random().toString(36).substring(2, 15)}`
        }
    });
});

// ==========================================
// POST /api/users - Crea utente
// ==========================================
router.post('/users', (req, res) => {
    const { username, email, password, role } = req.body;

    if (!username || !email || !password) {
        return res.status(400).json({
            success: false,
            error: 'Missing required fields',
            required: ['username', 'email', 'password']
        });
    }

    const newUser = {
        id: Math.floor(Math.random() * 1000),
        username,
        email,
        role: role || 'user',
        createdAt: new Date().toISOString()
    };

    res.status(201).json({
        success: true,
        message: 'User created successfully',
        data: newUser
    });
});

// ==========================================
// PUT /api/users/:id - Aggiorna utente
// ==========================================
router.put('/users/:id', (req, res) => {
    const user = baitService.getUserById(req.params.id);

    if (!user) {
        return res.status(404).json({
            success: false,
            error: 'User not found'
        });
    }

    const updatedUser = {
        ...user,
        ...req.body,
        updatedAt: new Date().toISOString()
    };

    res.json({
        success: true,
        message: 'User updated successfully',
        data: updatedUser
    });
});

// ==========================================
// DELETE /api/users/:id - Elimina utente
// ==========================================
router.delete('/users/:id', (req, res) => {
    const id = parseInt(req.params.id);

    if (id < 1 || id > 1000) {
        return res.status(404).json({
            success: false,
            error: 'User not found'
        });
    }

    res.json({
        success: true,
        message: 'User deleted successfully',
        deletedId: id
    });
});

// ==========================================
// GET /api/posts - Lista post
// ==========================================
router.get('/posts', (req, res) => {
    const published = req.query.published === 'true';

    let posts = baitService.getPosts();

    if (req.query.published !== undefined) {
        posts = posts.filter(p => p.published === published);
    }

    res.json({
        success: true,
        total: posts.length,
        data: posts
    });
});

// ==========================================
// GET /api/search - Ricerca (vulnerabile!)
// ==========================================
router.get('/search', (req, res) => {
    const query = req.query.q;
    const type = req.query.type || 'all';

    if (!query) {
        return res.status(400).json({
            success: false,
            error: 'Search query is required',
            param: 'q'
        });
    }

    const sqlQuery = `SELECT * FROM ${type} WHERE title LIKE '%${query}%' OR content LIKE '%${query}%'`;

    if (query.includes("'") || query.includes('"') || query.includes('--')) {
        return res.status(500).json({
            success: false,
            error: 'Database query error',
            sqlError: `Syntax error near "${query}"`,
            query: sqlQuery,
            hint: 'Check your input for special characters'
        });
    }

    const results = {
        users: baitService.getUsers().filter(u =>
            u.username.includes(query) || u.email.includes(query)
        ),
        posts: baitService.getPosts().filter(p =>
            p.title.includes(query) || p.content.includes(query)
        )
    };

    res.json({
        success: true,
        query,
        results: type === 'all' ? results : results[type] || []
    });
});


// ==========================================
// GET /api/config - Configurazione (leak!)
// ==========================================
router.get('/config', (req, res) => {
    // Info disclosure GRAVE - configurazione completa
    res.json({
        success: true,
        config: {
            app_name: 'SecureApp',
            version: '2.1.3',
            environment: 'production',
            debug: false,
            database: {
                host: 'db.internal.secureapp.com',
                port: 5432,
                name: 'secureapp_prod',
                // Password parzialmente visibile
                connection_string: 'postgresql://app_user:***@db.internal.secureapp.com/secureapp_prod'
            },
            api: {
                base_url: 'https://api.secureapp.com',
                rate_limit: 100,
                timeout: 30000
            },
            features: {
                user_registration: true,
                email_verification: false, // Vulnerabilità
                two_factor_auth: false, // Vulnerabilità
                api_key_rotation: false
            },
            security: {
                jwt_secret: 'super_secret_key_123', // LEAK GRAVE!
                encryption_algorithm: 'AES-256-CBC',
                password_hash_rounds: 10
            }
        }
    });
});

// ==========================================
// GET /api/status - Status sistema
// ==========================================
router.get('/status', (req, res) => {
    res.json({
        status: 'operational',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        services: {
            database: 'healthy',
            cache: 'healthy',
            queue: 'healthy',
            storage: 'healthy'
        },
        version: '2.1.3',
        // Troppe info
        memory: process.memoryUsage(),
        cpu: process.cpuUsage(),
        node_version: process.version,
        platform: process.platform
    });
});

// ==========================================
// POST /api/execute - Esecuzione comandi!
// ==========================================
router.post('/execute', (req, res) => {
    const { command, args } = req.body;

    // API ESTREMAMENTE PERICOLOSA (RCE Bait)
    // Nessuna esecuzione reale avviene qui. È solo un'esca.
    // Il payload dell'attaccante è già stato catturato dal honeyLogger.

    if (!command) {
        return res.status(400).json({
            success: false,
            error: 'Command is required'
        });
    }

    // Rispondi sempre con un successo finto per incoraggiare l'attaccante
    // a provare altri comandi, ma senza eseguire nulla.
    res.json({
        success: true,
        message: 'Command scheduled for execution',
        jobId: `job_${Math.random().toString(36).substring(7)}`,
        status: 'queued',
        queuePosition: Math.floor(Math.random() * 5) + 1,
        // Info finte
        executedAt: null, // "Sarà eseguito a breve"
        user: 'www-data',
        shell: '/bin/bash'
    });
});

module.exports = router;