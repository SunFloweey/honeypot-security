const axios = require('axios');

const BASE_URL = 'http://localhost:4002';

async function testFeatures() {
    console.log('🚀 Starting Honeypot Features Test...');

    // --- Honeytoken Tests ---
    console.log('\n--- 🍯 Honeytoken Tests ---');
    const honeytokenTargets = [
        { name: '.env File', path: '/.env' },
        { name: 'config.json', path: '/config.json' },
        { name: 'Docker Compose', path: '/docker-compose.yml' },
        { name: 'K8s Secrets', path: '/k8s-secrets.yml' },
        { name: 'SSH Authorized Keys', path: '/.ssh/authorized_keys' }
    ];

    for (const target of honeytokenTargets) {
        try {
            const response = await axios.get(`${BASE_URL}${target.path}`);
            console.log(`✅ ${target.name} Access Successful (Status: ${response.status})`);
            const preview = typeof response.data === 'string' ? response.data.substring(0, 150) : JSON.stringify(response.data).substring(0, 150);
            console.log(`📄 Content Preview:\n${preview}...\n`);
        } catch (error) {
            console.error(`❌ ${target.name} Access Failed: ${error.message}`);
        }
    }

    // --- Virtual Shell Tests ---
    console.log('\n--- 💻 Virtual Shell Tests ---');
    const shellCommands = [
        { cmd: 'ls -la', desc: 'Listing directory' },
        { cmd: 'whoami', desc: 'Current user' },
        { cmd: 'cat /etc/passwd', desc: 'Read password file' },
        { cmd: 'uname -a', desc: 'System info' }
    ];

    for (const test of shellCommands) {
        try {
            console.log(`🚀 Executing shell command: "${test.cmd}" (${test.desc})`);
            const response = await axios.get(`${BASE_URL}/shell.php`, {
                params: { cmd: test.cmd }
            });
            console.log(`✅ Output:\n${response.data}\n`);
        } catch (error) {
            console.error(`❌ Shell command failed: ${error.message}`);
        }
    }

    console.log('🏁 Tests Finished. Check backend logs for activity alerts!');
}

testFeatures();
