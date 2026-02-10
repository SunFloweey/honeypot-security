'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        // Aggiungi colonna risk_score alla tabella logs
        await queryInterface.addColumn('logs', 'risk_score', {
            type: Sequelize.INTEGER,
            defaultValue: 0,
            allowNull: true
        });

        // Aggiungi indice per performance nei filtri
        await queryInterface.addIndex('logs', ['risk_score'], {
            name: 'logs_risk_score_idx'
        });
    },

    async down(queryInterface, Sequelize) {
        await queryInterface.removeIndex('logs', 'logs_risk_score_idx');
        await queryInterface.removeColumn('logs', 'risk_score');
    }
};
