const { sequelize } = require('./src/config/database');
const Log = require('./src/models/Log');
const Classification = require('./src/models/Classification');

async function testModel() {
    try {
        await sequelize.authenticate();
        console.log('Connection established.');

        console.log('Testing Log.findAll()...');
        const logs = await Log.findAll({
            limit: 1,
            include: [Classification],
            logging: console.log
        });
        console.log('Log found:', logs.length);
    } catch (error) {
        console.error('❌ Model Test Error:', error);
    } finally {
        await sequelize.close();
    }
}

testModel();
