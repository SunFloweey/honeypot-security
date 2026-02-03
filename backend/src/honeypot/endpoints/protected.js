const express = require('express');
const router = express.Router();

/**
 * Endpoints Sensibili (401/403)
 * Simulano aree protette o vietate per aumentare il realismo
 * e attrarre tentativi di bypass.
 */

// Template 403 Apache Style
const FORBIDDEN_TEMPLATE = `
<!DOCTYPE HTML PUBLIC "-//IETF//DTD HTML 2.0//EN">
<html><head>
<title>403 Forbidden</title>
</head><body>
<h1>Forbidden</h1>
<p>You don't have permission to access this resource.</p>
<hr>
<address>Apache/2.4.41 (Ubuntu) Server at globaltech-solutions.com Port 80</address>
</body></html>
`;

// Template 401 Nginx Style
const UNAUTHORIZED_TEMPLATE = `
<html>
<head><title>401 Authorization Required</title></head>
<body>
<center><h1>401 Authorization Required</h1></center>
<hr><center>nginx/1.18.0</center>
</body>
</html>
`;

router.use((req, res, next) => {
    // Aggiunge header realistici per server protetti
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    next();
});

// /admin e /administrator su GET dirette restituiscono 403 (directory listing denied)
router.get(['/admin', '/administrator', '/backend', '/private'], (req, res) => {
    res.status(403).send(FORBIDDEN_TEMPLATE);
});

// /config directory listing negato
router.get('/config', (req, res) => {
    res.status(403).send(FORBIDDEN_TEMPLATE);
});

// .env reale protezione (o simulazione di essa)
// Nota: exposed.js potrebbe servire il file .env se montato prima.
// Se l'utente vuole 403 per .env, questo deve sovrascrivere o dobbiamo rimuovere da exposed.js
// Qui simuliamo che .env.production sia inaccessibile
router.get(['/.env.production', '/.env.local', '/.environment'], (req, res) => {
    res.status(403).send(FORBIDDEN_TEMPLATE);
});

// Area riservata fittizia
router.get('/staff', (req, res) => {
    res.setHeader('WWW-Authenticate', 'Basic realm="Staff Access"');
    res.status(401).send(UNAUTHORIZED_TEMPLATE);
});

// Server status (tipicamente protetto)
router.get(['/server-status', '/nginx_status'], (req, res) => {
    res.status(403).send(FORBIDDEN_TEMPLATE);
});

module.exports = router;
