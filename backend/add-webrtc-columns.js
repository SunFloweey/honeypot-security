const { sequelize } = require('./src/config/database');
const { QueryTypes } = require('sequelize');

async function addWebRTCColumns() {
    try {
        console.log('⏳ Aggiunta colonne WebRTC Intelligence...');

        const tableInfo = await sequelize.query(
            "SELECT column_name FROM information_schema.columns WHERE table_name='logs'",
            { type: QueryTypes.SELECT }
        );

        const columnNames = tableInfo.map(c => c.column_name);

        if (!columnNames.includes('leaked_ip')) {
            await sequelize.query('ALTER TABLE logs ADD COLUMN leaked_ip VARCHAR(64)');
            console.log('✅ Colonna leaked_ip aggiunta.');
        }

        if (!columnNames.includes('local_ip')) {
            await sequelize.query('ALTER TABLE logs ADD COLUMN local_ip VARCHAR(64)');
            console.log('✅ Colonna local_ip aggiunta.');
        }

        process.exit(0);
    } catch (err) {
        console.error('❌ Errore aggiornamento DB:', err);
        process.exit(1);
    }
}

addWebRTCColumns();
