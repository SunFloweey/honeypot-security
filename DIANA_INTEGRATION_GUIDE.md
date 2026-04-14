# 🛡️ Guida all'Integrazione DIANA

Questa guida spiega come utilizzare le nuove funzionalità di monitoraggio programmatico e di sistema di DIANA.

## 1. Monitoraggio Programmatico (Per Sviluppatori)

Invece di usare il classico `console.log`, integra DIANA nel tuo software per avere log sicuri e analisi in tempo reale.

### Installazione
```bash
npm install @diana-security/sdk
```

### Utilizzo nel Codice
```javascript
const { createClient } = require('@diana-security/sdk');

// Configurazione (può leggere anche da .env)
const diana = createClient({
    apiKey: 'hp_sk_...',
    baseUrl: 'http://tua-istanza-diana.com'
});

// Logging Programmatico
async function loginUser(user) {
    try {
        // Log informativo
        await diana.info(`Utente ${user.username} ha effettuato l'accesso`);
        
        // ... logica di login ...
        
    } catch (err) {
        // Log di errore (alta priorità per Diana)
        await diana.error('Errore critico durante il login', { error: err.message });
    }
}

// Warning di sicurezza
async function detectBruteForce(ip) {
    await diana.warn('Rilevato possibile attacco Brute Force', { sourceIp: ip });
}
```

---

## 2. Monitoraggio di Sistema (Demone)

Il Demone intercetta silenziosamente tutti i comandi impartiti sulla macchina ospitante e li invia al server Diana per l'analisi comportamentale.

### Avvio del Demone
Dalla cartella del tuo progetto, inizializza la configurazione (se non l'hai già fatto):
```bash
node sdk/bin/diana.js init
```

Quindi avvia il monitoraggio:
```bash
node sdk/bin/diana.js daemon start
```

### Cosa succede "sotto il cofano"?
1. Il demone monitora il file di history del sistema (PowerShell su Windows, Bash su Linux).
2. Ogni volta che viene digitato un comando (es: `whoami`, `cat .env`), il demone lo cattura.
3. Il comando viene inviato al **Terminale Virtuale** di Diana.
4. Diana analizza il comando e, se sospetto, attiva le contromisure (es. Mirage o Evacuazione).

---

## 3. Deployment Online

Ora che il ponte di comunicazione è programmatico, puoi:
1. **Deploiare il Server Diana** su un server pubblico (es. AWS, Azure, VPS).
2. **Distribuire l'SDK** come pacchetto NPM.
3. **Installare il Demone** su qualsiasi macchina tu voglia monitorare.

Ogni interazione sarà visibile in tempo reale sulla tua Dashboard Diana.
