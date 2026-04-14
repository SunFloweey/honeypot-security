const HoneypotClient = require('../sdk/node/HoneypotClient');
require('dotenv').config({ path: './backend/.env' });

async function runTest() {
    const client = new HoneypotClient({
        apiKey: process.env.ADMIN_TOKEN, // In production, this would be a real API key
        baseUrl: 'http://localhost:4002',
        appName: 'streetcats'
    });

    console.log('🚀 Starting SDK Verification Test...');

    // 1. Test Honeytoken Generation
    console.log('\n--- 1. Testing Honeytoken Generation ---');
    const tokenResult = await client.generateToken('aws');
    if (tokenResult.success) {
        console.log('✅ AWS Token generated:', tokenResult.token);
    } else {
        console.log('❌ Auth failed or error:', tokenResult.error);
    }

    // 2. Test Custom Event Logging
    console.log('\n--- 2. Testing Custom Event Logging ---');
    const logResult = await client.trackEvent('sdk_test_event', {
        severity: 'high',
        reason: 'Simulated brute force on external auth module',
        target_username: 'victim_user'
    }, '1.2.3.4');

    if (logResult.success) {
        console.log('✅ Event logged successfully');
    } else {
        console.log('❌ Logging failed:', logResult.error);
    }

    // 3. Test AI Analysis
    console.log('\n--- 3. Testing AI Payload Analysis ---');
    const suspiciousPayload = 'eval(base64_decode("c2hlbGxfZXhlYygncm0gLXJmIC8nKSA="))';
    console.log('Payload:', suspiciousPayload);

    const analysisResult = await client.analyzePayload(suspiciousPayload);
    if (analysisResult.success) {
        console.log('✅ AI Analysis received:');
        console.log('   - Technique:', analysisResult.analysis.technique);
        console.log('   - Risk Level:', analysisResult.analysis.risk_level);
        console.log('   - Explanation:', analysisResult.analysis.explanation);
    } else {
        console.log('❌ Analysis failed:', analysisResult.error);
    }

    console.log('\n🏁 Verification Complete. Check your Admin Dashboard for the results!');
}

runTest();
