require('dotenv').config({ path: '../.env' });
const { sequelize } = require('../src/config/database');
const Log = require('../src/models/Log');
const Session = require('../src/models/Session');
const { Op } = require('sequelize');
// Specifichiamo che la chiave esterna nel modello Log è 'sessionKey'
Log.belongsTo(Session, { foreignKey: 'sessionKey', targetKey: 'sessionKey' });
async function verifyAttack() {
    try {
        console.log('🔍 Connecting to database...');
        await sequelize.authenticate();
        console.log('✅ Connected.');

        // Verify recent logs (simpler query first)
        console.log('📊 Counting recent logs...');
        const count = await Log.count({
            where: {
                timestamp: {
                    [Op.gte]: new Date(Date.now() - 10 * 60 * 1000)
                }
            }
        });
        console.log(`Found ${count} recent logs.`);

        console.log('🔍 Searching for attack payload (UNION SELECT)...');
        const logs = await Log.findAll({
            where: {
                [Op.or]: [
                    { body: { [Op.like]: '%UNION SELECT%' } },
                    { queryParams: { [Op.contains]: {} } } // Just to trigger a scan, relying on order
                ]
            },
            include: [{
                model: Session,
                required: false
            }],
            order: [['timestamp', 'DESC']],
            limit: 5,
            logging: console.log // Print SQL
        });

        if (logs.length > 0) {
            console.log(`\n✅ SUCCESS: Found ${logs.length} logs.`);
            logs.forEach(log => {
                console.log(`[${log.timestamp}] ${log.method} ${log.path} (Risk: ${log.Session?.maxRiskScore ?? 'N/A'})`);
                console.log(`   Body: ${log.body}`);
                console.log(`   Query: ${JSON.stringify(log.queryParams)}`);
            });
            process.exit(0);
        } else {
            console.error('\n❌ FAILURE: No attack logs found containing "UNION SELECT".');
            process.exit(1);
        }

    } catch (error) {
        console.error('\n❌ Error verifying attack:', error);
        process.exit(1);
    } finally {
        await sequelize.close();
    }
}

verifyAttack();
