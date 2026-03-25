const archiver = require('archiver');
const fs = require('fs');
const path = require('path');
const stream = require('stream');

/**
 * SDK Bundle Service - Genera pacchetti ZIP personalizzati per i client
 * 
 * Il bundle contiene:
 * - SDK Core (HoneypotClient.js, index.js, package.json)
 * - File di configurazione pre-compilato (diana-config.js)
 * - File di integrazione specifico per il framework scelto (diana-integration.js)
 * - README.md con istruzioni passo-passo
 * - .env.diana con le variabili d'ambiente
 */
class SdkBundleService {
    /**
     * Framework supportati con relative istruzioni di integrazione
     */
    static FRAMEWORKS = {
        express: {
            label: 'Express.js',
            integrationFile: 'diana-integration.js',
            icon: '🟢'
        },
        nextjs: {
            label: 'Next.js',
            integrationFile: 'diana-middleware.js',
            icon: '▲'
        },
        fastify: {
            label: 'Fastify',
            integrationFile: 'diana-plugin.js',
            icon: '⚡'
        },
        koa: {
            label: 'Koa.js',
            integrationFile: 'diana-koa-middleware.js',
            icon: '🔵'
        },
        generic: {
            label: 'Node.js Generico',
            integrationFile: 'diana-config.js',
            icon: '📦'
        }
    };

    /**
     * Crea un archivio ZIP contenente l'SDK e la configurazione personalizzata
     * @param {Object} params - Dati per la personalizzazione
     * @returns {Promise<Buffer>} Il buffer del file ZIP
     */
    static async createZipBundle(params) {
        let { apiKey, baseUrl, appName, options, framework = 'express', platformUrl = '' } = params;
        
        // Sanitize baseUrl: assicuriamoci che non finisca con / e che punti alla porta corretta
        if (baseUrl) {
            baseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
            // Se la baseUrl punta alla porta dell'admin (4003) o del frontend (5173), 
            // la correggiamo per puntare all'honeypot (4002)
            if (baseUrl.includes(':4003') || baseUrl.includes(':5173') || baseUrl.includes(':3000')) {
                baseUrl = baseUrl.replace(/:\d+$/, ':4002');
            }
        }

        return new Promise((resolve, reject) => {
            const chunks = [];
            const output = new stream.PassThrough();
            
            output.on('data', chunk => chunks.push(chunk));
            output.on('end', () => resolve(Buffer.concat(chunks)));
            output.on('error', reject);

            const archive = archiver('zip', { zlib: { level: 9 } });
            archive.on('error', err => reject(err));
            archive.pipe(output);

            // 1. Aggiunge i file core dell'SDK (nuova struttura unificata)
            const sdkRootDir = fs.existsSync('/app/sdk')
                ? '/app/sdk'
                : path.resolve(__dirname, '../../../../sdk');

            const sdkLibDir = path.join(sdkRootDir, 'lib');
            const browserSdkDir = path.join(sdkRootDir, 'browser');

            // Core files from the unified SDK
            if (fs.existsSync(path.join(sdkLibDir, 'DianaClient.js'))) {
                archive.file(path.join(sdkLibDir, 'DianaClient.js'), { name: 'diana-sdk/lib/DianaClient.js' });
            }
            if (fs.existsSync(path.join(sdkLibDir, 'middleware.js'))) {
                archive.file(path.join(sdkLibDir, 'middleware.js'), { name: 'diana-sdk/lib/middleware.js' });
            }
            if (fs.existsSync(path.join(sdkRootDir, 'index.js'))) {
                archive.file(path.join(sdkRootDir, 'index.js'), { name: 'diana-sdk/index.js' });
            }
            
            // Backward compatibility: include HoneypotClient.js alias
            if (fs.existsSync(path.join(sdkLibDir, 'DianaClient.js'))) {
                archive.append(
                    "const DianaClient = require('./lib/DianaClient');\nmodule.exports = DianaClient;\n",
                    { name: 'diana-sdk/HoneypotClient.js' }
                );
            }

            // Includi Browser SDK
            if (fs.existsSync(path.join(browserSdkDir, 'diana-browser.js'))) {
                archive.file(path.join(browserSdkDir, 'diana-browser.js'), { name: 'diana-sdk/browser/diana-browser.js' });
            }

            // 2. Genera il package.json personalizzato per l'SDK
            const sdkPackageJson = SdkBundleService._generatePackageJson(appName, framework);
            archive.append(sdkPackageJson, { name: 'diana-sdk/package.json' });

            // 3. Genera il file di configurazione principale
            const configContent = SdkBundleService._generateConfig(apiKey, baseUrl, appName, options);
            archive.append(configContent, { name: 'diana-sdk/diana-config.js' });

            // 4. Genera il file di integrazione specifico per il framework
            const integrationContent = SdkBundleService._generateIntegration(framework, appName);
            const frameworkInfo = SdkBundleService.FRAMEWORKS[framework] || SdkBundleService.FRAMEWORKS.express;
            archive.append(integrationContent, { name: `diana-sdk/${frameworkInfo.integrationFile}` });

            // 5. Genera il file .env.diana
            const envContent = SdkBundleService._generateEnvFile(apiKey, baseUrl, appName, options);
            archive.append(envContent, { name: 'diana-sdk/.env.diana' });

            // 6. Genera il README.md dettagliato
            const readme = SdkBundleService._generateReadme(framework, appName, apiKey, baseUrl, options, platformUrl);
            archive.append(readme, { name: 'diana-sdk/README.md' });

            // 7. Genera un file di setup rapido
            const quickSetup = SdkBundleService._generateQuickSetup(framework, appName);
            archive.append(quickSetup, { name: 'diana-sdk/setup.js' });

            archive.finalize();
        });
    }

    /**
     * Genera il package.json personalizzato
     */
    static _generatePackageJson(appName, framework) {
        const pkg = {
            name: `diana-sdk-${appName.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
            version: '1.0.0',
            description: `DIANA Security SDK - Configurato per ${appName}`,
            main: 'index.js',
            dependencies: {
                axios: '^1.6.0',
                dotenv: '^16.3.0'
            },
            scripts: {
                setup: 'node setup.js',
                verify: 'node -e "const d = require(\'.\'); const c = d.createClient(); c.trackEvent(\'SDK_VERIFY\', {status: \'ok\'}).then(r => console.log(r.success ? \'✅ Connessione OK\' : \'❌ Errore\')).catch(e => console.error(\'❌\', e.message))"'
            },
            diana: {
                framework,
                generatedAt: new Date().toISOString()
            }
        };

        return JSON.stringify(pkg, null, 2);
    }

    /**
     * Genera il file di configurazione principale
     */
    static _generateConfig(apiKey, baseUrl, appName, options) {
        const opts = options || {};
        return `/**
 * ╔══════════════════════════════════════════════════════════╗
 * ║  DIANA - Deceptive Infrastructure & Active Network Armor ║
 * ║  SDK Configuration - Auto-Generated                      ║
 * ╚══════════════════════════════════════════════════════════╝
 * 
 * Progetto: ${appName}
 * Generato il: ${new Date().toISOString()}
 * 
 * ⚠️ NON MODIFICARE la apiKey manualmente.
 *    Usa la Dashboard DIANA per rigenerare le chiavi.
 */

const { createClient } = require('.');

// Carica variabili d'ambiente se disponibili
try { require('dotenv').config({ path: require('path').join(__dirname, '.env.diana') }); } catch(e) {}

const diana = createClient({
    apiKey: process.env.DIANA_API_KEY || '${apiKey}',
    baseUrl: process.env.DIANA_BASE_URL || '${baseUrl}',
    appName: process.env.DIANA_APP_NAME || '${appName}',
    options: {
        autoProtect: ${opts.autoProtect !== false},
        securityLevel: '${opts.securityLevel || 'medium'}',
        // File sensibili da proteggere in caso di evacuazione
        sensitiveFiles: ${JSON.stringify(opts.sensitiveFiles || ['.env', 'config.json', 'sessions_data.json'])},
        // Percorsi canary (trappola per rilevare intrusioni)
        canaryPaths: ${JSON.stringify(opts.canaryPaths || ['/.env.real', '/admin/config.php', '/.git/config', '/backup.sql'])},
        // Percorsi bait (finte webshell per attirare attaccanti)
        baitPaths: ${JSON.stringify(opts.baitPaths || [
            '/shell.php', '/cmd.php', '/webshell.php', '/upload.php',
            '/cmd.jsp', '/shell.jsp', '/cmd.asp', '/shell.aspx'
        ])}
    }
});

module.exports = diana;
`;
    }

    /**
     * Genera il file di integrazione specifico per il framework
     */
    static _generateIntegration(framework, appName) {
        switch (framework) {
            case 'express':
                return SdkBundleService._expressIntegration(appName);
            case 'nextjs':
                return SdkBundleService._nextjsIntegration(appName);
            case 'fastify':
                return SdkBundleService._fastifyIntegration(appName);
            case 'koa':
                return SdkBundleService._koaIntegration(appName);
            default:
                return SdkBundleService._genericIntegration(appName);
        }
    }

    static _expressIntegration(appName) {
        return `/**
 * DIANA Integration for Express.js
 * Progetto: ${appName}
 * 
 * ISTRUZIONI RAPIDE:
 * 1. Copia la cartella diana-sdk nella root del tuo progetto
 * 2. Nel tuo app.js/server.js, aggiungi queste 2 righe:
 * 
 *    const diana = require('./diana-sdk/diana-config');
 *    app.use(diana.monitor());
 * 
 * Fatto! DIANA è attiva e protegge il tuo sito.
 */

const diana = require('./diana-config');

/**
 * Middleware Express pronto all'uso
 * Aggiunge automaticamente:
 * - Monitoraggio attacchi (SQLi, XSS, Path Traversal)
 * - Bait paths (finte webshell per catturare hacker)
 * - Canary paths (trappole per rilevare intrusioni)
 * - Analisi AI in background dei payload sospetti
 */
function dianaMiddleware(app) {
    // Protezione principale
    app.use(diana.monitor());
    
    console.log('🛡️  [DIANA] Protezione attiva per "${appName}"');
    console.log('   📡 Dashboard: ' + (process.env.DIANA_BASE_URL || '${appName}'));
    console.log('   🔒 Livello sicurezza: ' + (process.env.DIANA_SECURITY_LEVEL || 'medium'));
    
    return diana;
}

module.exports = dianaMiddleware;
module.exports.diana = diana;
`;
    }

    static _nextjsIntegration(appName) {
        return `/**
 * DIANA Middleware for Next.js
 * Progetto: ${appName}
 * 
 * ISTRUZIONI:
 * 1. Copia diana-sdk nella root del progetto
 * 2. Crea il file middleware.js nella root:
 * 
 *    // middleware.js
 *    export { default } from './diana-sdk/diana-middleware';
 * 
 * 3. Oppure, per API Routes (pages/api/*.js):
 * 
 *    import { withDiana } from '../diana-sdk/diana-middleware';
 *    export default withDiana(handler);
 */

const diana = require('./diana-config');

/**
 * Wrapper per API Routes di Next.js
 */
function withDiana(handler) {
    return async (req, res) => {
        const monitorMiddleware = diana.monitor();
        
        return new Promise((resolve) => {
            monitorMiddleware(req, res, () => {
                resolve(handler(req, res));
            });
        });
    };
}

/**
 * Per Next.js App Router (middleware.js)
 * Nota: alcune funzionalità avanzate richiedono un setup aggiuntivo
 * poiché il middleware di Next.js gira in un Edge Runtime limitato.
 */
async function nextMiddleware(request) {
    // Logging base - le features avanzate richiedono API Routes
    const path = request.nextUrl.pathname;
    const ip = request.ip || request.headers.get('x-forwarded-for') || 'unknown';
    
    // Traccia accessi a path sospetti
    const canaryPaths = ['/.env', '/.git/config', '/admin/config.php', '/backup.sql'];
    if (canaryPaths.some(cp => path.includes(cp))) {
        try {
            await diana.trackEvent('CANARY_TOUCHED', { path, ip }, ip);
        } catch(e) { /* silenzioso in produzione */ }
    }
}

module.exports = { withDiana, nextMiddleware, diana };
`;
    }

    static _fastifyIntegration(appName) {
        return `/**
 * DIANA Plugin for Fastify
 * Progetto: ${appName}
 * 
 * ISTRUZIONI:
 * 1. Copia diana-sdk nel tuo progetto
 * 2. Nel tuo server.js:
 * 
 *    const dianaPlugin = require('./diana-sdk/diana-plugin');
 *    fastify.register(dianaPlugin);
 */

const diana = require('./diana-config');
const fp = require('fastify-plugin');

async function dianaPlugin(fastify, opts) {
    // Hook onRequest per monitorare tutte le richieste
    fastify.addHook('onRequest', async (request, reply) => {
        const path = request.url;
        const ip = request.ip;
        
        // Check per bait paths
        const baitPaths = diana.options.baitPaths || [];
        if (baitPaths.includes(path)) {
            await diana.trackEvent('BAIT_TOUCHED', { path, ip }, ip);
        }
        
        // Check per canary paths
        const canaryPaths = diana.options.canaryPaths || [];
        if (canaryPaths.includes(path)) {
            await diana.trackEvent('CANARY_TOUCHED', { path, method: request.method, ip }, ip);
            reply.code(404).send('Not Found');
            return;
        }
        
        // Check per payload sospetti
        const payload = JSON.stringify({ query: request.query, body: request.body });
        if (diana._isSuspicious && diana._isSuspicious(payload)) {
            await diana.trackEvent('SUSPICIOUS_PAYLOAD', { path, payload, ip }, ip);
        }
    });
    
    // Decoratore per accedere a diana da qualsiasi punto
    fastify.decorate('diana', diana);
    
    console.log('🛡️  [DIANA] Plugin Fastify registrato per "${appName}"');
}

module.exports = fp(dianaPlugin, {
    name: 'diana-security',
    fastify: '>=4.0.0'
});
module.exports.diana = diana;
`;
    }

    static _koaIntegration(appName) {
        return `/**
 * DIANA Middleware for Koa.js
 * Progetto: ${appName}
 * 
 * ISTRUZIONI:
 * 1. Copia diana-sdk nel tuo progetto
 * 2. Nel tuo app.js:
 * 
 *    const dianaMiddleware = require('./diana-sdk/diana-koa-middleware');
 *    app.use(dianaMiddleware());
 */

const diana = require('./diana-config');

function dianaKoaMiddleware() {
    return async (ctx, next) => {
        const path = ctx.path;
        const ip = ctx.ip || ctx.request.ip;
        
        // Check per bait paths
        const baitPaths = diana.options.baitPaths || [];
        if (baitPaths.includes(path)) {
            await diana.trackEvent('BAIT_TOUCHED', { path, ip }, ip);
        }
        
        // Check per canary paths
        const canaryPaths = diana.options.canaryPaths || [];
        if (canaryPaths.includes(path)) {
            await diana.trackEvent('CANARY_TOUCHED', { path, method: ctx.method, ip }, ip);
            ctx.status = 404;
            ctx.body = 'Not Found';
            return;
        }
        
        // Check per payload sospetti
        const payload = JSON.stringify({ query: ctx.query, body: ctx.request.body });
        if (diana._isSuspicious && diana._isSuspicious(payload)) {
            await diana.trackEvent('SUSPICIOUS_PAYLOAD', { path, payload, ip }, ip);
        }
        
        await next();
    };
}

module.exports = dianaKoaMiddleware;
module.exports.diana = diana;
`;
    }

    static _genericIntegration(appName) {
        return `/**
 * DIANA Generic Integration
 * Progetto: ${appName}
 * 
 * Per ambienti Node.js senza un framework specifico.
 * Usa direttamente le API del client.
 * 
 * ESEMPIO:
 *    const diana = require('./diana-sdk/diana-config');
 *    
 *    // Traccia un evento
 *    diana.trackEvent('LOGIN_ATTEMPT', { user: 'admin', ip: '1.2.3.4' });
 *    
 *    // Analizza un payload sospetto
 *    diana.analyzePayload(suspicious_data);
 */

const diana = require('./diana-config');

console.log('🛡️  [DIANA] SDK inizializzato per "${appName}"');
console.log('   Usa diana.trackEvent() per inviare eventi alla dashboard.');
console.log('   Usa diana.monitor() se usi Express come middleware.');

module.exports = diana;
`;
    }

    /**
     * Genera il file .env.diana
     */
    static _generateEnvFile(apiKey, baseUrl, appName, options) {
        return `# ╔══════════════════════════════════════════════════╗
# ║  DIANA SDK - Variabili d'ambiente                 ║
# ║  Rinomina questo file in .env o aggiungi al tuo   ║
# ╚══════════════════════════════════════════════════╝

# Chiave API (NON condividere!)
DIANA_API_KEY=${apiKey}

# URL del server DIANA
DIANA_BASE_URL=${baseUrl}

# Nome della tua applicazione
DIANA_APP_NAME=${appName}

# Livello di sicurezza: low | medium | high
DIANA_SECURITY_LEVEL=${(options && options.securityLevel) || 'medium'}

# Auto-protezione: true | false
DIANA_AUTO_PROTECT=${options && options.autoProtect !== false ? 'true' : 'false'}
`;
    }

    /**
     * Genera il README.md dettagliato
     */
    static _generateReadme(framework, appName, apiKey, baseUrl, options, platformUrl) {
        const frameworkInfo = SdkBundleService.FRAMEWORKS[framework] || SdkBundleService.FRAMEWORKS.express;
        
        const frameworkInstructions = {
            express: `
### Integrazione Express.js (2 righe di codice)

\`\`\`javascript
// Nel tuo app.js o server.js
const express = require('express');
const app = express();

// ✅ Aggiungi queste 2 righe:
const diana = require('./diana-sdk/diana-config');
app.use(diana.monitor());

// Il resto del tuo codice...
app.listen(3000);
\`\`\``,
            nextjs: `
### Integrazione Next.js

**Opzione 1: API Routes (consigliata)**
\`\`\`javascript
// pages/api/your-route.js
import { withDiana } from '../../diana-sdk/diana-middleware';

function handler(req, res) {
    res.json({ hello: 'world' });
}

export default withDiana(handler);
\`\`\`

**Opzione 2: Server Custom**
\`\`\`javascript
// server.js
const diana = require('./diana-sdk/diana-config');
// Usa diana.trackEvent() per monitoraggio manuale
\`\`\``,
            fastify: `
### Integrazione Fastify

\`\`\`javascript
const fastify = require('fastify')();
const dianaPlugin = require('./diana-sdk/diana-plugin');

fastify.register(dianaPlugin);

// Usa fastify.diana per accedere all'SDK
fastify.get('/test', async (request, reply) => {
    await fastify.diana.trackEvent('PAGE_VIEW', { path: '/test' });
    return { hello: 'world' };
});

fastify.listen({ port: 3000 });
\`\`\``,
            koa: `
### Integrazione Koa.js

\`\`\`javascript
const Koa = require('koa');
const app = new Koa();
const dianaMiddleware = require('./diana-sdk/diana-koa-middleware');

app.use(dianaMiddleware());

app.listen(3000);
\`\`\``,
            generic: `
### Uso Generico (Node.js)

\`\`\`javascript
const diana = require('./diana-sdk/diana-config');

// Traccia un evento di sicurezza
await diana.trackEvent('SUSPICIOUS_LOGIN', {
    user: username,
    attempts: failedAttempts,
    ip: clientIp
});

// Analizza un payload sospetto con l'AI
const analysis = await diana.analyzePayload(suspiciousInput);
if (analysis.risk_level === 'Critical') {
    // Attiva la protezione automatica
    await diana.triggerEvacuation('Minaccia critica rilevata');
}
\`\`\``,
        };

        return `# 🛡️ DIANA SDK - Guida di Integrazione

> **Progetto:** ${appName}  
> **Framework:** ${frameworkInfo.icon} ${frameworkInfo.label}  
> **Generato il:** ${new Date().toLocaleDateString('it-IT')}  
${platformUrl ? `> **Piattaforma:** ${platformUrl}  \n` : ''}
---

## 🚀 Setup Rapido (3 minuti)

### 1. Copia la cartella
Copia l'intera cartella \`diana-sdk\` nella **root** del tuo progetto:
\`\`\`
tuo-progetto/
├── diana-sdk/          ← Copia qui
│   ├── diana-config.js
│   ├── HoneypotClient.js
│   ├── index.js
│   ├── package.json
│   └── ...
├── package.json
└── ...
\`\`\`

### 2. Installa le dipendenze
\`\`\`bash
cd diana-sdk && npm install && cd ..
\`\`\`

### 3. Integra nel tuo codice
${frameworkInstructions[framework] || frameworkInstructions.express}

---

## 🌐 Monitoraggio Frontend (Opzionale ma Consigliato)

Per monitorare azioni lato client (come i form di login), includi lo script in fondo al tuo HTML:

\`\`\`html
<!-- Includi l'SDK Browser -->
<script src="/diana-sdk/diana-browser.js"></script>

<script>
  // Inizializza
  const dianaClient = new Diana({
    apiKey: '${apiKey}',
    appName: '${appName}',
    baseUrl: '${baseUrl}'
  });

  // Esempio: Monitora il form di login automaticamente
  dianaClient.monitorLoginForm('id-del-tuo-form-login');

  // Esempio: Traccia un evento personalizzato
  // dianaClient.trackEvent('BUTTON_CLICK', { id: 'checkout-btn' });
</script>
\`\`\`

---

### 4. Verifica la connessione
\`\`\`bash
cd diana-sdk && npm run verify
\`\`\`

---

## 🔧 Configurazione

Le impostazioni si trovano in \`diana-config.js\` oppure nel file \`.env.diana\`:

| Variabile | Valore | Descrizione |
|-----------|--------|-------------|
| \`DIANA_API_KEY\` | \`${apiKey.substring(0, 8)}....\` | La tua chiave API |
| \`DIANA_BASE_URL\` | \`${baseUrl}\` | Server DIANA |
| \`DIANA_APP_NAME\` | \`${appName}\` | Nome del progetto |
| \`DIANA_SECURITY_LEVEL\` | \`${(options && options.securityLevel) || 'medium'}\` | low / medium / high |
| \`DIANA_AUTO_PROTECT\` | \`${options && options.autoProtect !== false}\` | Auto-distruzione dati sensibili |

---

## 🍯 Funzionalità Incluse

- **🔍 Monitoraggio Attacchi**: Rileva automaticamente SQLi, XSS, Path Traversal
- **🕸️ Bait Paths**: Finte webshell che catturano gli hacker
- **🐦 Canary Paths**: Trappole invisibili che segnalano intrusioni
- **🤖 Analisi AI**: Analisi intelligente dei payload sospetti
- **🔒 Auto-Protezione**: Cifratura e distruzione automatica dei dati sensibili
- **🖥️ Virtual Terminal**: Finto terminale per intrappolare gli aggressori

---

## 📊 Dashboard

Accedi alla tua dashboard per monitorare gli eventi:
${baseUrl}/auth-portal

---

## ⚠️ Avvertenze di Sicurezza

- **NON** committare la chiave API nel repository pubblico
- Usa il file \`.env.diana\` per le credenziali e aggiungilo al \`.gitignore\`
- Rigenera le chiavi dalla Dashboard se vengono compromesse

---

*Generato automaticamente da DIANA Intelligence Platform*
`;
    }

    /**
     * Genera lo script di setup rapido
     */
    static _generateQuickSetup(framework, appName) {
        return `#!/usr/bin/env node
/**
 * DIANA SDK - Quick Setup Script
 * Esegui: node setup.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('');
console.log('╔══════════════════════════════════════════════════════════╗');
console.log('║  🛡️  DIANA SDK - Setup automatico                       ║');
console.log('║  Progetto: ${appName.padEnd(42)}║');
console.log('╚══════════════════════════════════════════════════════════╝');
console.log('');

// 1. Installa dipendenze
console.log('📦 Installazione dipendenze...');
try {
    execSync('npm install', { cwd: __dirname, stdio: 'pipe' });
    console.log('   ✅ Dipendenze installate');
} catch(e) {
    console.error('   ❌ Errore installazione:', e.message);
    process.exit(1);
}

// 2. Copia .env.diana nel progetto parent (se non esiste già)
const parentDir = path.resolve(__dirname, '..');
const envSource = path.join(__dirname, '.env.diana');
const envDest = path.join(parentDir, '.env.diana');

if (!fs.existsSync(envDest) && fs.existsSync(envSource)) {
    fs.copyFileSync(envSource, envDest);
    console.log('   ✅ File .env.diana copiato nella root del progetto');
}

// 3. Aggiorna .gitignore
const gitignorePath = path.join(parentDir, '.gitignore');
const dianaIgnore = '\\n# DIANA SDK secrets\\n.env.diana\\ndiana-sdk/.env.diana\\n';
if (fs.existsSync(gitignorePath)) {
    const content = fs.readFileSync(gitignorePath, 'utf8');
    if (!content.includes('.env.diana')) {
        fs.appendFileSync(gitignorePath, dianaIgnore);
        console.log('   ✅ .gitignore aggiornato');
    }
} else {
    fs.writeFileSync(gitignorePath, dianaIgnore);
    console.log('   ✅ .gitignore creato');
}

// 4. Verifica connessione
console.log('');
console.log('📡 Verifica connessione con il server DIANA...');
try {
    const diana = require('./diana-config');
    diana.trackEvent('SDK_SETUP_COMPLETE', { 
        framework: '${framework}',
        setupTime: new Date().toISOString()
    }).then(result => {
        if (result.success) {
            console.log('   ✅ Connessione riuscita! Il server DIANA sta ricevendo i dati.');
        } else {
            console.log('   ⚠️  Connessione stabilita ma risposta anomala:', result.error);
        }
        console.log('');
        console.log('🎉 Setup completato! Ora integra DIANA nel tuo codice.');
        console.log('   Leggi README.md per le istruzioni specifiche.');
        console.log('');
    }).catch(err => {
        console.log('   ⚠️  Il server non è raggiungibile:', err.message);
        console.log('   Assicurati che il server DIANA sia avviato.');
        console.log('');
    });
} catch(e) {
    console.error('   ❌ Errore verifica:', e.message);
}
`;
    }
}

module.exports = SdkBundleService;
