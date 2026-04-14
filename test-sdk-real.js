/**
 * Test completo: SDK locale → Backend Docker (porta 4002)
 * 
 * Cosa testa:
 *  1. Connessione al server (verify)
 *  2. Invio di un log di sicurezza
 *  3. Generazione di un honeytoken
 *  4. Analisi AI di un payload sospetto
 * 
 * Come usarlo:
 *   node test-sdk-real.js
 */

const { createClient } = require('./sdk');

const diana = createClient({
    apiKey: 'PasswordSuperSegreta',
    baseUrl: 'http://localhost:5002',
    appName: 'TestDianaLocale'
});

async function runTests() {
    console.log('\n╔══════════════════════════════════════════════════╗');
    console.log('║   🛡️  DIANA SDK — Test di Integrazione Docker     ║');
    console.log('╚══════════════════════════════════════════════════╝\n');

    // --- TEST 1: Invio Log ---
    console.log('📡 [Test 1] Invio log verso il container Docker...');
    const logResult = await diana.trackEvent('SDK_TEST_DOCKER', {
        messaggio: 'SDK locale comunica con Docker!',
        timestamp: new Date().toISOString(),
        ambiente: 'test-locale'
    });

    if (logResult.success) {
        console.log('   ✅ Log inviato con successo!');
    } else {
        console.log('   ❌ Errore:', logResult.error);
        console.log('   ⚠️  Assicurati che Docker sia avviato (porta 5002 aperta).');
        return;
    }

    // --- TEST 2: Generazione Honeytoken ---
    console.log('\n🍯 [Test 2] Generazione Honeytoken...');
    const honeyResult = await diana.generateHoneytoken('aws');
    if (honeyResult.success) {
        console.log('   ✅ Honeytoken generato:', JSON.stringify(honeyResult.token, null, 2).split('\n').join('\n   '));
    } else {
        console.log('   ❌ Errore:', honeyResult.error);
    }

    // --- TEST 3: Analisi Payload Sospetto ---
    console.log('\n🤖 [Test 3] Analisi AI payload sospetto...');
    const analyzeResult = await diana.analyzePayload("SELECT * FROM users WHERE 1=1; DROP TABLE sessions;");
    if (analyzeResult.success) {
        console.log('   ✅ Analisi completata. Risk level:', analyzeResult.analysis?.risk_level || 'N/A');
    } else {
        console.log('   ⚠️  Analisi non disponibile (può richiedere la chiave OpenAI configurata):', analyzeResult.error);
    }

    console.log('\n═══════════════════════════════════════════════════');
    console.log('✅ Test completato! Controlla ora la tua Dashboard');
    console.log('   → http://localhost:80  (Frontend)');
    console.log('   → http://localhost:5003 (Admin Panel)');
    console.log('═══════════════════════════════════════════════════\n');
}

runTests().catch(err => {
    console.error('\n❌ Errore critico:', err.message);
    console.error('⚠️  Il server Docker è acceso? Prova: docker-compose up -d\n');
});
