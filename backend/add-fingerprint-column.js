const { sequelize } = require('./src/config/database');
const { QueryTypes } = require('sequelize');

async function addFingerprintColumn() {
    try {
        console.log('⏳ Aggiunta colonna fingerprint alla tabella logs...');

        // Verifica se la colonna esiste già
        const columns = await sequelize.query(
            "SELECT column_name FROM information_schema.columns WHERE table_name='logs' AND column_name='fingerprint'",
            { type: QueryTypes.SELECT }
        );

        if (columns.length === 0) {
            await sequelize.query('ALTER TABLE logs ADD COLUMN fingerprint VARCHAR(64)');
            await sequelize.query('CREATE INDEX idx_logs_fingerprint ON logs(fingerprint)');
            console.log('✅ Colonna fingerprint aggiunta con successo.');
        } else {
            console.log('ℹ️ La colonna fingerprint esiste già.');
        }

        process.exit(0);
    } catch (err) {
        console.error('❌ Errore durante l\'aggiornamento del DB:', err);
        process.exit(1);
    }
}

addFingerprintColumn();
