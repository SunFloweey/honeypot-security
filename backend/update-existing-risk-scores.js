// Script per aggiornare il risk_score dei log esistenti
// basato sulle classificazioni già presenti
const { sequelize } = require('./src/config/database');

async function updateExistingLogs() {
    try {
        console.log('🔄 Connessione al database...');
        await sequelize.authenticate();
        console.log('✅ Connesso!');

        // Aggiorna risk_score per ogni log basato sulle classificazioni
        // Somma i risk_score delle classificazioni associate
        console.log('🔄 Aggiornamento risk_score sui log esistenti...');

        const [affectedRows] = await sequelize.query(`
            UPDATE logs
            SET risk_score = COALESCE(
                (SELECT SUM(c.risk_score) 
                 FROM classifications c 
                 WHERE c.log_id = logs.id),
                0
            )
        `);

        console.log(`✅ Log aggiornati!`);

        // Verifica
        const [result] = await sequelize.query(`
            SELECT COUNT(*) as total, 
                   SUM(CASE WHEN risk_score > 0 THEN 1 ELSE 0 END) as with_risk
            FROM logs
        `);

        console.log(`📊 Statistiche: ${result[0].with_risk} log con risk score > 0 su ${result[0].total} totali`);

        process.exit(0);
    } catch (error) {
        console.error('❌ Errore:', error);
        process.exit(1);
    }
}

updateExistingLogs();
