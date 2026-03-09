require('dotenv').config();
const { Session } = require('../src/models');
const { Op } = require('sequelize');
const fs = require('fs');

async function main() {
    try {
        const sessions = await Session.findAll({
            where: { maxRiskScore: { [Op.gt]: 0 } },
            limit: 10,
            order: [['maxRiskScore', 'DESC']],
            attributes: ['sessionKey', 'ipAddress', 'maxRiskScore', 'requestCount', 'firstSeen', 'lastSeen']
        });

        const output = sessions.map((s, i) => s.toJSON());
        fs.writeFileSync('sessions_data.json', JSON.stringify(output, null, 2), 'utf8');
        console.log('Written to sessions_data.json (' + sessions.length + ' sessions)');

    } catch (e) {
        console.error('Errore:', e.message);
    } finally {
        process.exit(0);
    }
}

main();
