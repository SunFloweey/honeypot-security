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
    },
    apiKeyId: {
        type: DataTypes.UUID,
        allowNull: true,
        field: 'api_key_id',
        references: { model: 'api_keys', key: 'id' }
    }
}, {
    tableName: 'honeytokens',
    timestamps: true
});

Honeytoken.associate = (models) => {
    Honeytoken.belongsTo(models.ApiKey, { foreignKey: 'apiKeyId', as: 'apiKey' });
};

module.exports = Honeytoken;
