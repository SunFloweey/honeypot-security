// server.js
require('dotenv').config();
const app = require('./src/app');

const { sequelize, testConnection } = require('./src/config/database');
const threatCache = require('./src/honeypot/utils/threatCache');
const logQueue = require('./src/honeypot/utils/logQueue'); // Spostato qui in alto

const PORT = process.env.HONEYPOT_PORT || 4001;

let server;

async function bootstrap() {
    try {
        // 1. Database Connection
        await testConnection();

        // Sync models (ensure tables exist)
        console.log('⏳ Sincronizzazione modelli DB...');
        await sequelize.sync();
        console.log('✅ Modelli DB sincronizzati.');

        // Hydrate ThreatCache (State Continuity)
        await threatCache.hydrate();

        // 3. Start Listening
        server = app.listen(PORT, () => {
            console.log(`
╔════════════════════════════════════════╗
║   🍯  HONEYPOT SERVER ACTIVE           ║
║                                        ║
║   Port: ${PORT}                           ║
║   Mode: TRAP                           ║
║   Status: LISTENING FOR THREATS        ║
╚════════════════════════════════════════╝
          `);
        });
    } catch (error) {
        console.error('❌ FATAL: Bootstrap sequence failed');
        console.error(error);
        process.exit(1);
    }
}

bootstrap();

async function gracefulShutdown(signal) {
    console.log(`\n🛑 ${signal} ricevuto. Inizio procedura di spegnimento...`);

    if (server) {
        // 1. Smetti di accettare nuove connessioni
        server.close(async () => {
            console.log('HTTP server chiuso.');

            try {
                // 2. Svuota la coda dei log (Cruciale per Honeypot)
                console.log('⏳ Svuotamento coda log...');
                if (logQueue.flush) await logQueue.flush(true);

                // 3. Chiudi connessioni DB
                console.log('⏳ Chiusura connessione DB...');
                await sequelize.close();

                console.log('✅ Shutdown completato con successo.');
                process.exit(0);
            } catch (err) {
                console.error('⚠️ Errore durante lo shutdown:', err);
                process.exit(1);
            }
        });
    } else {
        process.exit(0);
    }

    // Force exit se ci mette troppo (es. 10 secondi)
    setTimeout(() => {
        console.error('❌ Shutdown forzato per timeout.');
        process.exit(1);
    }, 10000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));