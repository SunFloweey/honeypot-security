const { Sequelize } = require('sequelize');
require('dotenv').config();

/**
 * Database Configuration
 * Supports multiple environments and exports configuration for Sequelize CLI.
 */
const dbConfig = {
    development: {
        username: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'postgres',
        database: process.env.DB_NAME || 'honeypot',
        host: process.env.DB_HOST || '127.0.0.1',
        port: process.env.DB_PORT || 5432,
        dialect: 'postgres',
        logging: false,
        pool: { max: 10, min: 2, acquire: 30000, idle: 10000 }
    },
    production: {
        username: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        host: process.env.DB_HOST,
        port: process.env.DB_PORT || 5432,
        dialect: 'postgres',
        logging: false,
        pool: { max: 20, min: 5, acquire: 30000, idle: 10000 }
    }
};

const env = process.env.NODE_ENV || 'development';
const config = dbConfig[env];

const sequelize = new Sequelize(
    config.database,
    config.username,
    config.password,
    {
        host: config.host,
        port: config.port,
        dialect: config.dialect,
        logging: config.logging,
        pool: config.pool
    }
);

/**
 * Verifies database connection
 */
const testConnection = async () => {
    try {
        await sequelize.authenticate();
        console.log(`✅ PostgreSQL Connection: Success [${env} mode]`);
        return true;
    } catch (error) {
        console.error('❌ PostgreSQL Connection: Failed', error.message);
        return false;
    }
};

module.exports = {
    ...dbConfig,
    sequelize,
    testConnection,
    config
};