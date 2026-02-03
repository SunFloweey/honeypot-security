'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        // 1. Create SESSIONS table
        await queryInterface.createTable('sessions', {
            session_key: {
                type: Sequelize.STRING(32),
                primaryKey: true,
                allowNull: false
            },
            ip_address: {
                type: Sequelize.INET,
                allowNull: false
            },
            user_agent: {
                type: Sequelize.TEXT,
                allowNull: true
            },
            first_seen: {
                type: Sequelize.DATE,
                defaultValue: Sequelize.fn('NOW')
            },
            last_seen: {
                type: Sequelize.DATE,
                defaultValue: Sequelize.fn('NOW')
            },
            request_count: {
                type: Sequelize.INTEGER,
                defaultValue: 1
            },
            max_risk_score: {
                type: Sequelize.INTEGER,
                defaultValue: 0
            },
            screen_resolution: Sequelize.STRING,
            browser_language: Sequelize.STRING,
            timezone: Sequelize.STRING,
            platform: Sequelize.STRING
        });

        // 2. Create LOGS table
        await queryInterface.createTable('logs', {
            id: {
                type: Sequelize.UUID,
                defaultValue: Sequelize.UUIDV4,
                primaryKey: true,
                allowNull: false
            },
            session_key: {
                type: Sequelize.STRING(32),
                references: {
                    model: 'sessions',
                    key: 'session_key'
                },
                onUpdate: 'CASCADE',
                onDelete: 'SET NULL',
                allowNull: true
            },
            timestamp: {
                type: Sequelize.DATE,
                defaultValue: Sequelize.fn('NOW')
            },
            method: Sequelize.STRING(10),
            path: Sequelize.TEXT,
            query_params: Sequelize.JSONB,
            headers: Sequelize.JSONB,
            body: Sequelize.TEXT,
            ip_address: Sequelize.INET,
            status_code: Sequelize.INTEGER,
            response_time_ms: Sequelize.INTEGER,
            response_body: Sequelize.TEXT
        });

        // 3. Create CLASSIFICATIONS table
        await queryInterface.createTable('classifications', {
            id: {
                type: Sequelize.INTEGER,
                primaryKey: true,
                autoIncrement: true,
                allowNull: false
            },
            log_id: {
                type: Sequelize.UUID,
                references: {
                    model: 'logs',
                    key: 'id'
                },
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE',
                allowNull: false
            },
            category: Sequelize.STRING(50),
            risk_score: Sequelize.INTEGER,
            pattern_matched: Sequelize.TEXT
        });

        // 4. Create INDEXES for performance
        await queryInterface.addIndex('sessions', ['ip_address']);
        await queryInterface.addIndex('sessions', ['last_seen']);

        await queryInterface.addIndex('logs', ['session_key']);
        await queryInterface.addIndex('logs', ['timestamp']);
        await queryInterface.addIndex('logs', ['ip_address']);

        await queryInterface.addIndex('classifications', ['log_id']);
        await queryInterface.addIndex('classifications', ['category']);
    },

    async down(queryInterface, Sequelize) {
        await queryInterface.dropTable('classifications');
        await queryInterface.dropTable('logs');
        await queryInterface.dropTable('sessions');
    }
};
