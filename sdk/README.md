# 🛡️ DIANA Security SDK

> **Deceptive Infrastructure & Active Network Armor**  
> Proteggi la tua applicazione Node.js con honeypot, honeytoken, e difesa attiva AI-powered.

---

## 🚀 Installazione

```bash
npm install @diana-security/sdk
```

---

## ⚡ Quick Start

### 1. Configura il progetto

```bash
npx diana init
```

Il comando interattivo ti chiederà:
- **Server URL** — l'indirizzo del tuo server DIANA
- **API Key** — la chiave generata dalla Dashboard DIANA
- **App Name** — il nome della tua applicazione
- **Security Level** — livello di protezione (low / medium / high)

Le configurazioni vengono salvate nel file `.env` del progetto.

### 2. Integra nel codice

#### Express.js (consigliato)

```javascript
const express = require('express');
const app = express();

const diana = require('@diana-security/sdk').createClient();
app.use(diana.monitor());

app.listen(3000);
```

#### Tracking manuale

```javascript
const diana = require('@diana-security/sdk').createClient();

// Traccia un evento di sicurezza
await diana.trackEvent('LOGIN_ATTEMPT', {
    user: 'admin',
    ip: '192.168.1.100',
    success: false
});

// Analizza un payload sospetto con l'AI
const analysis = await diana.analyzePayload(suspiciousInput);

// Genera un honeytoken (credenziale esca)
const token = await diana.generateHoneytoken('aws');
```

### 3. Verifica la connessione

```bash
npx diana verify
```

---

## 📋 Configurazione

L'SDK legge automaticamente dal file `.env`:

| Variabile | Descrizione | Obbligatorio |
|-----------|-------------|:------------:|
| `DIANA_API_KEY` | Chiave API dalla Dashboard | ✅ |
| `DIANA_BASE_URL` | URL del server DIANA | ✅ |
| `DIANA_APP_NAME` | Nome della tua applicazione | ❌ |
| `DIANA_SECURITY_LEVEL` | low / medium / high | ❌ |
| `DIANA_AUTO_PROTECT` | true / false | ❌ |

Oppure passa la configurazione direttamente:

```javascript
const diana = require('@diana-security/sdk').createClient({
    apiKey: 'hp_sk_xxxxxxxxxxxx',
    baseUrl: 'https://diana.example.com',
    appName: 'MyEcommerce',
    options: {
        securityLevel: 'high',
        autoProtect: true
    }
});
```

---

## 🖥️ CLI Commands

| Comando | Descrizione |
|---------|-------------|
| `npx diana init` | Setup interattivo del progetto |
| `npx diana login` | Login con email/password |
| `npx diana keys` | Lista le tue API key |
| `npx diana verify` | Verifica la connessione al server |
| `npx diana status` | Mostra la configurazione attuale |

---

## 🔌 Integrazione Framework

### Express.js
```javascript
const diana = require('@diana-security/sdk').createClient();
app.use(diana.monitor());
```

### Fastify
```javascript
const { fastifyPlugin } = require('@diana-security/sdk');
fastify.register(fastifyPlugin);
// Accedi con fastify.diana.trackEvent(...)
```

### Koa
```javascript
const { koaMiddleware } = require('@diana-security/sdk');
app.use(koaMiddleware());
```

### Standalone (Express middleware factory)
```javascript
const { expressMiddleware } = require('@diana-security/sdk');
app.use(expressMiddleware({ apiKey: '...', baseUrl: '...' }));
```

---

## 🍯 Funzionalità

- **🔍 Monitoraggio Attacchi** — Rileva SQLi, XSS, Path Traversal automaticamente
- **🕸️ Bait Paths** — Finte webshell che catturano gli hacker
- **🐦 Canary Paths** — Trappole invisibili che segnalano intrusioni
- **🤖 Analisi AI** — Analisi intelligente dei payload sospetti
- **🔒 Auto-Protezione** — Cifratura e distruzione automatica dei dati sensibili
- **🖥️ Virtual Terminal** — Finto terminale sandboxed per intrappolare aggressori
- **🍯 Honeytoken** — Genera credenziali esca (AWS, MongoDB, Stripe, JWT)

---

## 🌐 Browser SDK

Per il monitoraggio lato client, includi lo script nel tuo HTML:

```html
<script src="/node_modules/@diana-security/sdk/browser/diana-browser.js"></script>
<script>
    const diana = new Diana({
        apiKey: 'API_KEY_HERE',
        appName: 'MyApp',
        baseUrl: 'https://diana.example.com'
    });

    diana.monitorLoginForm('login-form');
    diana.trackEvent('PAGE_VIEW', { url: window.location.href });
</script>
```

---

## ⚠️ Sicurezza

- **NON** committare la chiave API in repository pubblici
- Aggiungi `.env` al `.gitignore`
- Rigenera le chiavi dalla Dashboard se compromesse
- Usa HTTPS in produzione

---

## 📄 License

MIT © DIANA Security Team
