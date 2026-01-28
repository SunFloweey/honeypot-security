const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const Log = require('./Log');

const Classification = sequelize.define('Classification', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    logId: {
        type: DataTypes.UUID,
        field: 'log_id',
        references: {
            model: Log,
            key: 'id'
        }
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
    timestamps: false
});

// Associations
Classification.belongsTo(Log, { foreignKey: 'logId' });
Log.hasMany(Classification, { foreignKey: 'logId' });

module.exports = Classification;

