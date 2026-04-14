# 🛡️ Piano Conformità GDPR per DIANA

## 🚨 AZIONI IMMEDIATE OBBLIGATORIE

### 1. Privacy Policy & Informativa
```markdown
# DIANA Privacy Policy
## Dati Raccolti
- IP Address (anonymizzato dopo 30 giorni)
- User Agent (solo per security research)
- Timestamp di connessione
- Comandi eseguiti (analisi minacce)
- Session ID temporaneo
## Finalità
Unicamente per cybersecurity research e threat intelligence
## Base Giuridica
Art. 6(1)(f) GDPR - Legittimo interesse alla sicurezza
## Conservazione
- Log attacchi: 365 giorni
- IP anonimizzato: 30 giorni
- Sessioni: 24 ore
## Diritti Utente
- Accesso dati: api/dati-personali
- Cancellazione: api/cancellazione-dati
- Portabilità: api/esportazione-dati
```

### 2. Cookie Banner & Tracking Notice
```javascript
// Aggiungere al frontend
const cookieConsent = {
    tracking: {
        purpose: "Cybersecurity Research",
        retention: "30 giorni IP, 365 giorni log attacchi",
        legalBasis: "Legittimo interesse sicurezza"
    }
};
```

### 3. Interfaccia GDPR API
```javascript
// Nuovi endpoint da implementare
app.get('/api/dati-personali', gdprAccess);
app.delete('/api/cancellazione-dati', gdprDelete);
app.get('/api/esportazione-dati', gdprExport);
app.post('/api/revoca-consenso', gdprRevoke);
```

### 4. Anonimizzazione Dati
```javascript
// Modifica honeyLogger.js
function anonymizeIP(ip) {
    // Rimuovi ultimi 2 ottetti per GDPR
    const parts = ip.split('.');
    return `${parts[0]}.${parts[1]}.xxx.xxx`;
}

function hashFingerprint(fingerprint) {
    // Hash one-way per non-reversibilità
    return crypto.createHash('sha256').update(fingerprint).digest('hex');
}
```

## 📋 Checklist Conformità

### ✅ DA IMPLEMENTARE SUBITO
- [ ] Privacy Policy completa
- [ ] Cookie/Tracking banner
- [ ] Anonimizzazione IP (30 giorni)
- [ ] Hashing fingerprint one-way
- [ ] Interfaccia diritti GDPR
- [ ] Data retention policy
- [ ] International data transfer assessment

### 🟡 DA MIGLIORARE
- [ ] Limitazione raccolta headers (solo essenziali)
- [ ] Opt-out tracking permanente
- [ ] Data minimization strategy
- [ ] DPIA (Data Protection Impact Assessment)

### 📊 Valutazione Rischi

| **Rischio** | **Livello** | **Mitigazione** |
|-------------|-------------|-----------------|
| Multinazionalità | Medio | Server EU-only |
| Third-party AI | Alto | Data processing agreement |
| Data retention | Medio | Automatic deletion |
| Fingerprinting | Alto | Anonimizzazione |

## 🔒 Modifiche Codice Richieste

### 1. honeyLogger.js - Anonimizzazione
```javascript
// Sostituire fingerprinting aggressivo
function generateFingerprint(req) {
    // Solo User-Agent + IP anonimizzato
    const ua = req.headers['user-agent'] || 'none';
    const ip = anonymizeIP(req.ip);
    return crypto.createHash('sha256').update(ua + ip).digest('hex');
}
```

### 2. Nuovi Endpoint GDPR
```javascript
// gdpr-endpoints.js
router.get('/api/dati-personali', async (req, res) => {
    // Restituisci solo dati dell'utente
});

router.post('/api/cancellazione-dati', async (req, res) => {
    // Cancella tutti i dati dell'utente
});
```

### 3. Frontend - Privacy Controls
```jsx
// PrivacyDashboard.jsx
const PrivacyControls = () => {
    return (
        <div>
            <h3>Privacy Controls</h3>
            <button>Download My Data</button>
            <button>Delete My Data</button>
            <button>Opt-out of Tracking</button>
        </div>
    );
};
```

## ⚖️ Valutazione Legale Finale

### 🟡 CONFORMITÀ PARZIALE (70%)
- ✅ Base giuridica valida (security research)
- ✅ Finalità legittime
- ⚠️ Mancanza informativa completa
- ❌ Mancanza interfaccia diritti
- ⚠️ Potenziale eccesso raccolta

### 🎯 AZIONI PRIORITARIE
1. **Immediato** (1 settimana): Privacy Policy + Cookie Banner
2. **Breve** (1 mese): Endpoint GDPR + Anonimizzazione
3. **Medio** (3 mesi): Data minimization completa

### 💡 Note Legali
- **Honeypot = Legittimo interesse sicurezza**: Art. 6(1)(f) GDPR
- **Security Research**: Esenzione parziale da consenso
- **Necessità DPIA**: Valutare impatto fingerprinting
- **International Transfer**: Valutare necessità server EU

## 📞 Contatti Privacy
Da implementare:
- Email: privacy@diana-security.com
- Form: /privacy-requests
- Response time: 30 giorni (GDPR requirement)
