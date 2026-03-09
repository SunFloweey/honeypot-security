# ViperScan Intelligence: Technical Documentation & Architecture Overview

## 1. Executive Summary & Obiettivi

**ViperScan Intelligence** è una piattaforma **SaaS (Software-as-a-Service) di Deception Technology** progettata per rilevare, analizzare e confondere gli attaccanti informatici in tempo reale. A differenza dei sistemi di difesa perimetrale tradizionali (Firewall/WAF) che bloccano il traffico, ViperScan invita l'attaccante a interagire con risorse simulate ("allucinazioni"), trasformando l'infrastruttura difensiva in uno strumento di contro-intelligence.

### Obiettivi Strategici
1.  **Inganno Attivo (Active Deception):** Presentare superfici di attacco vulnerabili simulate (es. Web Shells, credenziali AWS esposte) per distogliere l'attenzione dalle risorse reali.
2.  **High-Fidelity Intelligence:** Raccogliere Indicatori di Compromissione (IoC) comportamentali e non solo statici. Il sistema non analizza solo *chi* attacca (IP), ma *come* e *perché* (Tattiche, Tecniche e Procedure - TTPs).
3.  **Attribuzione Multi-Tenant:** Fornire un servizio isolato a molteplici clienti (Tenant), garantendo che ogni organizzazione visualizzi e gestisca esclusivamente le proprie minacce, pur beneficiando di un'intelligenza centralizzata.

---

## 2. Architettura Logica

Il sistema opera su un modello a **doppio container (Split-Architecture)** per separare il piano di cattura (Honeypot) dal piano di gestione (Admin Dashboard), orchestrati tramite Docker.

### Flusso dei Dati (Attack Lifecycle)

1.  **Vettore d'Ingresso (The Lure):**
    *   **Diretto:** L'attaccante interagisce con le porte esposte del container Honeypot (es. `/shell.php`).
    *   **Indiretto (SDK Proxy):** Un'applicazione cliente (es. *StreetCats*) integra l'SDK ViperScan. L'SDK intercetta le richieste sospette o le chiamate a path "esca" e le instrada trasparentemente al backend ViperScan.

2.  **Cattura & Identificazione:**
    *   Il middleware `HoneyLogger` intercetta la richiesta.
    *   Viene generato un `Fingerprint` univoco dell'attaccante.
    *   Il sistema identifica il **Tenant** proprietario tramite `x-api-key`.

3.  **Engagement (The Hallucination):**
    *   Se l'attacco è una RCE (Remote Code Execution), il `VirtualTerminal` si attiva.
    *   **AI-Driven Response:** Il backend interroga un LLM (OpenAI/Gemini) per generare una risposta realistica (es. l'output di un comando `ls -la` su un finto filesystem Linux), mantenendo l'attaccante ingaggiato senza esporre il sistema reale.

4.  **Analisi & Persistenza:**
    *   I log vengono accumulati in memoria (`LogQueue`) per ridurre l'I/O sul database.
    *   Il `Classifier` assegna un **Risk Score** (0-100) basato su regole statiche e analisi comportamentale.
    *   I dati vengono persistiti su PostgreSQL.

5.  **Notifica Real-Time (SSE):**
    *   Gli eventi critici (`THREAT_SYNTHESIS`, `TERMINAL_ACTIVITY`) vengono spinti tramite Server-Sent Events (SSE) verso la Dashboard del cliente specifico, garantendo l'isolamento dei dati.

---

## 3. Stack Tecnologico

| Componente | Tecnologia | Giustificazione Tecnica |
| :--- | :--- | :--- |
| **Runtime** | **Node.js (Express)** | Gestione ottimale della concorrenza I/O grazie all'Event Loop non bloccante. |
| **Frontend** | **React + Vite** | Rendering reattivo per le dashboard di monitoraggio in tempo reale ("War Room"). |
| **Database** | **PostgreSQL + Sequelize** | Integrità relazionale necessaria per la gestione delle relazioni Utenti-API Keys-Log. |
| **AI Engine** | **OpenAI / Gemini** | Generazione dinamica di contenuti (hallucinations) realistica. |
| **Infrastructure** | **Docker Compose** | Isolamento dei processi e replicabilità dell'ambiente. |
| **Proxy** | **Nginx** | Reverse proxy per la gestione SSL e routing tra container. |

---

## 4. Mappatura del Repository

| Percorso File | Obiettivo / Funzione | Responsabilità di Sicurezza |
| :--- | :--- | :--- |
| `backend/src/honeypot/middleware/honeyLogger.js` | Sensore primario. Intercetta traffico e identifica il Tenant. | **Input Sanitization:** Redazione automatica di password/token. |
| `backend/src/honeypot/middleware/adminAuth.js` | Gestione Autenticazione Admin e Clienti SaaS. | **Segregazione:** Distinzione tra Admin Globale e Tenant. |
| `backend/src/honeypot/endpoints/terminal.js` | Endpoint per la simulazione di Webshell e RCE. | **Containment:** Comandi eseguiti in ambiente simulato. |
| `backend/src/honeypot/endpoints/dashboard.js` | API per la visualizzazione dati nelle dashboard. | **Data Isolation:** Filtri SQL per il multi-tenancy. |
| `backend/src/services/virtualTerminal.js` | Motore di emulazione shell Linux basato su IA. | **Output Sanitization:** Rimozione riferimenti all'IA. |
| `backend/src/services/aiService.js` | Wrapper per chiamate a LLM (OpenAI/Gemini). | **Circuit Breaker:** Protezione contro costi e timeout. |

---

## 5. Analisi della Sicurezza & Raccomandazioni

### Punti di Forza
*   **Isolamento Multi-Tenant:** Filtri rigorosi su tutti gli endpoint forensi.
*   **Deception Realistica:** Resistenza al fingerprinting tramite IA.
*   **Fail-Safe Logging:** Fallback su disco in caso di crash del database.

### Criticità e Miglioramenti
1.  **DoS Applicativo:** Implementare Rate Limiting specifico per il terminale IA.
2.  **Secret Management:** Migrare da `.env` a Docker Secrets o HashiCorp Vault.
3.  **Prompt Injection:** Aggiungere un layer di validazione per i comandi inviati all'IA.
4.  **Redis Integration:** Centralizzare lo stato delle sessioni e la coda dei log per permettere lo scaling orizzontale.

---
**Data Documento:** 08 Marzo 2026
**Versione:** 2.1 (SaaS Enhanced)
