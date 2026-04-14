/**
 * Test Script - Flusso SaaS Completo
 * 
 * Testa: Registrazione → Login → Creazione Chiave API → Invio Log con nuova chiave
 * 
 * Uso: node scripts/saas_test.js
 */
require('dotenv').config();
const axios = require('axios');

const BASE_URL = `http://localhost:${process.env.HONEYPOT_PORT || 4002}`;
const API = `${BASE_URL}/api/v1/saas`;

async function runSaaSTest() {
    console.log('');
    console.log('╔════════════════════════════════════════════╗');
    console.log('║   🧪  TEST FLUSSO SaaS MULTI-TENANT       ║');
    console.log('╚════════════════════════════════════════════╝');
    console.log('');

    let jwtToken = null;
    let apiKey = null;

    // ==========================================
    // STEP 1: Registrazione
    // ==========================================
    console.log('📝 STEP 1: Registrazione nuovo utente...');
    try {
        const registerRes = await axios.post(`${API}/register`, {
            email: 'mario.rossi@test.it',
            password: 'Password123!',
            name: 'Mario Rossi'
        });

        console.log('   ✅ Registrazione riuscita!');
        console.log(`   👤 Utente: ${registerRes.data.user.name} (${registerRes.data.user.email})`);
        console.log(`   🔑 Prima API Key: ${registerRes.data.apiKey.key}`);
        console.log(`   📛 Progetto: ${registerRes.data.apiKey.name}`);

        jwtToken = registerRes.data.token;
        apiKey = registerRes.data.apiKey.key;
    } catch (error) {
        if (error.response?.status === 409) {
            console.log('   ⚠️  Utente già registrato, passo al login...');
        } else {
            console.error('   ❌ Errore:', error.response?.data || error.message);
            return;
        }
    }

    // ==========================================
    // STEP 2: Login (se la registrazione ha fallito perché esiste già)
    // ==========================================
    if (!jwtToken) {
        console.log('\n🔐 STEP 2: Login...');
        try {
            const loginRes = await axios.post(`${API}/login`, {
                email: 'mario.rossi@test.it',
                password: 'Password123!'
            });

            console.log('   ✅ Login riuscito!');
            console.log(`   👤 Utente: ${loginRes.data.user.name}`);
            jwtToken = loginRes.data.token;
        } catch (error) {
            console.error('   ❌ Login fallito:', error.response?.data || error.message);
            return;
        }
    }

    // ==========================================
    // STEP 3: Crea una nuova chiave API per "streetcats"
    // ==========================================
    console.log('\n🔧 STEP 3: Creazione chiave API per progetto "streetcats"...');
    try {
        const keyRes = await axios.post(`${API}/keys`,
            { name: 'streetcats' },
            { headers: { Authorization: `Bearer ${jwtToken}` } }
        );

        console.log('   ✅ Chiave creata!');
        console.log(`   🔑 Key: ${keyRes.data.apiKey.key}`);
        console.log(`   📛 Progetto: ${keyRes.data.apiKey.name}`);
        apiKey = keyRes.data.apiKey.key; // Uso questa per i test
    } catch (error) {
        console.error('   ❌ Errore:', error.response?.data || error.message);
    }

    // ==========================================
    // STEP 4: Lista tutte le chiavi dell'utente
    // ==========================================
    console.log('\n📋 STEP 4: Lista chiavi API...');
    try {
        const keysRes = await axios.get(`${API}/keys`, {
            headers: { Authorization: `Bearer ${jwtToken}` }
        });

        console.log(`   ✅ Trovate ${keysRes.data.keys.length} chiavi:`);
        keysRes.data.keys.forEach((k, i) => {
            console.log(`      ${i + 1}. "${k.name}" → ${k.key.substring(0, 20)}... (Attiva: ${k.isActive})`);
        });
    } catch (error) {
        console.error('   ❌ Errore:', error.response?.data || error.message);
    }

    // ==========================================
    // STEP 5: Invia un log SDK con la nuova chiave API
    // ==========================================
    if (apiKey) {
        console.log('\n📡 STEP 5: Invio log SDK con la nuova chiave API...');
        try {
            const logRes = await axios.post(`${BASE_URL}/api/v1/sdk/logs`, {
                event: 'suspicious_login_attempt',
                metadata: {
                    username: 'admin',
                    source: 'login_form',
                    attempts: 5
                }
            }, {
                headers: {
                    'x-api-key': apiKey,
                    'X-App-Name': 'streetcats'
                }
            });

            console.log('   ✅ Log inviato con successo!');
            console.log(`   📝 Risposta: ${JSON.stringify(logRes.data)}`);
        } catch (error) {
            console.error('   ❌ Errore:', error.response?.data || error.message);
        }
    }

    // ==========================================
    // STEP 6: Verifica che la vecchia ADMIN_TOKEN funzioni ancora (retrocompatibilità)
    // ==========================================
    console.log('\n🔄 STEP 6: Test retrocompatibilità (ADMIN_TOKEN)...');
    try {
        const legacyRes = await axios.post(`${BASE_URL}/api/v1/sdk/logs`, {
            event: 'legacy_test',
            metadata: { source: 'admin_token_fallback' }
        }, {
            headers: {
                'x-api-key': process.env.ADMIN_TOKEN,
                'X-App-Name': 'legacy-admin'
            }
        });

        console.log('   ✅ Retrocompatibilità OK! ADMIN_TOKEN funziona ancora.');
    } catch (error) {
        console.error('   ❌ Retrocompatibilità fallita:', error.response?.data || error.message);
    }

    console.log('');
    console.log('╔════════════════════════════════════════════╗');
    console.log('║   ✅  TEST SaaS COMPLETATO!               ║');
    console.log('╚════════════════════════════════════════════╝');
    console.log('');
    console.log('👉 Prossimi passi:');
    console.log('   1. Vai nella Dashboard Admin (http://localhost:5173)');
    console.log('   2. Dovresti vedere i log da "streetcats" e "legacy-admin"');
    console.log('   3. In futuro: filtra i log per progetto nella dashboard');
    console.log('');
}

runSaaSTest().catch(console.error);
