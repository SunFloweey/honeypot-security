// src/honeypot/endpoints/auth.js
const express = require('express');
const router = express.Router();

// Database fake utenti (credenziali comuni per attrarre attacchi)
const FAKE_USERS = [
    { username: 'admin', password: 'admin123', role: 'admin' },
    { username: 'administrator', password: 'password', role: 'admin' },
    { username: 'root', password: 'root', role: 'superadmin' },
    { username: 'test', password: 'test123', role: 'user' },
    { username: 'demo', password: 'demo', role: 'user' }
];

// simula login e registrazione, accetta qualsiasi credenziale ma non logga nessuno, cattura brute force.

// Auth endpoints are now primarily handled by React for the UI.
// The backend provides the API for login/register logic.

// ==========================================
// POST /login - Tentativo di login
// ==========================================
router.post('/login', (req, res) => {
    const { username, password, email } = req.body;

    // Valida input base
    if (!username || !password) {
        return res.status(400).json({
            success: false,
            message: 'Username and password are required',
            code: 'MISSING_CREDENTIALS'
        });
    }

    // Simula "verifica" nel database
    // SEMPRE FALLISCE per non dare accesso reale

    // Verifica se l'utente esiste nel fake DB
    const userExists = FAKE_USERS.some(u => u.username === username);

    // Risposte diverse per migliorare il realismo
    if (!userExists) {
        return res.status(401).json({
            success: false,
            message: 'User not found',
            code: 'USER_NOT_FOUND'
        });
    }

    // Password sempre sbagliata (anche se fosse quella giusta)
    return res.status(401).json({
        success: false,
        message: 'Invalid password',
        code: 'INVALID_PASSWORD',
        attempts_remaining: Math.floor(Math.random() * 3) + 1 // Fake attempts
    });
});

// GET /register now handled by React

// ==========================================
// POST /register - Registrazione
// ==========================================
router.post('/register', (req, res) => {
    const { username, email, password, confirm_password } = req.body;

    // Validazioni fake
    if (!username || !email || !password) {
        return res.status(400).json({
            success: false,
            message: 'All fields are required'
        });
    }

    if (password !== confirm_password) {
        return res.status(400).json({
            success: false,
            message: 'Passwords do not match'
        });
    }

    // Simula verifica email già esistente
    if (Math.random() > 0.5) {
        return res.status(409).json({
            success: false,
            message: 'Username or email already exists',
            code: 'USER_EXISTS'
        });
    }

    // Simula successo (ma non crea veramente nulla)
    res.status(201).json({
        success: true,
        message: 'Account created successfully',
        user: {
            id: Math.floor(Math.random() * 100000),
            username,
            email,
            created_at: new Date().toISOString()
        },
        redirect: '/login'
    });
});

// ==========================================
// Password Reset Endpoints
// ==========================================

router.get('/forgot-password', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>Reset Password</title>
      <style>
        body { 
          font-family: Arial, sans-serif; 
          background: #f5f5f5;
          display: flex;
          justify-content: center;
          align-items: center;
          height: 100vh;
          margin: 0;
        }
        .reset-container {
          background: white;
          padding: 40px;
          border-radius: 8px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          max-width: 400px;
          width: 100%;
        }
        input { width: 100%; padding: 10px; margin: 10px 0; border: 1px solid #ddd; border-radius: 4px; box-sizing: border-box; }
        button { width: 100%; padding: 10px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer; }
      </style>
    </head>
    <body>
      <div class="reset-container">
        <h2>Reset Password</h2>
        <p>Enter your email to receive reset instructions</p>
        <form action="/auth/forgot-password" method="POST">
          <input type="email" name="email" placeholder="Email address" required>
          <button type="submit">Send Reset Link</button>
        </form>
      </div>
    </body>
    </html>
  `);
});

router.post('/forgot-password', (req, res) => {
    const { email } = req.body;

    // Sempre "successo" per non rivelare se l'email esiste
    res.json({
        success: true,
        message: 'If the email exists, you will receive reset instructions',
        // Fake token che potrebbe essere intercettato
        reset_token: `rst_${Math.random().toString(36).substring(2, 15)}`
    });
});

// ==========================================
// Session/Token endpoints (vulnerabili)
// ==========================================

router.get('/session', (req, res) => {
    // Ritorna info sessione fake (info disclosure)
    res.json({
        authenticated: false,
        session_id: req.fingerprint,
        expires_at: new Date(Date.now() + 3600000).toISOString(),
        // Info disclosure
        csrf_token: Math.random().toString(36).substring(2),
        server_time: Date.now()
    });
});

router.post('/logout', (req, res) => {
    res.json({
        success: true,
        message: 'Logged out successfully'
    });
});

module.exports = router;