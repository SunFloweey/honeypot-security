const { ApiKey } = require('./src/models');
const { sequelize } = require('./src/config/database');

async function checkKey() {
    try {
        await sequelize.authenticate();
        const key = 'hp_sk_cd99ca429314f9376089494fc899da68fdcbfcf79953c6c5';
        const found = await ApiKey.findOne({ where: { key } });
        console.log('API Key search result:', found ? `Found: ${found.name}` : 'Not found');
    } catch (e) {
        console.error('Error:', e.message);
    } finally {
        await sequelize.close();
    }
}

checkKey();
