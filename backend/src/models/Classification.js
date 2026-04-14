const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Classification = sequelize.define('Classification', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    logId: {
        type: DataTypes.UUID,
        field: 'log_id'
    },
    category: {
        type: DataTypes.STRING(50)
    },
    riskScore: {
        type: DataTypes.INTEGER,
        field: 'risk_score'
    },
    patternMatched: {
        type: DataTypes.TEXT,
        field: 'pattern_matched'
    }
}, {
    tableName: 'classifications',
    timestamps: false,
    indexes: [
        { fields: ['log_id'] },
        { fields: ['category'] }
    ]
});

Classification.associate = (models) => {
    Classification.belongsTo(models.Log, { foreignKey: 'logId' });
};

module.exports = Classification;
