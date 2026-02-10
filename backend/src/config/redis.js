const { createClient } = require('redis');

/**
 * Redis Client Configuration
 * Provides a centralized client for distributed storage.
 */

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const STORAGE_TYPE = process.env.STORAGE_TYPE || 'memory';

let client = null;

if (STORAGE_TYPE === 'redis') {
    client = createClient({
        url: REDIS_URL
    });

    client.on('error', (err) => console.error('❌ Redis Client Error', err));
    client.on('connect', () => console.log('✅ Redis Client: Connected'));
    client.on('reconnecting', () => console.warn('⚠️ Redis Client: Reconnecting...'));

    // Handle initialization
    (async () => {
        try {
            await client.connect();
        } catch (err) {
            console.error('❌ Redis Connection Failed. Falling back to in-memory state for this session.', err);
        }
    })();
}

module.exports = client;
