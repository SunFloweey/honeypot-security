// ============================================================
// Simula l'App Express di un Cliente che usa DIANA SDK
// ============================================================
// 
// Questo file mostra come un cliente userebbe il pacchetto
// @diana-security/sdk installato via npm.
// 
// Per testare:
//   1. Assicurati che il server DIANA sia avviato (porta 4002)
//   2. Esegui: node test_customer_app.js
//   3. Visita http://localhost:5000
// ============================================================

const express = require('express');
const app = express();
const path = require('path');

// ─── NUOVO MODO: usa il pacchetto SDK direttamente ───
// In produzione il cliente farebbe: require('@diana-security/sdk')
// Qui usiamo il path locale per test
const diana = require('./sdk').createClient({
    apiKey: 'hp_sk_152ef1ee598451fb60387c6f446452cc32ad038b168bad43', // API Key dalla Dashboard
    baseUrl: 'http://localhost:4002',
    appName: 'StreetCats-Shop',
    options: {
        securityLevel: 'medium',
        autoProtect: true
    }
});

// Serve il file dell'SDK Browser per il frontend
app.use('/diana-sdk', express.static(path.join(__dirname, 'sdk/browser')));

// Aggiungi il middleware DIANA per proteggere tutte le rotte!
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(diana.monitor());

// --- LE ROTTE "REALI" DEL CLIENTE ---
app.get('/', (req, res) => {
    res.send(`
        <body style="font-family: sans-serif; padding: 20px;">
            <h1>🛒 StreetCats Ecommerce - Test Full-Stack</h1>
            <p>I tuoi acquisti sono al sicuro. 🛡️</p>
            
            <div style="background: #f4f4f4; padding: 20px; border-radius: 8px; max-width: 300px;">
                <h3>🔒 Login Cliente</h3>
                <form id="login-form">
                    <div style="margin-bottom: 10px;">
                        <input type="text" name="username" placeholder="Username" style="width: 100%; padding: 8px;">
                    </div>
                    <div style="margin-bottom: 10px;">
                        <input type="password" name="password" placeholder="Password" style="width: 100%; padding: 8px;">
                    </div>
                    <button type="submit" style="background: #2563eb; color: white; border: none; padding: 10px; width: 100%; cursor: pointer; border-radius: 4px;">Accedi</button>
                </form>
            </div>

            <script src="/diana-sdk/diana-browser.js"></script>
            <script>
                // 🛡️ Inizializza DIANA Browser SDK
                const dianaSdk = new Diana({
                    apiKey: 'hp_sk_152ef1ee598451fb60387c6f446452cc32ad038b168bad43',
                    appName: 'StreetCats-Shop',
                    baseUrl: 'http://localhost:4002'
                });

                // Monitora il form di login automaticamente
                dianaSdk.monitorLoginForm('login-form');
                
                // Traccia il caricamento pagina
                dianaSdk.trackEvent('PAGE_VIEW', { url: window.location.href });
            </script>
        </body>
    `);
});

app.get('/prodotti', (req, res) => {
    res.json([{ id: 1, nome: 'Scarpe' }, { id: 2, nome: 'Maglia' }]);
});

// Avvia il finto e-commerce sulla porta 5000
const PORT = 5000;
app.listen(PORT, () => {
    console.log(`\n🛍️  MioEcommerce (Cliente) in esecuzione su http://localhost:${PORT}`);
    console.log('🛡️  Scudo DIANA attivato. Pronto a intercettare attacchi...\n');

    // Manda manualmente un log di avvio all'SDK per fingere il "Verifica Connessione"
    diana.trackEvent('SDK_SETUP_COMPLETE', { framework: 'express' })
         .then(() => console.log('✅ Segnale di vita inviato alla Dashboard DIANA!'));
});
