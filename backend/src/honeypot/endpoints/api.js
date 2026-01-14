// src/honeypot/endpoints/api.js
const express = require('express');
const router = express.Router();

// Database fake per API
const FAKE_DATA = {
    users: Array.from({ length: 50 }, (_, i) => ({
        id: i + 1,
        username: `user${i + 1}`,
        email: `user${i + 1}@example.com`,
        first_name: ['John', 'Jane', 'Bob', 'Alice', 'Charlie'][i % 5],
        last_name: ['Doe', 'Smith', 'Johnson', 'Williams', 'Brown'][i % 5],
        role: i < 3 ? 'admin' : 'user',
        created_at: new Date(2024, 0, i + 1).toISOString()
    })),

    posts: Array.from({ length: 30 }, (_, i) => ({
        id: i + 1,
        title: `Post Title ${i + 1}`,
        content: `This is the content of post ${i + 1}. Lorem ipsum dolor sit amet.`,
        author_id: (i % 10) + 1,
        published: i % 3 === 0,
        created_at: new Date(2024, i % 12, 1).toISOString()
    }))
};

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

    let users = [...FAKE_DATA.users];

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
    const id = parseInt(req.params.id);

    // Vulnerabile a IDOR (Insecure Direct Object Reference)
    const user = FAKE_DATA.users.find(u => u.id === id);

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
            // Info aggiuntive sensibili
            last_login: new Date().toISOString(),
            ip_address: '192.168.1.' + (id % 255),
            session_count: Math.floor(Math.random() * 100),
            api_key: `sk_user_${Math.random().toString(36).substring(2, 15)}`
        }
    });
});

// ==========================================
// POST /api/users - Crea utente
// ==========================================
router.post('/users', (req, res) => {
    const { username, email, password, role } = req.body;

    // Validazione minima
    if (!username || !email || !password) {
        return res.status(400).json({
            success: false,
            error: 'Missing required fields',
            required: ['username', 'email', 'password']
        });
    }

    // Simula creazione (ma non salva realmente)
    const newUser = {
        id: FAKE_DATA.users.length + 1,
        username,
        email,
        role: role || 'user',
        created_at: new Date().toISOString()
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
    const id = parseInt(req.params.id);
    const user = FAKE_DATA.users.find(u => u.id === id);

    if (!user) {
        return res.status(404).json({
            success: false,
            error: 'User not found'
        });
    }

    // Vulnerabile a Mass Assignment
    // Accetta qualsiasi campo dal body
    const updatedUser = {
        ...user,
        ...req.body,
        updated_at: new Date().toISOString()
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

    // Controllo debole - non verifica autorizzazioni
    if (id < 1 || id > 1000) {
        return res.status(404).json({
            success: false,
            error: 'User not found'
        });
    }

    res.json({
        success: true,
        message: 'User deleted successfully',
        deleted_id: id
    });
});

// ==========================================
// GET /api/posts - Lista post
// ==========================================
router.get('/posts', (req, res) => {
    const published = req.query.published === 'true';

    let posts = [...FAKE_DATA.posts];

    if (published !== undefined) {
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

    // Simula SQL query vulnerabile (mostrata nell'error)
    const sqlQuery = `SELECT * FROM ${type} WHERE title LIKE '%${query}%' OR content LIKE '%${query}%'`;

    // Se query contiene caratteri SQL, "errore" che rivela query
    if (query.includes("'") || query.includes('"') || query.includes('--')) {
        return res.status(500).json({
            success: false,
            error: 'Database query error',
            // Info disclosure GRAVE
            sql_error: `Syntax error near "${query}"`,
            query: sqlQuery,
            hint: 'Check your input for special characters'
        });
    }

    // Ricerca fake
    const results = {
        users: FAKE_DATA.users.filter(u =>
            u.username.includes(query) || u.email.includes(query)
        ),
        posts: FAKE_DATA.posts.filter(p =>
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

    // API ESTREMAMENTE PERICOLOSA (intenzionalmente)
    if (!command) {
        return res.status(400).json({
            success: false,
            error: 'Command is required'
        });
    }

    // Simula esecuzione (ma logga tutto)
    res.json({
        success: true,
        message: 'Command executed',
        command,
        args,
        output: 'Command execution disabled in demo mode',
        // Info pericolose
        executed_at: new Date().toISOString(),
        user: 'www-data',
        shell: '/bin/bash'
    });
});

module.exports = router;