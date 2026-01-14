const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

const BAITS_PATH = path.join(__dirname, '../baits/legacy');

const getBait = (filename) => {
    try {
        return fs.readFileSync(path.join(BAITS_PATH, filename), 'utf8');
    } catch (err) {
        return '';
    }
};

// ==========================================
// Endpoint legacy PHP, ASP, JSP, CGI
// Attirano scanner che cercano vecchie tecnologie
// ==========================================

// ==========================================
// PHP endpoints comuni
// ==========================================
router.all(['/index.php', '/home.php', '/main.php'], (req, res) => {
    res.send(getBait('index.php.html'));
});

router.all(['/admin.php', '/administrator.php', '/wp-admin.php'], (req, res) => {
    res.status(401).send(`
    <!DOCTYPE html>
    <html>
    <head><title>Access Denied</title></head>
    <body>
      <h1>401 Unauthorized</h1>
      <p>Access denied. Please login first.</p>
      <p><a href="/login.php">Go to login page</a></p>
    </body>
    </html>
  `);
});

router.all('/login.php', (req, res) => {
    if (req.method === 'POST') {
        return res.status(401).json({
            error: 'Invalid credentials',
            sql_debug: `SELECT * FROM users WHERE username='${req.body.username}' AND password=MD5('${req.body.password}')` // SQL injection bait!
        });
    }

    res.send(getBait('login.php.html'));
});

router.all('/upload.php', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html>
    <head><title>File Upload</title></head>
    <body>
      <h1>Upload File</h1>
      <form method="POST" enctype="multipart/form-data">
        <input type="file" name="file" required>
        <button type="submit">Upload</button>
      </form>
      <?php
      // Upload directory: /var/www/html/uploads/
      // Max file size: 10MB
      // Allowed extensions: jpg, png, gif, pdf, doc, docx
      ?>
    </body>
    </html>
  `);
});

// ==========================================
// ASP/ASPX endpoints (vecchi server Windows)
// ==========================================
router.all(['/default.asp', '/index.asp', '/home.asp'], (req, res) => {
    res.send(getBait('index.asp.html'));
});

router.all(['/login.aspx', '/admin.aspx'], (req, res) => {
    res.send(getBait('login.aspx.html'));
});

// ==========================================
// CGI-BIN (vecchissimo, ma ancora scansionato)
// ==========================================
router.all('/cgi-bin/*', (req, res) => {
    const script = req.path.split('/').pop();

    res.type('text/plain').send(`CGI/1.1 200 OK
Content-Type: text/html

<!DOCTYPE html>
<html>
<head><title>CGI Script</title></head>
<body>
  <h1>CGI Script: ${script}</h1>
  <p>This is a legacy CGI endpoint</p>
  <!-- Script path: /usr/lib/cgi-bin/${script} -->
</body>
</html>
  `);
});

// ==========================================
// JSP endpoints (Java)
// ==========================================
router.all(['/index.jsp', '/admin.jsp', '/login.jsp'], (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>SecureApp - JSP</title>
      <meta name="generator" content="Tomcat 9.0">
    </head>
    <body>
      <h1>Java Server Pages</h1>
      <%-- 
        Context path: /var/lib/tomcat9/webapps/ROOT
        Database: jdbc:mysql://localhost:3306/secureapp
        User: tomcat / Password: TomcatP@ss123!
      --%>
    </body>
    </html>
  `);
});

// ==========================================
// PHPMyAdmin (target popolarissimo)
// ==========================================
router.all(['/phpmyadmin', '/phpmyadmin/index.php', '/pma'], (req, res) => {
    res.send(getBait('phpmyadmin.html'));
});

// ==========================================
// Adminer (alternativa a PHPMyAdmin)
// ==========================================
router.all('/adminer.php', (req, res) => {
    res.send(getBait('adminer.html'));
});

// ==========================================
// Shell/Backdoor simulati (molto pericolosi)
// ==========================================
router.all(['/shell.php', '/c99.php', '/r57.php', '/webshell.php'], (req, res) => {
    const cmd = req.body.cmd || '';
    const output = cmd ? `Executing ${cmd}...\n\nPermission denied.` : '';

    res.send(getBait('shell.html')
        .replace('{{USER_AGENT}}', req.headers['user-agent'] || '')
        .replace('{{CMD}}', cmd)
        .replace('{{OUTPUT}}', output)
    );
});

// ==========================================
// Test/Debug endpoints
// ==========================================
router.get(['/test.php', '/debug.php', '/info.php'], (req, res) => {
    res.send(getBait('debug.html'));
});

// ==========================================
// XMLRPC (WordPress API - spesso abusato)
// ==========================================
router.all('/xmlrpc.php', (req, res) => {
    if (req.method === 'POST') {
        res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?>
<methodResponse>
  <fault>
    <value>
      <struct>
        <member>
          <name>faultCode</name>
          <value><int>403</int></value>
        </member>
        <member>
          <name>faultString</name>
          <value><string>Incorrect username or password.</string></value>
        </member>
      </struct>
    </value>
  </fault>
</methodResponse>
    `);
    } else {
        res.type('application/xml').send(getBait('xmlrpc.xml'));
    }
});

// ==========================================
// Catch-all per file .php, .asp, .jsp non definiti
// ==========================================
router.all('*.php', (req, res) => {
    res.status(404).send(getBait('404_template.html')
        .replace('{{TYPE}}', 'PHP')
        .replace('{{PATH_INFO}}', `Server path: /var/www/html${req.path}`)
    );
});

router.all(['*.asp', '*.aspx'], (req, res) => {
    res.status(404).send(getBait('404_template.html')
        .replace('{{TYPE}}', 'ASP')
        .replace('{{PATH_INFO}}', `IIS path: C:\\inetpub\\wwwroot${req.path.replace(/\//g, '\\\\')}`)
    );
});

router.all('*.jsp', (req, res) => {
    res.status(404).send(getBait('404_template.html')
        .replace('{{TYPE}}', 'JSP')
        .replace('{{PATH_INFO}}', `Tomcat path: /var/lib/tomcat9/webapps/ROOT${req.path}`)
    );
});

module.exports = router;