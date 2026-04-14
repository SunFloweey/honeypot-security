require('dotenv').config({ path: '../.env' }); // Load .env from parent (backend/)
const { sequelize } = require('../src/config/database');

async function checkSchema() {
    try {
        await sequelize.authenticate();
        console.log('✅ Connected to database.');

        const [results, metadata] = await sequelize.query(
            "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'logs';"
        );

        console.log('📋 Existing columns in "logs" table:');
        results.forEach(col => {
            console.log(` - ${col.column_name} (${col.data_type})`);
        });

    } catch (error) {
        console.error('❌ Error checking schema:', error);
    } finally {
        await sequelize.close();
    }
}

checkSchema();
