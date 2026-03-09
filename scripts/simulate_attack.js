const axios = require('axios');

const BASE_URL = 'http://localhost:4002';

async function simulate() {
    console.log('🔥 Starting Honeypot Attack Simulation...');

    const targets = [
        { name: 'Exposed Env File', path: '/.env', method: 'GET' },
        { name: 'WordPress Config', path: '/wp-config.php', method: 'GET' },
        { name: 'Webshell Command', path: '/shell.php?cmd=whoami', method: 'GET' },
        { name: 'SQL Injection Attempt', path: "/api/users?id=1' OR '1'='1", method: 'GET' },
        { name: 'Command Injection Attempt', path: '/page?id=1;cat /etc/passwd', method: 'GET' },
        { name: 'Git Config Leak', path: '/.git/config', method: 'GET' },
        { name: 'Admin Login Brute Force', path: '/login', method: 'POST', data: { username: 'admin', password: 'password123' } }
    ];

    for (const target of targets) {
        try {
            console.log(`
-----------------------------------------`);
            console.log(`🚀 Target: ${target.name} (${target.method} ${target.path})`);
            
            let response;
            if (target.method === 'GET') {
                response = await axios.get(`${BASE_URL}${target.path}`, { timeout: 5000 });
            } else {
                response = await axios.post(`${BASE_URL}${target.path}`, target.data, { timeout: 5000 });
            }

            console.log(`✅ Status: ${response.status}`);
            const preview = typeof response.data === 'string' ? response.data.substring(0, 100) : JSON.stringify(response.data).substring(0, 100);
            console.log(`📄 Data Preview: ${preview}...`);
        } catch (error) {
            if (error.response) {
                console.log(`⚠️ Status: ${error.response.status}`);
                const preview = typeof error.response.data === 'string' ? error.response.data.substring(0, 100) : JSON.stringify(error.response.data).substring(0, 100);
                console.log(`📄 Error Data: ${preview}...`);
            } else {
                console.log(`❌ Error: ${error.message}`);
                if (error.message.includes('ECONNREFUSED')) {
                    console.log('   (Is the backend running on port 4002?)');
                }
            }
        }
    }

    console.log('
-----------------------------------------');
    console.log('🏁 Simulation Finished. Now check the logs in the database or dashboard!');
}

simulate();
