const { ApiKey, Log } = require('./src/models');
const axios = require('axios');

async function testSDK() {
    try {
        const keyRecord = await ApiKey.findOne({ where: { name: 'StreetCats' } });
        if (!keyRecord) {
            console.error('StreetCats key not found');
            return;
        }

        console.log('Using Key:', keyRecord.key);

        const response = await axios.post('http://localhost:4002/api/v1/sdk/logs', {
            event: 'test_real_connection',
            metadata: { message: 'Checking why dashboard is empty' },
            sessionKey: 'repro_session_001'
        }, {
            headers: {
                'x-api-key': keyRecord.key,
                'Content-Type': 'application/json'
            }
        });

        console.log('Response from server:', response.data);

        // Wait for LogQueue (5 seconds)
        console.log('Waiting for LogQueue flush...');
        await new Promise(r => setTimeout(r, 6000));

        const logCount = await Log.count({ where: { apiKeyId: keyRecord.id } });
        console.log('Logs associated with StreetCats:', logCount);

        if (logCount > 0) {
            console.log('✅ SDK connection is WORKING. If the dashboard is empty, check filters or frontend logs.');
        } else {
            console.log('❌ SDK connection failed to associate log. Checking LogQueue...');
        }
    } catch (err) {
        console.error('Test error:', err.message);
        if (err.response) console.error('Server response:', err.response.data);
    }
}

testSDK().then(() => process.exit());
