/**
 * Test script for new DIANA SDK features:
 * 1. Programmatic Logging (log, info, warn, error)
 * 2. System Daemon (command interception)
 */

const { createClient, createDaemon } = require('./sdk/index');
const path = require('path');
require('dotenv').config();

// Configuration (use your actual API key if testing with a real server)
const config = {
    apiKey: process.env.DIANA_API_KEY || 'hp_sk_test_12345',
    baseUrl: process.env.DIANA_BASE_URL || 'http://localhost:5002',
    appName: 'TestApp-NewFeatures'
};

async function testProgrammaticLogging() {
    console.log('--- Testing Programmatic Logging ---');
    const diana = createClient(config);

    console.log('Sending info log...');
    await diana.info('User "admin" logged in from dashboard');

    console.log('Sending warning log...');
    await diana.warn('Failed login attempt for user "root"', { attempts: 5, ip: '192.168.1.50' });

    console.log('Sending error log...');
    await diana.error('Critical database connection failure', { error: 'ECONNREFUSED', stack: '...' });

    console.log('✅ Logging test complete.\n');
}

async function testDaemon() {
    console.log('--- Testing System Daemon ---');
    const daemon = createDaemon(config);

    console.log('Starting daemon (simulated for 10 seconds)...');
    await daemon.start();

    console.log('👉 Open a PowerShell/Terminal and type some commands to see them intercepted.');
    console.log('👉 Commands will be sent to Diana Virtual Terminal for analysis.');

    // Wait for 10 seconds to allow manual testing if the user wants
    await new Promise(resolve => setTimeout(resolve, 10000));

    daemon.stop();
    console.log('✅ Daemon test complete.\n');
}

async function runTests() {
    try {
        await testProgrammaticLogging();
        // await testDaemon(); // Uncomment to test daemon manually
    } catch (err) {
        console.error('❌ Test failed:', err.message);
    }
}

runTests();
