/**
 * guardianDaemon.js - Il "Cane da Guardia" dell'Honeypot
 * 
 * Questo script gira come processo separato e monitora la salute del server principale.
 * Se il server smette di rispondere (Heartbeat timeout), attiva l'autoprotezione.
 */

const dgram = require('dgram');
const IntrusionResponseService = require('./intrusionResponseService');

// CONFIGURAZIONE
const HEARTBEAT_PORT = 4005;
const HEARTBEAT_TIMEOUT = 6000; // 6 secondi di tolleranza
const CHECK_INTERVAL = 2000;    // Controlla ogni 2 secondi

let lastHeartbeat = Date.now();
let isProtectorActive = false;

const server = dgram.createSocket('udp4');

server.on('message', (msg, rinfo) => {
    const data = msg.toString();
    if (data === 'HEARTBEAT_OK') {
        lastHeartbeat = Date.now();
    } else if (data === 'SHUTDOWN_OK') {
        console.log('🛑 [Guardian] Ricevuto segnale di spegnimento autorizzato. Disattivazione...');
        isProtectorActive = true; // Blocca ulteriori azioni
        process.exit(0);
    }
});

server.on('error', (err) => {
    console.error(`[Guardian] Errore Socket: ${err.stack}`);
    server.close();
});

server.on('listening', () => {
    const address = server.address();
    console.log(`🛡️ [Guardian] Watchdog attivo su port ${address.port}`);
    console.log(`🛡️ [Guardian] Timeout impostato a ${HEARTBEAT_TIMEOUT}ms`);
});

// Funzione di monitoraggio
const monitor = async () => {
    if (isProtectorActive) return;

    const now = Date.now();
    const diff = now - lastHeartbeat;

    if (diff > HEARTBEAT_TIMEOUT) {
        isProtectorActive = true;
        console.error('\n🚨🚨🚨 [GUARDIAN ALERT] SERVER PRINCIPALE NON RISPONDE! 🚨🚨🚨');
        console.error(`🚨 Ultimo segnale ricevuto ${diff}ms fa.`);

        try {
            await IntrusionResponseService.secureEvacuationChain('Guardian: Main server heartbeat lost / Process killed');
            console.log('✅ [Guardian] Dati messi in sicurezza con successo.');
        } catch (err) {
            console.error('❌ [Guardian] Errore critico durante l\'evacuazione:', err);
        } finally {
            // Dopo l'evacuazione, il daemon può terminare o restare in attesa
            process.exit(1);
        }
    }
};

// Avvio monitoraggio
server.bind(HEARTBEAT_PORT);
setInterval(monitor, CHECK_INTERVAL);

// Gestione chiusura pulita
process.on('SIGINT', () => {
    console.log('[Guardian] Spegnimento monitoraggio...');
    server.close();
    process.exit();
});
