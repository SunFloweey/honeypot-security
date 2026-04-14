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
    static async _registerToken(tokenValue, metadata, apiKeyId = null) {
        try {
            // Keep in-memory for instant lookups during THIS session
            this.tokenRegistry.set(tokenValue, {
                ...metadata,
                apiKeyId,
                generatedAt: new Date().toISOString(),
            });

            // Persist to DB
            await Honeytoken.upsert({
                tokenValue: tokenValue,
                tokenType: metadata.type,
                fingerprint: metadata.fingerprint,
                metadata: metadata,
                apiKeyId: apiKeyId
            });

            console.log(`🍯 [Honeytoken] Registered: ${metadata.type} (Tenant: ${apiKeyId || 'Global'})`);
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
    static generateAWSKeys(context = {}) {
        const fp = this._generateFingerprint('aws');
        const apiKeyId = context.apiKeyId || null;
        const accessKeyId = `AKIA${fp.toUpperCase().padEnd(16, 'X').substring(0, 16)}`;
        const secretKey = crypto.randomBytes(30).toString('base64').substring(0, 40);

        this._registerToken(accessKeyId, { type: 'aws_access_key', fingerprint: fp }, apiKeyId);

        return {
            AWS_ACCESS_KEY_ID: accessKeyId,
            AWS_SECRET_ACCESS_KEY: secretKey,
            AWS_DEFAULT_REGION: 'us-east-1',
        };
    }

    /**
     * Generates a fake MongoDB connection string
     */
    static generateMongoCredentials(context = {}) {
        const fp = this._generateFingerprint('mongo');
        const apiKeyId = context.apiKeyId || null;
        const user = 'admin';
        const password = `Pr0d_${fp}_Secure!`;
        const host = `mongo-${crypto.randomBytes(2).toString('hex')}.cluster.internal`;

        this._registerToken(password, { type: 'mongo_connection', fingerprint: fp }, apiKeyId);

        return {
            MONGO_URI: `mongodb+srv://${user}:${password}@${host}:27017/production?retryWrites=true&w=majority`,
            MONGO_DB_NAME: 'app_production',
        };
    }

    /**
     * Generates fake Stripe API keys
     */
    static generateStripeKeys(context = {}) {
        const fp = this._generateFingerprint('stripe');
        const apiKeyId = context.apiKeyId || null;
        const pubKey = `pk_live_51H${crypto.randomBytes(20).toString('base64').replace(/[^a-zA-Z0-9]/g, '').substring(0, 24)}`;
        const secretKey = `sk_live_51H${fp}${crypto.randomBytes(10).toString('base64').replace(/[^a-zA-Z0-9]/g, '').substring(0, 14)}`;

        this._registerToken(secretKey, { type: 'stripe_secret', fingerprint: fp }, apiKeyId);

        return {
            STRIPE_PUBLISHABLE_KEY: pubKey,
            STRIPE_SECRET_KEY: secretKey,
        };
    }

    /**
     * Generates a fake JWT secret
     */
    static generateJWTSecret(context = {}) {
        const fp = this._generateFingerprint('jwt');
        const apiKeyId = context.apiKeyId || null;
        const secret = `jwt_${fp}_${crypto.randomBytes(16).toString('hex')}`;

        this._registerToken(secret, { type: 'jwt_secret', fingerprint: fp }, apiKeyId);

        return {
            JWT_SECRET: secret,
            JWT_EXPIRY: '7d',
            JWT_ISSUER: 'secure-app-production',
        };
    }

    /**
     * Generates a fake SMTP configuration
     */
    static generateSMTPCredentials(context = {}) {
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
    static generatePostgresCredentials(context = {}) {
        const fp = this._generateFingerprint('pg');
        const apiKeyId = context.apiKeyId || null;
        const password = `PgAdmin_${fp}_!Secure`;

        this._registerToken(password, { type: 'postgres_password', fingerprint: fp }, apiKeyId);

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
    static generateRedisCredentials(context = {}) {
        const fp = this._generateFingerprint('redis');
        return {
            REDIS_URL: `redis://default:Redis_${fp}_Cache@cache-prod.internal:6379/0`,
        };
    }

    /**
     * Generates fake GitHub/OAuth tokens
     */
    static generateOAuthTokens(context = {}) {
        const fp = this._generateFingerprint('oauth');
        const apiKeyId = context.apiKeyId || null;
        const ghToken = `ghp_${fp}${crypto.randomBytes(12).toString('base64').replace(/[^a-zA-Z0-9]/g, '').substring(0, 20)}`;

        this._registerToken(ghToken, { type: 'github_token', fingerprint: fp }, apiKeyId);

        return {
            GITHUB_TOKEN: ghToken,
            GITHUB_CLIENT_ID: crypto.randomBytes(10).toString('hex'),
            GITHUB_CLIENT_SECRET: crypto.randomBytes(20).toString('hex'),
        };
    }

    /**
     * Generates a complete, realistic .env file for a Node.js application
     */
    static generateEnvFile(context = {}) {
        const aws = this.generateAWSKeys(context);
        const mongo = this.generateMongoCredentials(context);
        const stripe = this.generateStripeKeys(context);
        const jwt = this.generateJWTSecret(context);
        const smtp = this.generateSMTPCredentials(context);
        const pg = this.generatePostgresCredentials(context);
        const redis = this.generateRedisCredentials(context);
        const oauth = this.generateOAuthTokens(context);

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
`;
    }

    static generateConfigJson(context = {}) {
        const aws = this.generateAWSKeys(context);
        const pg = this.generatePostgresCredentials(context);
        const redis = this.generateRedisCredentials(context);
        const jwt = this.generateJWTSecret(context);

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
            },
            storage: {
                driver: 's3',
                aws: {
                    accessKeyId: aws.AWS_ACCESS_KEY_ID,
                    secretAccessKey: aws.AWS_SECRET_ACCESS_KEY,
                    region: aws.AWS_DEFAULT_REGION,
                    bucket: 'secureapp-assets-prod',
                },
            }
        };
    }

    static generateDockerCompose(context = {}) {
        const pg = this.generatePostgresCredentials(context);
        return `version: '3.8'\nservices:\n  app:\n    environment:\n      - DB_PASSWORD=${pg.DB_PASSWORD}`;
    }

    static generateK8sSecrets(context = {}) {
        const pg = this.generatePostgresCredentials(context);
        return `apiVersion: v1\nkind: Secret\ndata:\n  DB_PASSWORD: ${Buffer.from(pg.DB_PASSWORD).toString('base64')}`;
    }

    static async generateWithAI(fileType, requestPath, context = {}) {
        const honeytokens = this.generateEnvFile(context);
        const prompt = `Generate a realistic ${fileType} for ${requestPath} with these credentials:\n${honeytokens.split('\n').slice(0, 10).join('\n')}`;
        try {
            let content = await AIService._generateText(prompt);
            return content ? content.replace(/^```[a-z]*\n/i, '').replace(/\n```$/g, '').trim() : this.generateEnvFile(context);
        } catch (error) {
            return this.generateEnvFile(context);
        }
    }

    static checkToken(credential) {
        if (!credential) return null;
        for (const [key, value] of this.tokenRegistry.entries()) {
            if (credential.includes(key)) {
                this.usageLog.push({ credential: key.substring(0, 20) + '...', type: value.type, apiKeyId: value.apiKeyId, detectedAt: new Date().toISOString() });
                return value;
            }
        }
        return null;
    }

    static async getTokenSummary(filter = {}) {
        try {
            const { apiKeyId, userId } = filter;
            let whereClause = {};
            if (apiKeyId) {
                whereClause.apiKeyId = apiKeyId;
            } else if (userId) {
                const ApiKey = require('../models/ApiKey');
                const userKeys = await ApiKey.findAll({ where: { userId }, attributes: ['id'] });
                whereClause.apiKeyId = { [require('sequelize').Op.in]: userKeys.map(k => k.id) };
            }
            const recentUsages = await HoneytokenUsage.findAll({ where: whereClause, limit: 50, order: [['createdAt', 'DESC']] });
            const counts = await Honeytoken.findAll({ attributes: ['tokenType', [sequelize.fn('COUNT', sequelize.col('id')), 'count']], where: whereClause, group: ['tokenType'] });
            const types = {};
            counts.forEach(c => { types[c.tokenType || 'unknown'] = parseInt(c.get('count')); });
            return { totalActive: await Honeytoken.count({ where: whereClause }), byType: types, usageCount: await HoneytokenUsage.count({ where: whereClause }), recentUsage: recentUsages, lastRefresh: new Date().toISOString() };
        } catch (error) {
            return { totalActive: 0, usageCount: 0, recentUsage: [], lastRefresh: new Date().toISOString(), error: error.message };
        }
    }
}

module.exports = HoneytokenService;
