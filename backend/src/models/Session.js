const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Session = sequelize.define('Session', {
    sessionKey: {
        type: DataTypes.STRING(128),
        field: 'session_key',
        primaryKey: true
    },
    ipAddress: {
        type: DataTypes.INET,
        field: 'ip_address',
        allowNull: false
    },
    userAgent: {
        type: DataTypes.TEXT,
        field: 'user_agent'
    },
    firstSeen: {
        type: DataTypes.DATE,
        field: 'first_seen',
        defaultValue: DataTypes.NOW
    },
    lastSeen: {
        type: DataTypes.DATE,
        field: 'last_seen',
        defaultValue: DataTypes.NOW
    },
    requestCount: {
        type: DataTypes.INTEGER,
        field: 'request_count',
        defaultValue: 1
    },
    maxRiskScore: {
        type: DataTypes.INTEGER,
        field: 'max_risk_score',
        defaultValue: 0
    },
    screenResolution: {
        type: DataTypes.STRING,
        field: 'screen_resolution',
        allowNull: true
    },
    browserLanguage: {
        type: DataTypes.STRING,
        field: 'browser_language',
        allowNull: true
    },
    timezone: {
        type: DataTypes.STRING,
        allowNull: true
    },
    platform: {
        type: DataTypes.STRING,
        allowNull: true
    },
    apiKeyId: {
        type: DataTypes.UUID,
        field: 'api_key_id',
        allowNull: true,
        references: { model: 'api_keys', key: 'id' }
    }
}, {
    tableName: 'sessions',
    timestamps: false,
    indexes: [
        { fields: ['ip_address'] },
        { fields: ['last_seen'] },
        { fields: ['api_key_id'] }
    ]
});

Session.associate = (models) => {
    Session.hasMany(models.Log, { foreignKey: 'sessionKey', sourceKey: 'sessionKey' });
};

module.exports = Session;
