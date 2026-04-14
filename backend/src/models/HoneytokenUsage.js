const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const HoneytokenUsage = sequelize.define('HoneytokenUsage', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    tokenValue: {
        type: DataTypes.STRING,
        allowNull: false
    },
    ipAddress: {
        type: DataTypes.STRING
    },
    userAgent: {
        type: DataTypes.TEXT
    },
    requestPath: {
        type: DataTypes.TEXT
    },
    sessionKey: {
        type: DataTypes.STRING
    },
    detectionContext: {
        type: DataTypes.JSONB,
        defaultValue: {}
    }
}, {
    tableName: 'honeytoken_usage',
    timestamps: true
});

HoneytokenUsage.associate = (models) => {
    // Note: sessionKey here might be null if not tracked via cookie
    HoneytokenUsage.belongsTo(models.Session, { foreignKey: 'sessionKey', targetKey: 'sessionKey', constraints: false });
};

module.exports = HoneytokenUsage;
