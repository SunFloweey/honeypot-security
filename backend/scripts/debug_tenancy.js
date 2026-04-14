require('dotenv').config({ path: '.env' });
const { Log, ApiKey, User } = require('../src/models');
const { sequelize } = require('../src/config/database');

async function debugTenancy() {
    console.log('--- 🛡️ Debug Isolamento Multi-Tenant ---');
    try {
        // Query manuale per evitare problemi di raggruppamento Sequelize
        const stats = await Log.findAll({
            attributes: [
                'apiKeyId',
                [sequelize.fn('COUNT', sequelize.col('Log.id')), 'count']
            ],
            group: ['apiKeyId'],
            raw: true
        });

        if (stats.length === 0) {
            console.log('⚠️ Nessun log trovato nel database.');
        } else {
            for (const s of stats) {
                let ownerName = 'SISTEMA/ADMIN';
                let projectName = 'Nessun Progetto';
                
                if (s.apiKeyId) {
                    const key = await ApiKey.findByPk(s.apiKeyId, {
                        include: [{ model: User, as: 'owner', attributes: ['name'] }]
                    });
                    if (key) {
                        projectName = key.name;
                        ownerName = key.owner ? key.owner.name : 'Utente sconosciuto';
                    }
                }
                
                console.log(`📌 Proprietario: ${ownerName.padEnd(15)} | Progetto: ${projectName.padEnd(20)} | Log: ${s.count}`);
            }
        }

        const orphanLogs = await Log.count({ where: { apiKeyId: null } });
        console.log(`\n🚨 Log orfani (senza API Key): ${orphanLogs}`);

        const totalLogs = await Log.count();
        console.log(`📊 Totale log nel sistema: ${totalLogs}`);

    } catch (e) {
        console.error('❌ Errore:', e.message);
    } finally {
        process.exit();
    }
}

debugTenancy();
