const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const Log = require('./Log');

const Classification = sequelize.define('Classification', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    log_id: {
        type: DataTypes.UUID,
        references: {
            model: Log,
            key: 'id'
        }
    },
    category: {
        type: DataTypes.STRING(50)
    },
    risk_score: {
        type: DataTypes.INTEGER
    },
    pattern_matched: {
        type: DataTypes.TEXT
    }
}, {
    tableName: 'classifications',
    timestamps: false
});

// Associations
Classification.belongsTo(Log, { foreignKey: 'log_id' });
Log.hasMany(Classification, { foreignKey: 'log_id' });

module.exports = Classification;
