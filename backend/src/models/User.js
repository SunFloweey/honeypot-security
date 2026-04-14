/**
 * User Model - Multi-Tenancy SaaS
 * 
 * Rappresenta un utente/tenant della piattaforma.
 * Ogni utente può generare le proprie API Key e
 * visualizzare solo i propri log nella dashboard.
 */
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const bcrypt = require('bcryptjs');

const User = sequelize.define('User', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    email: {
        type: DataTypes.STRING(255),
        allowNull: false,
        unique: true,
        validate: { isEmail: true }
    },
    password: {
        type: DataTypes.STRING(255),
        allowNull: false
    },
    name: {
        type: DataTypes.STRING(100),
        allowNull: false
    },
    role: {
        type: DataTypes.ENUM('admin', 'user'),
        defaultValue: 'user'
    },
    isActive: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        field: 'is_active'
    },
    phoneNumber: {
        type: DataTypes.STRING(20),
        allowNull: true,
        field: 'phone_number'
    }
}, {
    tableName: 'users',
    timestamps: true,
    underscored: true,
    hooks: {
        beforeCreate: async (user) => {
            if (user.password) {
                user.password = await bcrypt.hash(user.password, 12);
            }
        },
        beforeUpdate: async (user) => {
            if (user.changed('password')) {
                user.password = await bcrypt.hash(user.password, 12);
            }
        }
    }
});

/**
 * Verifica se la password fornita corrisponde a quella hashata.
 */
User.prototype.verifyPassword = async function (plainPassword) {
    return bcrypt.compare(plainPassword, this.password);
};

User.associate = (models) => {
    User.hasMany(models.ApiKey, { foreignKey: 'userId', as: 'apiKeys' });
};

module.exports = User;
