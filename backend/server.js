// server.js
require('dotenv').config();
const { testConnection, syncDatabase } = require('./src/config/database');
const app = require('./src/app');

const PORT = process.env.HONEYPOT_PORT || 4001;

/**
 * STARTUP SEQUENCE
 */
async function bootstrap() {
    try {
        // 1. Database Connection
        await testConnection();

        // 2. Database Sync (Development Only)
        // Note: Move to migrations for production
        await syncDatabase();

        // 3. Start Listening
        app.listen(PORT, () => {
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
