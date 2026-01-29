# 🔒 Security Notice - Honeypot Project

## ⚠️ About "Secrets" in This Repository

This repository contains **INTENTIONALLY FAKE** credentials, API keys, and secrets as part of a cybersecurity honeypot system. These are **NOT real secrets** and pose no security risk.

### Files Containing Fake Credentials (Honeypot Baits):

- `backend/src/data/apiKeys.json` - Fake Stripe API keys for baiting attackers
- `backend/src/honeypot/baits/exposed/env.txt` - Fake environment variables
- `backend/src/honeypot/baits/exposed/.env` - Fake configuration file
- Other files in `backend/src/honeypot/baits/` directory

### Purpose

These fake credentials are designed to:
1. **Attract attackers** by appearing as accidentally exposed secrets
2. **Log attack attempts** when these credentials are accessed or used
3. **Study attacker behavior** in a controlled environment

### GitHub Secret Scanning

If GitHub's push protection flags these files:
- These are **false positives** by design
- You can safely allow these "secrets" via the GitHub UI
- They are part of the honeypot's deception mechanism

### Real Secrets

**Actual sensitive credentials** (like database passwords, admin tokens) are:
- Stored in `.env` files that are **gitignored**
- Never committed to this repository
- Managed securely via environment variables

---

**This is a security research project. All "leaked" credentials are intentional honeypot baits.**
