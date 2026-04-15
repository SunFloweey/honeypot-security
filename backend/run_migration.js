#!/usr/bin/env node

const { sequelize } = require('./src/config/database');

async function runMigration() {
    try {
        console.log('Connecting to database...');
        await sequelize.authenticate();
        console.log('Database connection successful.');

        console.log('Starting case-sensitive column migration...');
        
        // Start transaction
        const transaction = await sequelize.transaction();
        
        try {
            // honeytokens table
            console.log('Migrating honeytokens table...');
            await sequelize.query(`
                ALTER TABLE honeytokens RENAME COLUMN "tokenValue" TO token_value
            `, { transaction });
            await sequelize.query(`
                ALTER TABLE honeytokens RENAME COLUMN "tokenType" TO token_type
            `, { transaction });
            await sequelize.query(`
                ALTER TABLE honeytokens RENAME COLUMN "createdAt" TO created_at
            `, { transaction });
            await sequelize.query(`
                ALTER TABLE honeytokens RENAME COLUMN "updatedAt" TO updated_at
            `, { transaction });

            // honeytoken_usage table
            console.log('Migrating honeytoken_usage table...');
            await sequelize.query(`
                ALTER TABLE honeytoken_usage RENAME COLUMN "tokenValue" TO token_value
            `, { transaction });
            await sequelize.query(`
                ALTER TABLE honeytoken_usage RENAME COLUMN "ipAddress" TO ip_address
            `, { transaction });
            await sequelize.query(`
                ALTER TABLE honeytoken_usage RENAME COLUMN "userAgent" TO user_agent
            `, { transaction });
            await sequelize.query(`
                ALTER TABLE honeytoken_usage RENAME COLUMN "requestPath" TO request_path
            `, { transaction });
            await sequelize.query(`
                ALTER TABLE honeytoken_usage RENAME COLUMN "sessionKey" TO session_key
            `, { transaction });
            await sequelize.query(`
                ALTER TABLE honeytoken_usage RENAME COLUMN "detectionContext" TO detection_context
            `, { transaction });
            await sequelize.query(`
                ALTER TABLE honeytoken_usage RENAME COLUMN "createdAt" TO created_at
            `, { transaction });
            await sequelize.query(`
                ALTER TABLE honeytoken_usage RENAME COLUMN "updatedAt" TO updated_at
            `, { transaction });

            // terminal_commands table
            console.log('Migrating terminal_commands table...');
            await sequelize.query(`
                ALTER TABLE terminal_commands RENAME COLUMN "sessionKey" TO session_key
            `, { transaction });
            await sequelize.query(`
                ALTER TABLE terminal_commands RENAME COLUMN "exitCode" TO exit_code
            `, { transaction });

            // virtual_shell_sessions table
            console.log('Migrating virtual_shell_sessions table...');
            await sequelize.query(`
                ALTER TABLE virtual_shell_sessions RENAME COLUMN "sessionKey" TO session_key
            `, { transaction });
            await sequelize.query(`
                ALTER TABLE virtual_shell_sessions RENAME COLUMN "entryVector" TO entry_vector
            `, { transaction });
            await sequelize.query(`
                ALTER TABLE virtual_shell_sessions RENAME COLUMN "commandCount" TO command_count
            `, { transaction });
            await sequelize.query(`
                ALTER TABLE virtual_shell_sessions RENAME COLUMN "lastActivity" TO last_activity
            `, { transaction });
            await sequelize.query(`
                ALTER TABLE virtual_shell_sessions RENAME COLUMN "userId" TO user_id
            `, { transaction });
            await sequelize.query(`
                ALTER TABLE virtual_shell_sessions RENAME COLUMN "apiKeyId" TO api_key_id
            `, { transaction });
            await sequelize.query(`
                ALTER TABLE virtual_shell_sessions RENAME COLUMN "createdAt" TO created_at
            `, { transaction });
            await sequelize.query(`
                ALTER TABLE virtual_shell_sessions RENAME COLUMN "updatedAt" TO updated_at
            `, { transaction });

            // Commit transaction
            await transaction.commit();
            console.log('Migration completed successfully!');

        } catch (error) {
            await transaction.rollback();
            throw error;
        }

    } catch (error) {
        console.error('Migration failed:', error.message);
        process.exit(1);
    } finally {
        await sequelize.close();
    }
}

runMigration();
