-- Migration script to fix case sensitivity issues on Linux
-- Converting column names from camelCase to snake_case

-- honeytokens table
ALTER TABLE honeytokens RENAME COLUMN "tokenValue" TO token_value;
ALTER TABLE honeytokens RENAME COLUMN "tokenType" TO token_type;
ALTER TABLE honeytokens RENAME COLUMN "createdAt" TO created_at;
ALTER TABLE honeytokens RENAME COLUMN "updatedAt" TO updated_at;

-- honeytoken_usage table
ALTER TABLE honeytoken_usage RENAME COLUMN "tokenValue" TO token_value;
ALTER TABLE honeytoken_usage RENAME COLUMN "ipAddress" TO ip_address;
ALTER TABLE honeytoken_usage RENAME COLUMN "userAgent" TO user_agent;
ALTER TABLE honeytoken_usage RENAME COLUMN "requestPath" TO request_path;
ALTER TABLE honeytoken_usage RENAME COLUMN "sessionKey" TO session_key;
ALTER TABLE honeytoken_usage RENAME COLUMN "detectionContext" TO detection_context;
ALTER TABLE honeytoken_usage RENAME COLUMN "createdAt" TO created_at;
ALTER TABLE honeytoken_usage RENAME COLUMN "updatedAt" TO updated_at;

-- terminal_commands table
ALTER TABLE terminal_commands RENAME COLUMN "sessionKey" TO session_key;
ALTER TABLE terminal_commands RENAME COLUMN "exitCode" TO exit_code;

-- virtual_shell_sessions table
ALTER TABLE virtual_shell_sessions RENAME COLUMN "sessionKey" TO session_key;
ALTER TABLE virtual_shell_sessions RENAME COLUMN "entryVector" TO entry_vector;
ALTER TABLE virtual_shell_sessions RENAME COLUMN "commandCount" TO command_count;
ALTER TABLE virtual_shell_sessions RENAME COLUMN "lastActivity" TO last_activity;
ALTER TABLE virtual_shell_sessions RENAME COLUMN "userId" TO user_id;
ALTER TABLE virtual_shell_sessions RENAME COLUMN "apiKeyId" TO api_key_id;
ALTER TABLE virtual_shell_sessions RENAME COLUMN "createdAt" TO created_at;
ALTER TABLE virtual_shell_sessions RENAME COLUMN "updatedAt" TO updated_at;
