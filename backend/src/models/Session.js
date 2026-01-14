const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Session = sequelize.define('Session', {
    session_key: {
        type: DataTypes.TEXT,
        primaryKey: true
    },
    ip_address: {
        type: DataTypes.INET,
        allowNull: false
    },
    user_agent: {
        type: DataTypes.TEXT
    },
    first_seen: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    },
    last_seen: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    },
    request_count: {
        type: DataTypes.INTEGER,
        defaultValue: 1
    },
    max_risk_score: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    }
}, {
    tableName: 'sessions',
    timestamps: false
});

module.exports = Session;
