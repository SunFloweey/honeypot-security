const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Log = sequelize.define('Log', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    sessionKey: {
        type: DataTypes.STRING(128),
        field: 'session_key'
    },
    timestamp: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    },
    method: {
        type: DataTypes.STRING(20)
    },
    path: {
        type: DataTypes.TEXT
    },
    queryParams: {
        type: DataTypes.JSONB,
        field: 'query_params'
    },
    headers: {
        type: DataTypes.JSONB
    },
    body: {
        type: DataTypes.TEXT
    },
    ipAddress: {
        type: DataTypes.INET,
        field: 'ip_address'
    },
    statusCode: {
        type: DataTypes.INTEGER,
        field: 'status_code'
    },
    responseTimeMs: {
        type: DataTypes.INTEGER,
        field: 'response_time_ms'
    },
    responseBody: {
        type: DataTypes.TEXT,
        field: 'response_body',
        allowNull: true
    },
    riskScore: {
        type: DataTypes.INTEGER,
        field: 'risk_score',
        defaultValue: 0
    },
    fingerprint: {
        type: DataTypes.STRING(64),
        allowNull: true
    },
    leakedIp: {
        type: DataTypes.STRING(64),
        field: 'leaked_ip',
        allowNull: true
    },
    localIp: {
        type: DataTypes.STRING(64),
        field: 'local_ip',
        allowNull: true
    },
    apiKeyId: {
        type: DataTypes.UUID,
        field: 'api_key_id',
        allowNull: true,
        references: { model: 'api_keys', key: 'id' }
    }
}, {
    tableName: 'logs',
    timestamps: false,
    indexes: [
        { fields: ['session_key'] },
        { fields: ['timestamp'] },
        { fields: ['ip_address'] },
        { fields: ['risk_score'] },
        { fields: ['fingerprint'] }
    ]
});

Log.associate = (models) => {
    Log.belongsTo(models.Session, { foreignKey: 'sessionKey', targetKey: 'sessionKey' });
    Log.hasMany(models.Classification, { foreignKey: 'logId', as: 'Classifications' });
    Log.belongsTo(models.ApiKey, { foreignKey: 'apiKeyId', as: 'apiKey' });
};

module.exports = Log;
