const express = require('express');
const router = express.Router();
const path = require('path');

/**
 * Endpoint Pubblici (Realismo: 200 OK)
 * Questi servono per far sembrare il sito legittimo
 */

router.get('/', (req, res) => {
    // Se il frontend dist è presente, express.static lo gestirà in app.js
    // Ma qui possiamo mettere un messaggio di default o un template
    res.send(`
        <!DOCTYPE html>
        <html lang="it">
        <head>
            <meta charset="UTF-8">
            <title>Global Tech Solutions - Innovazione Digitale</title>
            <style>
                body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
                header { background: #004a99; color: white; padding: 2rem 1rem; text-align: center; }
                nav { background: #f4f4f4; padding: 10px; text-align: center; }
                nav a { margin: 0 15px; text-decoration: none; color: #004a99; font-weight: bold; }
                main { max-width: 800px; margin: 2rem auto; padding: 0 1rem; }
                footer { background: #333; color: white; text-align: center; padding: 1rem; position: fixed; bottom: 0; width: 100%; }
            </style>
        </head>
        <body>
            <header>
                <h1>Global Tech Solutions</h1>
                <p>La tua porta verso il futuro digitale</p>
            </header>
            <nav>
                <a href="/">Home</a>
                <a href="/about">Chi Siamo</a>
                <a href="/contact">Contatti</a>
                <a href="/login">Accedi</a>
            </nav>
            <main>
                <h2>Benvenuti nel portale corporate</h2>
                <p>Offriamo soluzioni all'avanguardia per la cybersecurity e la gestione dei dati aziendali dal 2010.</p>
                <p>Esplora i nostri servizi o contattaci per una consulenza personalizzata.</p>
            </main>
            <footer>
                &copy; 2026 Global Tech Solutions Inc. - Tutti i diritti riservati.
            </footer>
        </body>
        </html>
    `);
});

router.get('/about', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="it">
        <head>
            <meta charset="UTF-8">
            <title>Chi Siamo - Global Tech Solutions</title>
            <style>
                body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
                header { background: #004a99; color: white; padding: 1rem; text-align: center; }
                main { max-width: 800px; margin: 2rem auto; padding: 0 1rem; }
            </style>
        </head>
        <body>
            <header><h1>Chi Siamo</h1></header>
            <main>
                <h2>La nostra missione</h2>
                <p>Global Tech Solutions è leader nel settore della trasformazione digitale.</p>
                <p>Il nostro team di esperti lavora instancabilmente per proteggere le infrastrutture critiche dei nostri clienti.</p>
                <a href="/">Torna alla home</a>
            </main>
        </body>
        </html>
    `);
});

router.get('/contact', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="it">
        <head>
            <meta charset="UTF-8">
            <title>Contatti - Global Tech Solutions</title>
            <style>
                body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
                header { background: #004a99; color: white; padding: 1rem; text-align: center; }
                main { max-width: 800px; margin: 2rem auto; padding: 0 1rem; }
                .contact-form { background: #f9f9f9; padding: 20px; border-radius: 5px; }
                input, textarea { width: 100%; padding: 10px; margin: 5px 0 15px; border: 1px solid #ddd; }
                button { background: #004a99; color: white; padding: 10px 20px; border: none; cursor: pointer; }
            </style>
        </head>
        <body>
            <header><h1>Contattaci</h1></header>
            <main>
                <div class="contact-form">
                    <form action="/api/v1/contact" method="POST">
                        <label>Nome</label><input type="text" name="name" required>
                        <label>Email</label><input type="email" name="email" required>
                        <label>Messaggio</label><textarea name="message" rows="5"></textarea>
                        <button type="submit">Invia Messaggio</button>
                    </form>
                </div>
                <p>Indirizzo: Via Roma 123, Napoli, Italia</p>
                <a href="/">Torna alla home</a>
            </main>
        </body>
        </html>
    `);
});

router.get('/wpad.dat', (req, res) => {
    res.setHeader('Content-Type', 'application/x-ns-proxy-autoconfig');
    res.send(`
function FindProxyForURL(url, host) {
    // Lead attackers to our internal monitoring bridge
    if (shExpMatch(host, "*.internal.globaltech.corp") || shExpMatch(host, "10.*")) {
        return "PROXY 10.0.5.15:8080; DIRECT";
    }
    return "DIRECT";
}
    `);
});

module.exports = router;
