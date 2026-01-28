# Stress Testing Guide (autocannon)

Questa guida spiega come verificare la resilienza dell'Honeypot usando `autocannon` per simulare un attacco massiccio.

## Prerequisiti

Assicurati di avere Node.js installato. Poi installa `autocannon` globalmente:

```bash
npm install -g autocannon
```

## Scenario 1: Flood Requests (Capacity Test)

Simula un attacco DDoS leggero o uno scan molto aggressivo.

**Obiettivo:** Verificare che il server risponda velocemente e non crashi, mentre i log vengono salvati in background.

```bash
# Sostituisci la porta se necessario (es. 4002)
autocannon -c 100 -d 10 -p 10 http://localhost:4002/
```

- `-c 100`: 100 connessioni concorrenti
- `-d 10`: Durata 10 secondi
- `-p 10`: 10 Pipelining requests (aumenta il throughput)

**Risultato Atteso:**
- Latenza bassa (pochi ms se è una request statica, o uguale al fake delay se configurato).
- Nessun errore di timeout o connessione rifiutata.
- Lato server: il terminale dovrebbe mostrare che `LogQueue` sta processando batch ogni 2 secondi.

## Scenario 2: Brute Force Simulation

Simula un attacco brute-force sul login.

```bash
autocannon -c 50 -d 5 -m POST -H "Content-Type: application/json" -b '{"username":"admin", "password":"password"}' http://localhost:4002/login
```

**Risultato Atteso:**
- Il `Classifier` dovrebbe rilevare il brute force (controlla i log della console server).
- Grazie a `ThreatCache`, il DB non dovrebbe essere sovraccaricato da query di conteggio.

## Scenario 3: Tarpit Test (Backup Download)

Verifica che il download del backup sia lento e consumi risorse del client, non del server.

```bash
curl -v http://localhost:4002/admin/backup/download/test.sql > /dev/null
```

**Risultato Atteso:**
- Il download non finisce subito.
- Continua a ricevere dati finché non raggiunge il limite (100MB) o finché non interrompi (CTRL+C).
