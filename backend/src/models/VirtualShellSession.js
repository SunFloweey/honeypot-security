const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const VirtualShellSession = sequelize.define('VirtualShellSession', {
    sessionKey: {
        type: DataTypes.STRING,
        primaryKey: true
    },
    persona: {
        type: DataTypes.STRING,
        allowNull: false
    },
    user: {
        type: DataTypes.STRING
    },
    hostname: {
        type: DataTypes.STRING
    },
    cwd: {
        type: DataTypes.STRING
    },
    entryVector: {
        type: DataTypes.STRING
    },
    commandCount: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    environment: {
        type: DataTypes.JSONB,
        defaultValue: {}
    },
    lastActivity: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    }
}, {
    tableName: 'virtual_shell_sessions',
    timestamps: true
});

VirtualShellSession.associate = (models) => {
    VirtualShellSession.hasMany(models.TerminalCommand, { foreignKey: 'sessionKey', sourceKey: 'sessionKey' });
};

module.exports = VirtualShellSession;
