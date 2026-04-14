# DIANA: Deceptive Infrastructure & Analysis Network Agent

## Executive Summary & Obiettivi

**DIANA** è una piattaforma **SaaS (Software-as-a-Service) di Deception Technology** progettata per rilevare, analizzare e confondere gli attaccanti informatici in tempo reale. A differenza dei sistemi di difesa perimetrale tradizionali (Firewall/WAF) che bloccano il traffico, DIANA invita l'attaccante a interagire con risorse simulate ("allucinazioni"), trasformando l'infrastruttura difensiva in uno strumento di contro-intelligence.

### Il Nome DIANA
DIANA (Deceptive Infrastructure & Analysis Network Agent) prende il nome dalla dea romana della caccia e della luna, simboleggiando:
- **Caccia**: Rilevamento proattivo delle minacce
- **Luna**: Visione notturna delle attività nascoste
- **Agilità**: Capacità di adattarsi e rispondere rapidamente

### Obiettivi Strategici
1. **Inganno Attivo (Active Deception):** Presentare superfici di attacco vulnerabili simulate (es. Web Shells, credenziali AWS esposte) per distogliere l'attenzione dalle risorse reali.
2. **High-Fidelity Intelligence:** Raccogliere Indicatori di Compromissione (IoC) comportamentali e non solo statici. Il sistema non analizza solo *chi* attacca (IP), ma *come* e *perché* (Tattiche, Tecniche e Procedure - TTPs).
3. **Attribuzione Multi-Tenant:** Fornire un servizio isolato a molteplici clienti (Tenant), garantendo che ogni organizzazione visualizzi e gestisca esclusivamente le proprie minacce, pur beneficiando di un'intelligenza centralizzata.

---

## Architettura Logica

### 1. **Deception Layer**
- **Honeypots Intelligenti:** Servizi simulati che appaiono come risorse reali vulnerabili
- **Honeytokens:** Credenziali false e risorse appetibili per gli attaccanti
- **Attack Surface Management:** Controllo dinamico delle superfici di attacco esposte

### 2. **Intelligence Layer**
- **AI-Powered Analysis:** Integrazione con OpenAI GPT e Google Gemini per analisi comportamentale
- **Threat Synthesis:** Correlazione automatica di eventi multipli
- **TTP Mapping:** Mappatura su framework MITRE ATT&CK

### 3. **Multi-Tenant Layer**
- **Tenant Isolation:** Separazione completa dei dati per cliente
- **Role-Based Access Control:** Permessi granulari per admin e client
- **SaaS Management:** Gestione centralizzata con visibilità isolata

---

## Stack Tecnologico

### Backend
- **Runtime:** Node.js 18+
- **Framework:** Express.js
- **Database:** PostgreSQL 15 con Sequelize ORM
- **Real-time:** Socket.io
- **AI Integration:** OpenAI API + Google Generative AI
- **Security:** Helmet.js, JWT, bcryptjs

### Frontend
- **Framework:** React 19.2 con Vite
- **Styling:** CSS vanilla con custom properties
- **Charts:** Recharts per visualizzazioni
- **Real-time:** Socket.io Client

### Infrastruttura
- **Containerizzazione:** Docker + Docker Compose
- **Database:** PostgreSQL in container
- **Web Server:** Nginx

---

## Caratteristiche Principali

### 🎯 **Deception Technology**
- Honeypots multipli (SSH, HTTP, Database)
- Honeytoken management
- Attack surface dinamica

### 🤖 **AI-Powered Analysis**
- Analisi comportamentale in tempo reale
- Threat synthesis automatica
- Pattern recognition con ML

### 🏢 **Multi-Tenant SaaS**
- Isolamento completo per tenant
- Dashboard separate per admin/client
- Gestione centralizzata

### 📊 **Real-time Monitoring**
- WebSocket per aggiornamenti live
- Alert intelligenti
- Session reconstruction

---

## Getting Started

### Prerequisiti
- Docker Desktop
- Node.js 18+
- Git

### Avvio Rapido
```bash
# Clona il repository
git clone <repository-url>
cd diana

# Avvia tutti i servizi
docker-compose up --build

# Accedi alle dashboard
# Admin: http://localhost:4003
# Frontend: http://localhost:80
```

### Configurazione
1. Copia `backend/.env.example` in `backend/.env`
2. Configura le tue API keys per OpenAI e Gemini
3. Avvia i servizi con Docker Compose

---

## Sicurezza e Privacy

### Data Protection
- Crittografia end-to-end
- Isolamento tenant completo
- Audit logging completo

### Compliance
- GDPR ready
- ISO 27001 allineato
- SOC 2 Type II preparato

---

## Roadmap

### v2.0 - Q2 2026
- Advanced honeytoken templates
- MITRE ATT&CK integration completa
- Mobile dashboard

### v2.5 - Q3 2026
- Machine learning models custom
- Threat intelligence feeds
- Automated response playbooks

### v3.0 - Q4 2026
- Zero-trust architecture
- Cloud native deployment
- Advanced analytics platform

---

## Licenza e Supporto

DIANA è rilasciato sotto licenza MIT. Per supporto enterprise e implementazioni custom, contattare il team di sviluppo.

---

**DIANA - La caccia alle minacce informatiche non è mai stata così intelligente.**
