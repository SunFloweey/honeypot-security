const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const TerminalCommand = sequelize.define('TerminalCommand', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    sessionKey: {
        type: DataTypes.STRING,
        allowNull: false
    },
    command: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    output: {
        type: DataTypes.TEXT
    },
    cwd: {
        type: DataTypes.STRING
    },
    user: {
        type: DataTypes.STRING
    },
    exitCode: {
        type: DataTypes.INTEGER
    },
    timestamp: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    }
}, {
    tableName: 'terminal_commands',
    timestamps: false
});

TerminalCommand.associate = (models) => {
    TerminalCommand.belongsTo(models.VirtualShellSession, { foreignKey: 'sessionKey', targetKey: 'sessionKey' });
};

module.exports = TerminalCommand;
