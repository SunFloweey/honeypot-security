/**
 * Test Script for DIANA Terminal
 * Tests real terminal execution via API
 */
const axios = require('axios');

async function testTerminal() {
    try {
        // Step 1: Test Terminal Commands directly (no auth needed for admin)
        const testCommands = [
            'whoami',
            'pwd',
            'ls -la',
            'cat .env',
            'cat .ssh/authorized_keys',
            'uname -a',
            'ps aux',
            'netstat -tlnp'
        ];
        
        const headers = {
            'Content-Type': 'application/json'
        };
        
        for (const command of testCommands) {
            console.log(`\n🔧 Testing: ${command}`);
            
            const response = await axios.post('http://localhost:4003/api/terminal/execute', {
                command,
                sessionId: 'test-session-' + Date.now()
            }, { headers });
            
            console.log('📤 Output:');
            console.log(response.data.output || '(no output)');
            console.log('⏱️  Execution time:', response.data.timestamp);
        }
        
        // Step 2: Get Container Status
        console.log('\n📊 Container Status:');
        const statusResponse = await axios.get('http://localhost:4003/api/terminal/status', { headers });
        console.log(JSON.stringify(statusResponse.data, null, 2));
        
    } catch (error) {
        console.error('❌ Test failed:', error.response?.data || error.message);
    }
}

testTerminal();
