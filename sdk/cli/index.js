#!/usr/bin/env node
const { Command } = require('commander');
const inquirer = require('inquirer');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
require('dotenv').config();

const program = new Command();

program
  .name('honeypot-cli')
  .description('Provisioning tool for the Honeypot Security SDK')
  .version('1.0.0');

/**
 * Login Command
 */
program
  .command('login')
  .description('Authenticate with the Honeypot Central Server')
  .action(async () => {
    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'serverUrl',
        message: 'Enter the Honeypot Server URL:',
        default: 'http://localhost:4002'
      },
      {
        type: 'input',
        name: 'email',
        message: 'Enter your email:'
      },
      {
        type: 'password',
        name: 'password',
        message: 'Enter your password:'
      }
    ]);

    try {
      console.log(chalk.blue('\nAuthenticating...'));
      const response = await axios.post(`${answers.serverUrl}/api/v1/saas/login`, {
        email: answers.email,
        password: answers.password
      });

      if (response.data.success) {
        const token = response.data.token;
        saveConfig({ serverUrl: answers.serverUrl, token });
        console.log(chalk.green('✅ Login successful! Token saved.'));
      }
    } catch (error) {
      console.error(chalk.red('❌ Login failed:'), error.response?.data?.error || error.message);
    }
  });

/**
 * Provision Command
 */
program
  .command('provision')
  .description('Setup environment and generate security keys')
  .action(async () => {
    const config = loadConfig();
    if (!config.token || !config.serverUrl) {
      console.error(chalk.yellow('⚠️  Not authenticated. Please run "honeypot-cli login" first.'));
      return;
    }

    try {
      console.log(chalk.blue('\nFetching available API keys...'));
      const keysResponse = await axios.get(`${config.serverUrl}/api/v1/saas/keys`, {
        headers: { 'Authorization': `Bearer ${config.token}` }
      });

      if (!keysResponse.data.success || keysResponse.data.keys.length === 0) {
        console.error(chalk.red('❌ No projects found. Create a project in the dashboard first.'));
        return;
      }

      const { selectedKey } = await inquirer.prompt([
        {
          type: 'list',
          name: 'selectedKey',
          message: 'Select the project to provision:',
          choices: keysResponse.data.keys.map(k => ({ name: k.name, value: k }))
        }
      ]);

      console.log(chalk.blue(`\nProvisioning project: ${selectedKey.name}...`));

      // Update .env file
      const envPath = path.resolve(process.cwd(), '.env');
      let envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';

      const updates = {
        'HONEYPOT_TOKEN': config.token,
        'HONEYPOT_SERVER_URL': config.serverUrl,
        'HONEYPOT_APP_NAME': selectedKey.name
      };

      Object.entries(updates).forEach(([key, value]) => {
        const regex = new RegExp(`^${key}=.*`, 'm');
        if (regex.test(envContent)) {
          envContent = envContent.replace(regex, `${key}=${value}`);
        } else {
          envContent += `\n${key}=${value}`;
        }
      });

      fs.writeFileSync(envPath, envContent.trim() + '\n');
      console.log(chalk.green(`✅ Configuration saved to ${envPath}`));
      console.log(chalk.cyan('\nNext Steps:'));
      console.log('1. Install the SDK: npm install @honeypot/sdk');
      console.log('2. Initialize in your app: const sdk = new Honeypot();');

    } catch (error) {
      console.error(chalk.red('❌ Provisioning error:'), error.response?.data?.error || error.message);
    }
  });

/**
 * Verify Command
 */
program
  .command('verify')
  .description('Check connectivity and tunnel status')
  .action(async () => {
    const config = loadConfig();
    if (!config.token || !config.serverUrl) {
      console.error(chalk.yellow('⚠️  Configuration missing. Run "login" and "provision".'));
      return;
    }

    try {
      console.log(chalk.blue('\nVerifying connection...'));
      const response = await axios.get(`${config.serverUrl}/api/v1/saas/sdk-verify`, {
        headers: { 'Authorization': `Bearer ${config.token}` }
      });

      if (response.data.success) {
        console.log(chalk.green('✅ Server reached.'));
        console.log(`Status: ${response.data.connected ? chalk.green('ACTIVE') : chalk.yellow('NO DATA RECEIVED YET')}`);
      }
    } catch (error) {
      console.error(chalk.red('❌ Verification failed:'), error.message);
    }
  });

// Helper functions
function saveConfig(data) {
  const configPath = path.join(process.env.HOME || process.env.USERPROFILE, '.honeypotrc');
  fs.writeFileSync(configPath, JSON.stringify(data, null, 2));
}

function loadConfig() {
  const configPath = path.join(process.env.HOME || process.env.USERPROFILE, '.honeypotrc');
  if (fs.existsSync(configPath)) {
    return JSON.parse(fs.readFileSync(configPath, 'utf8'));
  }
  return {};
}

program.parse(process.argv);
