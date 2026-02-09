// Script per aggiungere la colonna risk_score alla tabella logs
const { sequelize } = require('./src/config/database');

async function migrate() {
    try {
        console.log('🔄 Connessione al database...');
        await sequelize.authenticate();
        console.log('✅ Connesso!');

        // Controlla se la colonna esiste già
        const [results] = await sequelize.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'logs' AND column_name = 'risk_score'
        `);

        if (results.length > 0) {
            console.log('ℹ️ Colonna risk_score già esistente');
        } else {
            console.log('🔄 Aggiunta colonna risk_score...');
            await sequelize.query(`
                ALTER TABLE logs 
                ADD COLUMN risk_score INTEGER DEFAULT 0
            `);
            console.log('✅ Colonna risk_score aggiunta!');
        }

        // Crea indice se non esiste
        try {
            await sequelize.query(`
                CREATE INDEX IF NOT EXISTS logs_risk_score_idx ON logs(risk_score)
            `);
            console.log('✅ Indice logs_risk_score_idx creato/verificato!');
        } catch (e) {
            console.log('ℹ️ Indice probabilmente già esistente');
        }

        console.log('🎉 Migrazione completata con successo!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Errore durante la migrazione:', error);
        process.exit(1);
    }
}

migrate();
