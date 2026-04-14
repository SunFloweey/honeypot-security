/**
 * Simulazione Attacco Hacker - Test DIANA
 * Esegue comandi come farebbe un vero attaccante
 */
const axios = require('axios');

async function hackerAttack() {
    console.log('🎯 INIZIO SIMULAZIONE ATTACCO HACKER\n');
    
    // Fase 1: Recon
    console.log('🔍 FASE 1: RECONNAISSANCE');
    await testCommand('whoami', 'Basic user check');
    await testCommand('uname -a', 'Kernel version enumeration');
    await testCommand('hostname', 'Hostname discovery');
    await testCommand('ip addr show', 'Network interfaces');
    
    // Fase 2: File System Exploration
    console.log('\n📁 FASE 2: FILE SYSTEM EXPLORATION');
    await testCommand('pwd', 'Current directory');
    await testCommand('ls -la', 'Directory listing');
    await testCommand('cat .env', 'Credential hunting');
    await testCommand('cat .ssh/authorized_keys', 'SSH key discovery');
    await testCommand('find / -name "*.conf" 2>/dev/null | head -10', 'Config file search');
    
    // Fase 3: Privilege Escalation
    console.log('\n⬆️ FASE 3: PRIVILEGE ESCALATION');
    await testCommand('sudo su', 'Direct sudo attempt');
    await testCommand('sudo -i', 'Alternative sudo');
    await testCommand('su -', 'Switch user attempt');
    
    // Fase 4: Container Escape
    console.log('\n🚪 FASE 4: CONTAINER ESCAPE');
    await testCommand('cat /proc/1/cgroup', 'Container detection');
    await testCommand('mount', 'Mount points discovery');
    await testCommand('docker ps', 'Docker access attempt');
    await testCommand('ls -la /var/run/docker.sock', 'Docker socket access');
    
    // Fase 5: Network Pivoting
    console.log('\n🌐 FASE 5: NETWORK PIVOTING');
    await testCommand('ping -c 1 8.8.8.8', 'Internet connectivity');
    await testCommand('nslookup google.com', 'DNS resolution');
    await testCommand('curl http://example.com', 'HTTP outbound');
    await testCommand('netstat -tlnp', 'Network connections');
    
    // Fase 6: Persistence
    console.log('\n📝 FASE 6: PERSISTENCE');
    await testCommand('echo "test" >> ~/.bashrc', 'Backdoor attempt');
    await testCommand('crontab -l', 'Cron jobs check');
    await testCommand('ps aux | grep -v grep', 'Process enumeration');
    
    // Fase 7: Advanced Commands
    console.log('\n🧠 FASE 7: ADVANCED TECHNIQUES');
    await testCommand('cat /proc/meminfo', 'Memory information');
    await testCommand('ls -la /proc/*/cmdline | head -5', 'Process inspection');
    await testCommand('cat /etc/passwd', 'User enumeration');
    
    console.log('\n✅ SIMULAZIONE COMPLETATA');
    console.log('📊 Controlla i log DIANA per vedere come ha risposto!');
}

async function testCommand(command, description) {
    try {
        console.log(`\n🔧 ${description}`);
        console.log(`💻 Command: ${command}`);
        
        const response = await axios.post('http://localhost:4003/api/terminal/execute', {
            command,
            sessionId: 'hacker-attack-' + Date.now()
        }, {
            headers: { 'Content-Type': 'application/json' },
            timeout: 10000
        });
        
        const output = response.data.output || '(no output)';
        console.log(`📤 Output: ${output.substring(0, 200)}${output.length > 200 ? '...' : ''}`);
        
        // Analisi della risposta
        analyzeResponse(command, output);
        
    } catch (error) {
        console.log(`❌ Error: ${error.response?.data?.error || error.message}`);
    }
}

function analyzeResponse(command, output) {
    // Container detection
    if (command.includes('/proc/1/cgroup') && !output.includes('docker')) {
        console.log('🛡️ DIANA nasconde con successo il container!');
    }
    
    // Docker access blocked
    if (command.includes('docker') && output.includes('command not found')) {
        console.log('🚫 DIANA blocca accesso Docker!');
    }
    
    // Sudo blocked
    if (command.includes('sudo') && output.includes('permission denied')) {
        console.log('🔒 DIANA previene privilege escalation!');
    }
    
    // Network isolation
    if ((command.includes('ping') || command.includes('curl')) && output.includes('unreachable')) {
        console.log('🌐 DIANA isola la rete!');
    }
    
    // Honeytokens found
    if (command.includes('.env') && output.includes('password')) {
        console.log('🍯 DIANA ha generato honeytokens!');
    }
}

hackerAttack();
