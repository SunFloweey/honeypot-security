const fs = require('fs');
const path = require('path');
const os = require('os');
const DianaClient = require('./DianaClient');

/**
 * DianaDaemon - System-level monitor for command interception
 */
class DianaDaemon {
    constructor(config = {}) {
        this.client = new DianaClient(config);
        this.isMonitoring = false;
        this.historyPath = this._getHistoryPath();
        this.lastSize = 0;
        this.appName = config.appName || 'SystemDaemon';
    }

    /**
     * Determine the shell history path based on OS
     * @private
     */
    _getHistoryPath() {
        if (os.platform() === 'win32') {
            // PowerShell PSReadLine history path
            return path.join(os.homedir(), 'AppData', 'Roaming', 'Microsoft', 'Windows', 'PowerShell', 'PSReadLine', 'ConsoleHost_history.txt');
        } else {
            // Bash/Zsh history path for Linux/macOS
            return path.join(os.homedir(), '.bash_history');
        }
    }

    /**
     * Start monitoring the system commands
     */
    async start() {
        if (this.isMonitoring) return;
        
        console.log(`🛡️  [DIANA DAEMON] Starting system monitor...`);
        console.log(`📂 Monitoring: ${this.historyPath}`);

        if (!fs.existsSync(this.historyPath)) {
            // Create the path if it doesn't exist to start watching
            try {
                const dir = path.dirname(this.historyPath);
                if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
                fs.writeFileSync(this.historyPath, '');
            } catch (e) {
                console.error(`❌ Could not access history path: ${e.message}`);
                return;
            }
        }

        this.lastSize = fs.statSync(this.historyPath).size;
        this.isMonitoring = true;

        // Watch the file for changes
        fs.watch(this.historyPath, (event) => {
            if (event === 'change') {
                this._processNewCommands();
            }
        });

        // Periodic check as fallback for some OS file systems
        this.interval = setInterval(() => this._processNewCommands(), 5000);

        await this.client.trackEvent('DAEMON_STARTED', { 
            platform: os.platform(),
            hostname: os.hostname(),
            historyPath: this.historyPath
        });
    }

    /**
     * Stop the daemon
     */
    stop() {
        this.isMonitoring = false;
        if (this.interval) clearInterval(this.interval);
        console.log(`🛑 [DIANA DAEMON] Stopped.`);
    }

    /**
     * Read and process new lines added to the history file
     * @private
     */
    async _processNewCommands() {
        try {
            const stats = fs.statSync(this.historyPath);
            if (stats.size <= this.lastSize) {
                if (stats.size < this.lastSize) this.lastSize = stats.size; // File was truncated/cleared
                return;
            }

            const stream = fs.createReadStream(this.historyPath, {
                start: this.lastSize,
                end: stats.size
            });

            let content = '';
            for await (const chunk of stream) {
                content += chunk;
            }

            this.lastSize = stats.size;

            const commands = content.split('\n').map(c => c.trim()).filter(c => c.length > 0);
            
            for (const cmd of commands) {
                console.log(`🔍 [DIANA] Intercepted command: ${cmd}`);
                
                // Forward the command to the virtual terminal for analysis
                // We use a specific session key for the system daemon
                const sessionKey = `daemon_${os.hostname()}`;
                await this.client.executeTerminal(cmd, sessionKey, 'system-shell', '127.0.0.1');
            }
        } catch (err) {
            console.error(`❌ [DIANA DAEMON] Error processing commands: ${err.message}`);
        }
    }
}

module.exports = DianaDaemon;
