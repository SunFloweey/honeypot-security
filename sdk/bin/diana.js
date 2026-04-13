#!/usr/bin/env node

/**
 * DIANA CLI - Command Line Interface for DIANA Security SDK
 * 
 * Commands:
 *   diana init          → Interactive setup: configure server URL + API key
 *   diana login         → Authenticate with email/password, get JWT token
 *   diana verify        → Check connectivity with the DIANA server
 *   diana status        → Show current configuration
 *   diana generate-key  → Generate a new API key from the dashboard
 */

const { Command } = require('commander');
const inquirer = require('inquirer');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const { createDaemon } = require('../index');

const program = new Command();

program
    .name('diana')
    .description('DIANA Security SDK - CLI tool for setup and management')
    .version('1.0.0');

// ================================================================
//  INIT — Quick setup (no login required, just API key + URL)
// ================================================================
program
    .command('init')
    .description('Initialize DIANA SDK in your project (configure server URL + API key)')
    .action(async () => {
        console.log('');
        console.log(chalk.cyan('╔══════════════════════════════════════════════════════════╗'));
        console.log(chalk.cyan('║') + chalk.bold('  🛡️  DIANA Security SDK — Setup                       ') + chalk.cyan('║'));
        console.log(chalk.cyan('╚══════════════════════════════════════════════════════════╝'));
        console.log('');

        const answers = await inquirer.prompt([
            {
                type: 'input',
                name: 'apiKey',
                message: 'Your API Key (from the DIANA Dashboard):',
                validate: (val) => val.length > 0 ? true : 'API key is required'
            },
            {
                type: 'input',
                name: 'appName',
                message: 'Application name:',
                default: path.basename(process.cwd())
            },
            {
                type: 'list',
                name: 'securityLevel',
                message: 'Security level:',
                choices: [
                    { name: '🟢 Low — Monitoring only, no auto-protection', value: 'low' },
                    { name: '🟡 Medium — Auto-protection on critical threats (recommended)', value: 'medium' },
                    { name: '🔴 High — Maximum protection, isolated terminal, aggressive response', value: 'high' }
                ],
                default: 'medium'
            },
            {
                type: 'input',
                name: 'baseUrl',
                message: 'DIANA Server URL:',
                default: process.env.DIANA_SERVER_URL || 'http://localhost:5002',
                validate: (val) => val.startsWith('http') ? true : 'URL must start with http/https'
            }
        ]);

        // Create .env file with DIANA config
        const envPath = path.resolve(process.cwd(), '.env');
        let envContent = '';

        if (fs.existsSync(envPath)) {
            envContent = fs.readFileSync(envPath, 'utf8');
            console.log(chalk.yellow('\n  ⚠️  .env file already exists. DIANA variables will be added/updated.\n'));
        }

        const updates = {
            'DIANA_API_KEY': answers.apiKey,
            'DIANA_BASE_URL': answers.baseUrl.replace(/\/$/, ''),
            'DIANA_APP_NAME': answers.appName,
            'DIANA_SECURITY_LEVEL': answers.securityLevel,
            'DIANA_AUTO_PROTECT': answers.securityLevel !== 'low' ? 'true' : 'false'
        };

        // Add a header comment if it's a new section
        if (!envContent.includes('DIANA_API_KEY')) {
            envContent += '\n# ═══════════════════════════════════════\n';
            envContent += '# DIANA Security SDK Configuration\n';
            envContent += '# ═══════════════════════════════════════\n';
        }

        Object.entries(updates).forEach(([key, value]) => {
            const regex = new RegExp(`^${key}=.*`, 'm');
            if (regex.test(envContent)) {
                envContent = envContent.replace(regex, `${key}=${value}`);
            } else {
                envContent += `${key}=${value}\n`;
            }
        });

        fs.writeFileSync(envPath, envContent.trim() + '\n');

        // Update .gitignore
        const gitignorePath = path.resolve(process.cwd(), '.gitignore');
        if (fs.existsSync(gitignorePath)) {
            const gitignore = fs.readFileSync(gitignorePath, 'utf8');
            if (!gitignore.includes('.env')) {
                fs.appendFileSync(gitignorePath, '\n# DIANA SDK\n.env\n');
                console.log(chalk.green('  ✅ .gitignore updated'));
            }
        }

        console.log(chalk.green(`  ✅ Configuration saved to ${envPath}`));
        console.log('');

        // Verify connection
        console.log(chalk.blue('  📡 Verifying connection...'));
        try {
            const isJWT = answers.apiKey.split('.').length === 3 && !answers.apiKey.startsWith('hp_sk_');
            const headers = isJWT
                ? { 'Authorization': `Bearer ${answers.apiKey}`, 'X-App-Name': answers.appName }
                : { 'x-api-key': answers.apiKey, 'X-App-Name': answers.appName };

            const response = await axios.post(`${answers.baseUrl}/api/v1/sdk/logs`, {
                event: 'SDK_INIT',
                metadata: { cli: true, framework: 'generic', securityLevel: answers.securityLevel }
            }, { headers, timeout: 10000 });

            if (response.data.success) {
                console.log(chalk.green('  ✅ Connection successful! Server is receiving data.'));
            } else {
                console.log(chalk.yellow('  ⚠️  Server responded but with an unexpected result.'));
            }
        } catch (error) {
            console.log(chalk.yellow(`  ⚠️  Could not reach server: ${error.message}`));
            console.log(chalk.dim(`     Make sure the DIANA server is running at ${answers.baseUrl}`));
        }

        // Print next steps
        console.log('');
        console.log(chalk.cyan('  ────────────────────────────────────'));
        console.log(chalk.bold('  📋 Next Steps:'));
        console.log('');
        console.log('  ' + chalk.bold('Express:'));
        console.log(chalk.dim("    const diana = require('@diana-security/sdk').createClient();"));
        console.log(chalk.dim('    app.use(diana.monitor());'));
        console.log('');
        console.log('  ' + chalk.bold('Manual tracking:'));
        console.log(chalk.dim("    const diana = require('@diana-security/sdk').createClient();"));
        console.log(chalk.dim("    await diana.trackEvent('LOGIN_ATTEMPT', { user: 'admin' });"));
        console.log('');
    });

// ================================================================
//  LOGIN — Authenticate with email/password to get JWT
// ================================================================
program
    .command('login')
    .description('Authenticate with your DIANA account (email/password)')
    .action(async () => {
        const answers = await inquirer.prompt([
            {
                type: 'input',
                name: 'serverUrl',
                message: 'DIANA Server URL:',
                default: loadEnvValue('DIANA_BASE_URL') || process.env.DIANA_SERVER_URL || 'http://localhost:5002'
            },
            {
                type: 'input',
                name: 'email',
                message: 'Email:'
            },
            {
                type: 'password',
                name: 'password',
                message: 'Password:'
            }
        ]);

        try {
            console.log(chalk.blue('\n  Authenticating...'));
            const response = await axios.post(`${answers.serverUrl}/api/v1/saas/login`, {
                email: answers.email,
                password: answers.password
            }, { timeout: 10000 });

            if (response.data.success) {
                const token = response.data.token;

                // Save token to home directory config
                saveGlobalConfig({
                    serverUrl: answers.serverUrl,
                    token,
                    email: answers.email
                });

                console.log(chalk.green('  ✅ Login successful!'));
                console.log(chalk.dim(`  Token saved to ${getGlobalConfigPath()}`));
                console.log('');
                console.log(chalk.cyan('  You can now use `diana keys` to list your API keys.'));
                console.log(chalk.cyan('  Or use `diana init` with the JWT token as API key.'));
            }
        } catch (error) {
            console.error(chalk.red('  ❌ Login failed:'), error.response?.data?.error || error.message);
        }
    });

// ================================================================
//  KEYS — List API keys
// ================================================================
program
    .command('keys')
    .description('List your API keys from the DIANA server')
    .action(async () => {
        const config = loadGlobalConfig();
        if (!config.token || !config.serverUrl) {
            console.error(chalk.yellow('  ⚠️  Not authenticated. Please run "diana login" first.'));
            return;
        }

        try {
            console.log(chalk.blue('\n  Fetching API keys...'));
            const response = await axios.get(`${config.serverUrl}/api/v1/saas/keys`, {
                headers: { 'Authorization': `Bearer ${config.token}` },
                timeout: 10000
            });

            if (response.data.success && response.data.keys.length > 0) {
                console.log('');
                console.log(chalk.bold('  Your API Keys:'));
                console.log(chalk.dim('  ─────────────────────────────────────────────'));
                response.data.keys.forEach((key, i) => {
                    const status = key.isActive ? chalk.green('●') : chalk.red('●');
                    console.log(`  ${status} ${chalk.bold(key.name)}`);
                    console.log(chalk.dim(`    Key: ${key.key}`));
                    console.log(chalk.dim(`    Last used: ${key.lastUsedAt || 'Never'}`));
                    console.log('');
                });
                console.log(chalk.cyan('  Use `diana init` and paste one of these keys to configure your project.'));
            } else {
                console.log(chalk.yellow('  No API keys found. Create one in the DIANA Dashboard.'));
            }
        } catch (error) {
            console.error(chalk.red('  ❌ Error:'), error.response?.data?.error || error.message);
        }
    });

// ================================================================
//  VERIFY — Check connection to server
// ================================================================
program
    .command('verify')
    .description('Verify connectivity with the DIANA server')
    .action(async () => {
        const apiKey = loadEnvValue('DIANA_API_KEY');
        const baseUrl = loadEnvValue('DIANA_BASE_URL');
        const appName = loadEnvValue('DIANA_APP_NAME') || 'CLI-Verify';

        if (!apiKey || !baseUrl) {
            console.error(chalk.yellow('  ⚠️  Not configured. Run "diana init" first or set DIANA_API_KEY and DIANA_BASE_URL in .env'));
            return;
        }

        console.log(chalk.blue('\n  📡 Verifying connection...'));
        console.log(chalk.dim(`  Server: ${baseUrl}`));
        console.log(chalk.dim(`  App: ${appName}`));
        console.log('');

        try {
            const isJWT = apiKey.split('.').length === 3 && !apiKey.startsWith('hp_sk_');
            const headers = isJWT
                ? { 'Authorization': `Bearer ${apiKey}`, 'X-App-Name': appName }
                : { 'x-api-key': apiKey, 'X-App-Name': appName };

            const response = await axios.post(`${baseUrl}/api/v1/sdk/logs`, {
                event: 'SDK_VERIFY',
                metadata: { cli: true, timestamp: new Date().toISOString() }
            }, { headers, timeout: 10000 });

            if (response.data.success) {
                console.log(chalk.green('  ✅ Connection OK — Server is receiving data!'));
            } else {
                console.log(chalk.yellow('  ⚠️  Server responded but with unexpected data.'));
            }
        } catch (error) {
            if (error.response?.status === 401) {
                console.log(chalk.red('  ❌ Authentication failed — API key is invalid or revoked.'));
            } else {
                console.log(chalk.red(`  ❌ Connection failed: ${error.message}`));
            }
        }
    });

// ================================================================
//  STATUS — Show current configuration
// ================================================================
program
    .command('status')
    .description('Show current DIANA SDK configuration')
    .action(() => {
        console.log('');
        console.log(chalk.cyan('  🛡️  DIANA SDK — Current Configuration'));
        console.log(chalk.dim('  ─────────────────────────────────────────────'));

        const apiKey = loadEnvValue('DIANA_API_KEY');
        const baseUrl = loadEnvValue('DIANA_BASE_URL');
        const appName = loadEnvValue('DIANA_APP_NAME');
        const secLevel = loadEnvValue('DIANA_SECURITY_LEVEL');

        console.log(`  API Key:    ${apiKey ? chalk.green(apiKey.substring(0, 12) + '...') : chalk.red('NOT SET')}`);
        console.log(`  Server:     ${baseUrl ? chalk.green(baseUrl) : chalk.red('NOT SET')}`);
        console.log(`  App Name:   ${appName ? chalk.green(appName) : chalk.yellow('Default')}`);
        console.log(`  Security:   ${secLevel ? chalk.green(secLevel) : chalk.yellow('medium (default)')}`);
        console.log('');

        const globalConfig = loadGlobalConfig();
        if (globalConfig.email) {
            console.log(chalk.dim(`  Logged in as: ${globalConfig.email}`));
        }
        console.log('');
    });

// ================================================================
//  DAEMON — System command monitoring
// ================================================================
program
    .command('daemon')
    .description('Manage the DIANA system monitor daemon')
    .argument('[action]', 'Action to perform (start|status)', 'start')
    .action(async (action) => {
        if (action === 'start') {
            console.log('');
            console.log(chalk.cyan('  🛡️  DIANA System Monitor — Starting...'));
            console.log(chalk.dim('  ─────────────────────────────────────────────'));

            const apiKey = loadEnvValue('DIANA_API_KEY');
            const baseUrl = loadEnvValue('DIANA_BASE_URL');
            const appName = loadEnvValue('DIANA_APP_NAME') || 'SystemMonitor';

            if (!apiKey || !baseUrl) {
                console.error(chalk.yellow('  ⚠️  Not configured. Run "diana init" first.'));
                return;
            }

            const daemon = createDaemon({ apiKey, baseUrl, appName });

            try {
                await daemon.start();
                console.log(chalk.green('  ✅ Daemon is running and intercepting commands.'));
                console.log(chalk.dim('  Press Ctrl+C to stop.'));

                // Keep the process alive
                process.on('SIGINT', () => {
                    daemon.stop();
                    process.exit();
                });
            } catch (err) {
                console.error(chalk.red(`  ❌ Failed to start daemon: ${err.message}`));
            }
        } else if (action === 'status') {
            const historyPath = path.join(require('os').homedir(), 'AppData', 'Roaming', 'Microsoft', 'Windows', 'PowerShell', 'PSReadLine', 'ConsoleHost_history.txt');
            console.log('');
            console.log(chalk.cyan('  🛡️  DIANA System Monitor Status'));
            console.log(chalk.dim('  ─────────────────────────────────────────────'));
            console.log(`  OS:           ${chalk.green(require('os').platform())}`);
            console.log(`  History File: ${fs.existsSync(historyPath) ? chalk.green('Detected') : chalk.red('Not Found')}`);
            console.log(`  Monitoring:   ${chalk.dim('Run "diana daemon start" to begin')}`);
            console.log('');
        }
    });

// ================================================================
//  HELPERS
// ================================================================

/**
 * Read a value from the local .env file
 */
function loadEnvValue(key) {
    // First check actual env vars
    if (process.env[key]) return process.env[key];

    // Then check local .env file
    const envPath = path.resolve(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
        const content = fs.readFileSync(envPath, 'utf8');
        const match = content.match(new RegExp(`^${key}=(.*)`, 'm'));
        if (match) return match[1].trim();
    }
    return null;
}

/**
 * Get the path to the global config file
 */
function getGlobalConfigPath() {
    return path.join(process.env.HOME || process.env.USERPROFILE, '.dianarc');
}

/**
 * Save configuration to the global config file (~/.dianarc)
 */
function saveGlobalConfig(data) {
    const configPath = getGlobalConfigPath();
    let existing = {};
    if (fs.existsSync(configPath)) {
        try { existing = JSON.parse(fs.readFileSync(configPath, 'utf8')); } catch (e) { }
    }
    fs.writeFileSync(configPath, JSON.stringify({ ...existing, ...data }, null, 2));
}

/**
 * Load the global config file (~/.dianarc)
 */
function loadGlobalConfig() {
    const configPath = getGlobalConfigPath();
    if (fs.existsSync(configPath)) {
        try { return JSON.parse(fs.readFileSync(configPath, 'utf8')); } catch (e) { }
    }
    return {};
}

program.parse(process.argv);
