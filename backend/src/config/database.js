const { Sequelize } = require('sequelize');
require('dotenv').config();

const sequelize = new Sequelize(
    process.env.DB_NAME,
    process.env.DB_USER,
    process.env.DB_PASSWORD,
    {
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        dialect: 'postgres',
        logging: false,
        pool: {
            max: 5,
            min: 0,
            acquire: 30000,
            idle: 10000
        }
    }
);

const testConnection = async () => {
    try {
        await sequelize.authenticate();
        console.log('✅ PostgreSQL connection established successfully.');
    } catch (error) {
        console.error('❌ Unable to connect to the database:', error);
    }
};

const syncDatabase = async () => {
    try {
        // ONLY FOR DEVELOPMENT: Auto-sync schema changes
        // This will add missing columns like 'response_body'
        if (process.env.NODE_ENV === 'development') {
            await sequelize.sync({ alter: true });
            console.log('✅ Database schema synchronized.');
        }
    } catch (error) {
        console.error('❌ Unable to sync database schema:', error);
    }
};

module.exports = { sequelize, testConnection, syncDatabase };
