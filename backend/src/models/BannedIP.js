const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const BannedIP = sequelize.define('BannedIP', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    ipAddress: {
        type: DataTypes.INET,
        field: 'ip_address',
        allowNull: false,
        unique: true
    },
    reason: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    bannedAt: {
        type: DataTypes.DATE,
        field: 'banned_at',
        defaultValue: DataTypes.NOW
    }
}, {
    tableName: 'banned_ips',
    timestamps: false
});

module.exports = BannedIP;
