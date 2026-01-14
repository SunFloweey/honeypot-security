const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const Session = require('./Session');

const Log = sequelize.define('Log', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    session_key: {
        type: DataTypes.TEXT,
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
    query_params: {
        type: DataTypes.JSONB
    },
    headers: {
        type: DataTypes.JSONB
    },
    body: {
        type: DataTypes.TEXT
    },
    ip_address: {
        type: DataTypes.INET
    },
    status_code: {
        type: DataTypes.INTEGER
    },
    response_time_ms: {
        type: DataTypes.INTEGER
    }
}, {
    tableName: 'logs',
    timestamps: false
});

// Associations
Log.belongsTo(Session, { foreignKey: 'session_key' });
Session.hasMany(Log, { foreignKey: 'session_key' });

module.exports = Log;
