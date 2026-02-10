const { execSync } = require('child_process');

/**
 * Utility per liberare la porta su Windows prima di avviare il server.
 * Risolve l'errore EADDRINUSE (Porta già in uso).
 */
function killPort(port) {
    try {
        console.log(`🔍 Controllo processi sulla porta ${port}...`);
        const stdout = execSync(`netstat -ano | findstr :${port}`).toString();
        const lines = stdout.trim().split('\n');

        const pids = new Set();
        lines.forEach(line => {
            const parts = line.trim().split(/\s+/);
            const pid = parts[parts.length - 1];
            if (pid && pid !== '0' && pid !== process.pid.toString()) {
                pids.add(pid);
            }
        });

        if (pids.size > 0) {
            console.log(`⚠️ Trovati ${pids.size} processi attivi. Terminazione in corso...`);
            pids.forEach(pid => {
                try {
                    execSync(`taskkill /PID ${pid} /F`);
                    console.log(`✅ Processo ${pid} terminato.`);
                } catch (e) {
                    // Già terminato o permessi insufficienti
                }
            });
        } else {
            console.log(`✅ Porta ${port} già libera.`);
        }
    } catch (err) {
        // Nessun processo trovato sulla porta
        console.log(`✅ Porta ${port} libera.`);
    }
}

const targetPort = process.argv[2] || process.env.HONEYPOT_PORT || 4002;
killPort(targetPort);
