/**
 * ApiKey Model - Chiavi API per Multi-Tenancy
 * 
 * Ogni utente può generare più chiavi API, una per ogni
 * progetto/sito che vuole monitorare (es. 'streetcats', 'blog').
 * I log vengono associati alla chiave API usata.
 */
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const crypto = require('crypto');

const ApiKey = sequelize.define('ApiKey', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    userId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: 'user_id',
        references: { model: 'users', key: 'id' }
    },
    key: {
        type: DataTypes.STRING(64),
        allowNull: false,
        unique: true
    },
    name: {
        type: DataTypes.STRING(100),
        allowNull: false,
        comment: 'Nome del progetto (es. streetcats, blog-personale)'
    },
    isActive: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        field: 'is_active'
    },
    lastUsedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'last_used_at'
    }
}, {
    tableName: 'api_keys',
    timestamps: true,
    underscored: true,
    hooks: {
        beforeValidate: (apiKey) => {
            if (!apiKey.key || apiKey.key.trim() === '') {
                // Genera chiave nel formato: hp_sk_<random_hex>
                apiKey.key = `hp_sk_${crypto.randomBytes(24).toString('hex')}`;
            }
        }
    }
});

/**
 * Genera una nuova chiave API per un utente.
 * @param {string} userId - ID dell'utente proprietario
 * @param {string} projectName - Nome del progetto
 * @returns {ApiKey} La chiave creata
 */
ApiKey.generateForUser = async function (userId, projectName) {
    return this.create({
        userId,
        name: projectName,
    });
};

ApiKey.associate = (models) => {
    ApiKey.belongsTo(models.User, { foreignKey: 'userId', as: 'owner' });
};

module.exports = ApiKey;
