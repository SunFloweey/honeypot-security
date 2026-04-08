const { createClient } = require('./sdk/index');
require('dotenv').config();

const config = {
    apiKey: process.env.DIANA_API_KEY || 'hp_sk_test_12345',
    baseUrl: process.env.DIANA_BASE_URL || 'http://localhost:5002',
    appName: 'Manuale-Cliente'
};

async function testManualLog() {
    const diana = createClient(config);
    console.log(`🚀 Invio log manuale a: ${config.baseUrl} (Simulazione Login Cliente)...`);
    
    const result = await diana.info('LOGIN_CLIENTE_SUCCESS', { 
        user: 'cliente_test', 
        ip: '127.0.0.1',
        note: 'Questo deve apparire nella tabella log'
    });

    if (result.success) {
        console.log('✅ Log inviato correttamente al server.');
    } else {
        console.error('❌ Invio fallito:', result.error || 'Nessun dettaglio errore (probabilmente connessione rifiutata o 401)');
    }
    
    console.log('⏳ Aspetto 7 secondi per il Flush del LogQueue nel DB...');
    await new Promise(resolve => setTimeout(resolve, 7000));
    
    console.log('✅ Test concluso. Controlla ora la Dashboard su http://localhost:5173');
}

testManualLog();
