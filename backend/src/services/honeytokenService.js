/**
 * HoneytokenService - Intelligent Fake Credential Generator
 * 
 * Generates realistic but TRACEABLE fake credentials (honeytokens)
 * that are embedded in honeypot responses. Each token contains a
 * hidden fingerprint that allows attribution if used elsewhere.
 * 
 * Architecture:
 * - Static templates for instant response (no AI latency)
 * - AI-enhanced generation for highly realistic output
 * - Unique fingerprinting for attribution tracking
 * - Event logging when tokens are "used"
 * 
 * @module services/honeytokenService
 */
const crypto = require('crypto');
const AIService = require('./aiService');
const { sequelize } = require('../config/database');
const Honeytoken = require('../models/Honeytoken');
const HoneytokenUsage = require('../models/HoneytokenUsage');

class HoneytokenService {

    /**
     * In-memory registry of all generated honeytokens.
     * In production, this should be backed by Redis or a database table.
     * Key: token fingerprint, Value: { type, generatedAt, requestContext }
     */
    static tokenRegistry = new Map();

    /**
     * Usage log: tracks when/where tokens are detected in use
     */
    static usageLog = [];

    // ============================
    // FINGERPRINT GENERATION
    // ============================

    /**
     * Generates a unique fingerprint embedded inside a fake credential.
     * The fingerprint is subtle enough to look like part of a real key,
     * but unique enough to trace back to this honeypot.
     * 
     * @param {string} type - Type of credential (aws, mongo, stripe, jwt, etc.)
     * @returns {string} A hex fingerprint
     */
    static _generateFingerprint(type) {
        const timestamp = Date.now().toString(36);
        const random = crypto.randomBytes(4).toString('hex');
        return `${type.substring(0, 2)}${timestamp}${random}`;
    }

    /**
     * Registers a honeytoken in the database for tracking
     */
    static async _registerToken(tokenValue, metadata) {
        try {
            // Keep in-memory for instant lookups during THIS session
            this.tokenRegistry.set(tokenValue, {
                ...metadata,
                generatedAt: new Date().toISOString(),
            });

            // Persist to DB
            await Honeytoken.upsert({
                tokenValue: tokenValue,
                tokenType: metadata.type,
                fingerprint: metadata.fingerprint,
                metadata: metadata
            });

            console.log(`🍯 [Honeytoken] Registered: ${metadata.type}`);
        } catch (error) {
            console.error('❌ Error registering honeytoken:', error);
        }
    }

    // ============================
    // TOKEN GENERATORS
    // ============================

    /**
     * Generates a fake AWS Access Key pair with embedded fingerprint
     */
    static generateAWSKeys() {
        const fp = this._generateFingerprint('aws');
        // Real AWS keys follow the format AKIA[16 chars] for access key
        const accessKeyId = `AKIA${fp.toUpperCase().padEnd(16, 'X').substring(0, 16)}`;
        const secretKey = crypto.randomBytes(30).toString('base64').substring(0, 40);

        this._registerToken(accessKeyId, { type: 'aws_access_key', fingerprint: fp });

        return {
            AWS_ACCESS_KEY_ID: accessKeyId,
            AWS_SECRET_ACCESS_KEY: secretKey,
            AWS_DEFAULT_REGION: 'us-east-1',
        };
    }

    /**
     * Generates a fake MongoDB connection string
     */
    static generateMongoCredentials() {
        const fp = this._generateFingerprint('mongo');
        const user = 'admin';
        const password = `Pr0d_${fp}_Secure!`;
        const host = `mongo-${crypto.randomBytes(2).toString('hex')}.cluster.internal`;

        this._registerToken(password, { type: 'mongo_connection', fingerprint: fp });

        return {
            MONGO_URI: `mongodb+srv://${user}:${password}@${host}:27017/production?retryWrites=true&w=majority`,
            MONGO_DB_NAME: 'app_production',
        };
    }

    /**
     * Generates fake Stripe API keys
     */
    static generateStripeKeys() {
        const fp = this._generateFingerprint('stripe');
        const pubKey = `pk_live_51H${crypto.randomBytes(20).toString('base64').replace(/[^a-zA-Z0-9]/g, '').substring(0, 24)}`;
        const secretKey = `sk_live_51H${fp}${crypto.randomBytes(10).toString('base64').replace(/[^a-zA-Z0-9]/g, '').substring(0, 14)}`;

        this._registerToken(secretKey, { type: 'stripe_secret', fingerprint: fp });

        return {
            STRIPE_PUBLISHABLE_KEY: pubKey,
            STRIPE_SECRET_KEY: secretKey,
        };
    }

    /**
     * Generates a fake JWT secret
     */
    static generateJWTSecret() {
        const fp = this._generateFingerprint('jwt');
        const secret = `jwt_${fp}_${crypto.randomBytes(16).toString('hex')}`;

        this._registerToken(secret, { type: 'jwt_secret', fingerprint: fp });

        return {
            JWT_SECRET: secret,
            JWT_EXPIRY: '7d',
            JWT_ISSUER: 'secure-app-production',
        };
    }

    /**
     * Generates a fake SMTP configuration
     */
    static generateSMTPCredentials() {
        const fp = this._generateFingerprint('smtp');
        return {
            SMTP_HOST: 'smtp.gmail.com',
            SMTP_PORT: '587',
            SMTP_USER: `noreply@${crypto.randomBytes(3).toString('hex')}-corp.com`,
            SMTP_PASS: `Mail_${fp}_2024!`,
        };
    }

    /**
     * Generates a fake PostgreSQL connection
     */
    static generatePostgresCredentials() {
        const fp = this._generateFingerprint('pg');
        const password = `PgAdmin_${fp}_!Secure`;

        this._registerToken(password, { type: 'postgres_password', fingerprint: fp });

        return {
            DB_HOST: `db-prod-${crypto.randomBytes(2).toString('hex')}.internal.aws`,
            DB_PORT: '5432',
            DB_NAME: 'production_main',
            DB_USER: 'app_service',
            DB_PASSWORD: password,
        };
    }

    /**
     * Generates a fake Redis configuration
     */
    static generateRedisCredentials() {
        const fp = this._generateFingerprint('redis');
        return {
            REDIS_URL: `redis://default:Redis_${fp}_Cache@cache-prod.internal:6379/0`,
        };
    }

    /**
     * Generates fake GitHub/OAuth tokens
     */
    static generateOAuthTokens() {
        const fp = this._generateFingerprint('oauth');
        const ghToken = `ghp_${fp}${crypto.randomBytes(12).toString('base64').replace(/[^a-zA-Z0-9]/g, '').substring(0, 20)}`;

        this._registerToken(ghToken, { type: 'github_token', fingerprint: fp });

        return {
            GITHUB_TOKEN: ghToken,
            GITHUB_CLIENT_ID: crypto.randomBytes(10).toString('hex'),
            GITHUB_CLIENT_SECRET: crypto.randomBytes(20).toString('hex'),
        };
    }

    // ============================
    // COMPOSITE FILE GENERATORS
    // ============================

    /**
     * Generates a complete, realistic .env file for a Node.js application
     * 
     * @param {Object} context - Optional context for customization
     * @returns {string} A realistic .env file content
     */
    static generateEnvFile(context = {}) {
        const aws = this.generateAWSKeys();
        const mongo = this.generateMongoCredentials();
        const stripe = this.generateStripeKeys();
        const jwt = this.generateJWTSecret();
        const smtp = this.generateSMTPCredentials();
        const pg = this.generatePostgresCredentials();
        const redis = this.generateRedisCredentials();
        const oauth = this.generateOAuthTokens();

        const appName = context.appName || 'SecureApp';
        const appUrl = context.appUrl || 'https://api.secureapp.io';

        return `# ═══════════════════════════════════════════════
# ${appName.toUpperCase()} - PRODUCTION ENVIRONMENT
# Last updated: ${new Date().toISOString().split('T')[0]}
# WARNING: Do not commit this file to version control!
# ═══════════════════════════════════════════════

# Application
NODE_ENV=production
APP_NAME=${appName}
APP_URL=${appUrl}
APP_PORT=3000
APP_DEBUG=false
APP_LOG_LEVEL=warn

# Database (Primary - PostgreSQL)
${Object.entries(pg).map(([k, v]) => `${k}=${v}`).join('\n')}
DB_POOL_MIN=5
DB_POOL_MAX=20
DB_SSL=true

# Database (Secondary - MongoDB for Analytics)
${Object.entries(mongo).map(([k, v]) => `${k}=${v}`).join('\n')}

# Cache & Sessions
${Object.entries(redis).map(([k, v]) => `${k}=${v}`).join('\n')}
SESSION_DRIVER=redis

# AWS S3 Storage
${Object.entries(aws).map(([k, v]) => `${k}=${v}`).join('\n')}
AWS_BUCKET=${appName.toLowerCase()}-uploads-prod
AWS_CDN_URL=https://cdn.${appName.toLowerCase()}.io

# Authentication
${Object.entries(jwt).map(([k, v]) => `${k}=${v}`).join('\n')}

# Payment Processing
${Object.entries(stripe).map(([k, v]) => `${k}=${v}`).join('\n')}
STRIPE_WEBHOOK_SECRET=whsec_${crypto.randomBytes(16).toString('hex')}

# Email (SMTP)
${Object.entries(smtp).map(([k, v]) => `${k}=${v}`).join('\n')}

# OAuth / GitHub Integration
${Object.entries(oauth).map(([k, v]) => `${k}=${v}`).join('\n')}

# Third-party APIs
SENDGRID_API_KEY=SG.${crypto.randomBytes(22).toString('base64').replace(/[^a-zA-Z0-9]/g, '')}
SENTRY_DSN=https://${crypto.randomBytes(16).toString('hex')}@o123456.ingest.sentry.io/789
GOOGLE_MAPS_KEY=AIzaSy${crypto.randomBytes(16).toString('base64').replace(/[^a-zA-Z0-9]/g, '').substring(0, 20)}

# Internal Services
MICROSERVICE_API_KEY=${crypto.randomBytes(32).toString('hex')}
INTERNAL_WEBHOOK_URL=https://hooks.internal.${appName.toLowerCase()}.io/events

# Feature Flags
FEATURE_NEW_DASHBOARD=true
FEATURE_BETA_API_V3=false

# TODO: Rotate these keys before Q2 deployment
# TODO: Move secrets to AWS Secrets Manager (ticket: SEC-1247)
`;
    }

    /**
     * Generates a realistic config.json with database and API credentials
     */
    static generateConfigJson(context = {}) {
        const aws = this.generateAWSKeys();
        const pg = this.generatePostgresCredentials();
        const redis = this.generateRedisCredentials();
        const jwt = this.generateJWTSecret();

        return {
            application: {
                name: context.appName || 'SecureApp',
                version: '3.2.1',
                environment: 'production',
                debug: false,
            },
            database: {
                primary: {
                    dialect: 'postgres',
                    host: pg.DB_HOST,
                    port: parseInt(pg.DB_PORT),
                    database: pg.DB_NAME,
                    username: pg.DB_USER,
                    password: pg.DB_PASSWORD,
                    ssl: true,
                    pool: { min: 5, max: 25, idle: 10000 },
                },
                cache: {
                    driver: 'redis',
                    url: redis.REDIS_URL,
                    prefix: 'app:',
                },
            },
            auth: {
                jwt: {
                    secret: jwt.JWT_SECRET,
                    expiresIn: jwt.JWT_EXPIRY,
                    issuer: jwt.JWT_ISSUER,
                    algorithm: 'HS256',
                },
                oauth: {
                    google: {
                        clientId: `${crypto.randomBytes(20).toString('hex')}.apps.googleusercontent.com`,
                        clientSecret: `GOCSPX-${crypto.randomBytes(16).toString('base64').replace(/[^a-zA-Z0-9]/g, '')}`,
                    },
                },
            },
            storage: {
                driver: 's3',
                aws: {
                    accessKeyId: aws.AWS_ACCESS_KEY_ID,
                    secretAccessKey: aws.AWS_SECRET_ACCESS_KEY,
                    region: aws.AWS_DEFAULT_REGION,
                    bucket: 'secureapp-assets-prod',
                },
            },
            // Breadcrumb: entice attacker to look for more
            _internal: {
                adminPanelUrl: '/internal/admin-v2',
                backupEndpoint: '/api/v1/db/export',
                debugToken: crypto.randomBytes(16).toString('hex'),
            },
        };
    }

    /**
     * Generates a realistic docker-compose.yml
     */
    static generateDockerCompose() {
        const pg = this.generatePostgresCredentials();
        const redis = this.generateRedisCredentials();

        return `version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DB_HOST=postgres
      - DB_PORT=5432
      - DB_USER=${pg.DB_USER}
      - DB_PASSWORD=${pg.DB_PASSWORD}
      - DB_NAME=${pg.DB_NAME}
      - REDIS_URL=redis://redis:6379/0
    depends_on:
      - postgres
      - redis
    restart: unless-stopped
    # TODO: Remove debug port before production deploy
    # ports:
    #   - "9229:9229"

  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: ${pg.DB_USER}
      POSTGRES_PASSWORD: ${pg.DB_PASSWORD}
      POSTGRES_DB: ${pg.DB_NAME}
    volumes:
      - pgdata:/var/lib/postgresql/data
      # Backup script runs daily via cron in the host OS
      - ./backups:/backups
    ports:
      - "5432:5432"

  redis:
    image: redis:7-alpine
    command: redis-server --requirepass ${crypto.randomBytes(8).toString('hex')}
    ports:
      - "6379:6379"

  # Admin panel (restricted access)
  admin:
    build:
      context: .
      dockerfile: Dockerfile.admin
    ports:
      - "4000:4000"
    environment:
      - ADMIN_SECRET=${crypto.randomBytes(24).toString('hex')}
      - DB_HOST=postgres
    depends_on:
      - postgres

volumes:
  pgdata:
    driver: local

# Note: Production uses AWS RDS, this is for staging/dev
# See /docs/deployment.md for production setup
`;
    }

    /**
     * Generates a fake Kubernetes secrets YAML
     */
    static generateK8sSecrets() {
        const aws = this.generateAWSKeys();
        const pg = this.generatePostgresCredentials();
        const jwt = this.generateJWTSecret();

        const b64 = (str) => Buffer.from(str).toString('base64');

        return `apiVersion: v1
kind: Secret
metadata:
  name: app-secrets
  namespace: production
  labels:
    app: secureapp
    environment: production
type: Opaque
data:
  DB_HOST: ${b64(pg.DB_HOST)}
  DB_PASSWORD: ${b64(pg.DB_PASSWORD)}
  DB_USER: ${b64(pg.DB_USER)}
  AWS_ACCESS_KEY_ID: ${b64(aws.AWS_ACCESS_KEY_ID)}
  AWS_SECRET_ACCESS_KEY: ${b64(aws.AWS_SECRET_ACCESS_KEY)}
  JWT_SECRET: ${b64(jwt.JWT_SECRET)}
---
# TODO: Migrate to external-secrets-operator (Jira: INFRA-2341)
# Current approach stores secrets directly in cluster
`;
    }

    // ============================
    // AI-ENHANCED GENERATION
    // ============================

    /**
     * Uses OpenAI GPT to generate highly realistic credential files
     * with context-aware content (e.g., if the attacker hits /.env,
     * generate content matching what they'd expect from that app)
     * 
     * @param {string} fileType - Type of file requested
     * @param {string} requestPath - The path the attacker requested
     * @returns {string|Object} Generated content
     */
    static async generateWithAI(fileType, requestPath) {
        console.log(`[OpenAI] Corretto ingresso in HoneytokenService.generateWithAI per path: ${requestPath}`);
        const honeytokens = this.generateEnvFile();

        const prompt = `
        You are a DevOps engineer's configuration file. An automated security scanner 
        has accessed "${requestPath}" on a Node.js/Express production server.
        
        Generate a HIGHLY REALISTIC ${fileType} file that:
        1. Looks exactly like what a real production app would have
        2. Contains these EXACT credentials (they are honeytokens for tracking):
        
        ${honeytokens.split('\n').slice(0, 20).join('\n')}
        
        3. Add realistic comments, TODOs, and formatting
        4. Include references to other files/paths that might entice further exploration
           (e.g., "/backups/daily/", "/internal/admin/", "/.ssh/authorized_keys")
        5. Return ONLY the file content, no explanations or markdown
        `;

        try {
            console.log(`[OpenAI] Chiamata AI avviata per generazione Honeytoken realistica...`);
            let content = await AIService._generateText(prompt);

            if (!content) return this.generateEnvFile();

            // Strip markdown formatting if present
            content = content.replace(/^```[a-z]*\n/i, '').replace(/\n```$/g, '').trim();
            return content;
        } catch (error) {
            console.error('❌ AI Honeytoken Generation Error:', error.message);
            // Fallback to deterministic generation
            return this.generateEnvFile();
        }
    }

    // ============================
    // TOKEN VERIFICATION
    // ============================

    /**
     * Checks if a given credential string matches any registered honeytoken.
     * Call this from external monitoring systems or when suspicious auth attempts
     * are detected.
     * 
     * @param {string} credential - The credential to check
     * @returns {Object|null} Token metadata if found, null otherwise
     */
    static checkToken(credential) {
        if (!credential) return null;

        // Direct lookup
        if (this.tokenRegistry.has(credential)) {
            const token = this.tokenRegistry.get(credential);
            this.usageLog.push({
                credential: credential.substring(0, 20) + '...',
                type: token.type,
                detectedAt: new Date().toISOString(),
            });

            console.warn(`🚨 [HONEYTOKEN ALERT] Tracked token used! Type: ${token.type}, Generated: ${token.generatedAt}`);
            return token;
        }

        // Substring search (for tokens embedded in connection strings, etc.)
        for (const [key, value] of this.tokenRegistry.entries()) {
            if (credential.includes(key)) {
                this.usageLog.push({
                    credential: key.substring(0, 20) + '...',
                    type: value.type,
                    matchedIn: credential.substring(0, 50) + '...',
                    detectedAt: new Date().toISOString(),
                });

                console.warn(`🚨 [HONEYTOKEN ALERT] Embedded token detected! Type: ${value.type}`);
                return value;
            }
        }

        return null;
    }

    /**
     * Returns the current usage log (for the admin dashboard)
     */
    static getUsageLog() {
        return {
            activeTokens: this.tokenRegistry.size,
            usageEvents: this.usageLog,
        };
    }

    /**
     * Gets a summary analysis of all honeytokens (Admin Dashboard)
     */
    static async getTokenSummary() {
        try {
            // Pull recent usage from DB
            const recentUsages = await HoneytokenUsage.findAll({
                limit: 50,
                order: [['createdAt', 'DESC']]
            });

            // Group tokens by type
            const counts = await Honeytoken.findAll({
                attributes: ['tokenType', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
                group: ['tokenType']
            });

            const types = {};
            counts.forEach(c => {
                types[c.tokenType || 'unknown'] = parseInt(c.get('count'));
            });

            return {
                totalActive: await Honeytoken.count(),
                byType: types,
                usageCount: await HoneytokenUsage.count(),
                recentUsage: recentUsages,
                lastRefresh: new Date().toISOString()
            };
        } catch (error) {
            // Fallback to in-memory if DB fails or isn't synced yet
            return {
                totalActive: this.tokenRegistry.size,
                usageCount: this.usageLog.length,
                recentUsage: this.usageLog,
                lastRefresh: new Date().toISOString(),
                error: 'DB error, showing in-memory data'
            };
        }
    }
}

module.exports = HoneytokenService;
