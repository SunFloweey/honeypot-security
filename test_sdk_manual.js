const HoneypotClient = require('./sdk/node/HoneypotClient');

// Simuliamo l'uso dell'SDK con la chiave di StreetCats trovata nel DB
const client = new HoneypotClient({
    apiKey: 'hp_sk_3bbf4b438dcc6b072134ec53acca9965a602ccf3e06a0b97',
    baseUrl: 'http://localhost:4002',
    appName: 'StreetCatsPlatform'
});

async function runTest() {
    try {
        console.log('🚀 Inviando log di test via SDK verso Docker backend (PORTA 4002)...');
        const result = await client.trackEvent('SDK_LIVE_TEST', { 
            message: 'Integrazione funzionante su Docker',
            timestamp: new Date().toISOString()
        });
        console.log('Result:', result);
    } catch (err) {
        console.error('Test failed:', err.message);
    }
}

runTest();
