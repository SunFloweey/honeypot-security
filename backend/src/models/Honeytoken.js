const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Honeytoken = sequelize.define('Honeytoken', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    tokenValue: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    },
    tokenType: {
        type: DataTypes.STRING,
        allowNull: false
    },
    fingerprint: {
        type: DataTypes.STRING,
        allowNull: false
    },
    metadata: {
        type: DataTypes.JSONB,
        defaultValue: {}
    }
}, {
    tableName: 'honeytokens',
    timestamps: true
});

module.exports = Honeytoken;
