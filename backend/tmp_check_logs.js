
const { sequelize } = require('./src/config/database');
const TerminalCommand = require('./src/models/TerminalCommand');

async function check() {
    try {
        await sequelize.authenticate();
        const logs = await TerminalCommand.findAll({
            limit: 5,
            order: [['timestamp', 'DESC']]
        });
        console.log(JSON.stringify(logs, null, 2));
    } catch (e) {
        console.error(e);
    } finally {
        process.exit();
    }
}
check();
