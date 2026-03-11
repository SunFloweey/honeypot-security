#!/bin/bash
# 🎯 Quick Hacker Test for DIANA Honeypot

echo "🎯 DIANA HACKER SIMULATION TEST"
echo "================================"

# Test 1: Basic Recon
echo -e "\n🔍 TEST 1: Basic Reconnaissance"
docker exec diana_sandbox bash -c "whoami && id && pwd && hostname" 2>/dev/null

# Test 2: System Information
echo -e "\n📊 TEST 2: System Information"
docker exec diana_sandbox bash -c "uname -a && cat /proc/version | head -1" 2>/dev/null

# Test 3: File System
echo -e "\n📁 TEST 3: File System Access"
docker exec diana_sandbox bash -c "ls -la /home/sysadmin/ && ls -la /tmp/" 2>/dev/null

# Test 4: Container Detection
echo -e "\n🚪 TEST 4: Container Detection"
docker exec diana_sandbox bash -c "cat /proc/1/cgroup | head -3" 2>/dev/null

# Test 5: Privilege Escalation (SHOULD FAIL)
echo -e "\n⬆️ TEST 5: Privilege Escalation (should be blocked)"
docker exec diana_sandbox bash -c "sudo su 2>&1 || echo '🚫 BLOCKED: sudo not available'" 2>/dev/null
docker exec diana_sandbox bash -c "sudo -l 2>&1 || echo '🚫 BLOCKED: sudo not available'" 2>/dev/null

# Test 6: Container Escape (SHOULD FAIL)
echo -e "\n🐳 TEST 6: Container Escape (should be blocked)"
docker exec diana_sandbox bash -c "docker ps 2>&1 || echo '🚫 BLOCKED: docker not available'" 2>/dev/null
docker exec diana_sandbox bash -c "ls -la /var/run/docker.sock 2>&1 || echo '🚫 BLOCKED: docker socket not accessible'" 2>/dev/null

# Test 7: Network Access (SHOULD FAIL)
echo -e "\n🌐 TEST 7: Network Access (should be blocked)"
docker exec diana_sandbox bash -c "ping -c 1 8.8.8.8 2>&1 | head -1" 2>/dev/null
docker exec diana_sandbox bash -c "curl -I http://google.com 2>&1 | head -1" 2>/dev/null

# Test 8: Credential Hunting
echo -e "\n🍯 TEST 8: Credential Hunting (honeytokens)"
docker exec diana_sandbox bash -c "find /home/sysadmin -name '*.env' 2>/dev/null || echo 'No .env files found'" 2>/dev/null
docker exec diana_sandbox bash -c "find /home/sysadmin -name '*key*' 2>/dev/null || echo 'No key files found'" 2>/dev/null

# Test 9: Process Information
echo -e "\n⚙️ TEST 9: Process Information"
docker exec diana_sandbox bash -c "ps aux | head -5" 2>/dev/null

# Test 10: Network Information
echo -e "\n🔌 TEST 10: Network Information"
docker exec diana_sandbox bash -c "ip addr show | head -10" 2>/dev/null
docker exec diana_sandbox bash -c "netstat -tlnp 2>/dev/null || echo 'netstat not available'" 2>/dev/null

echo -e "\n✅ HACKER SIMULATION COMPLETE!"
echo "📊 Check DIANA logs for detailed analysis and risk scores"
