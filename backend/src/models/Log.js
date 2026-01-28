const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const Session = require('./Session');

const Log = sequelize.define('Log', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    sessionKey: {
        type: DataTypes.TEXT,
        field: 'session_key',
        references: {
            model: Session,
            key: 'session_key'
        }
    },
    timestamp: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    },
    method: {
        type: DataTypes.STRING(10)
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
    }
}, {
    tableName: 'logs',
    timestamps: false
});

// Associations
Log.belongsTo(Session, { foreignKey: 'sessionKey', targetKey: 'sessionKey' });
Session.hasMany(Log, { foreignKey: 'sessionKey', sourceKey: 'sessionKey' });

module.exports = Log;

