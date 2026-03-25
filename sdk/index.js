/**
 * @diana-security/sdk
 * 
 * DIANA - Deceptive Infrastructure & Active Network Armor
 * 
 * Usage:
 *   const diana = require('@diana-security/sdk');
 * 
 *   // Auto-configured from environment variables (DIANA_API_KEY, DIANA_BASE_URL)
 *   const client = diana.createClient();
 * 
 *   // Or with explicit config
 *   const client = diana.createClient({
 *       apiKey: 'hp_sk_...',
 *       baseUrl: 'https://your-diana-server.com',
 *       appName: 'MyApp'
 *   });
 * 
 *   // Express middleware
 *   app.use(client.monitor());
 * 
 *   // Track events
 *   await client.trackEvent('LOGIN_ATTEMPT', { user: 'admin', ip: '1.2.3.4' });
 */

const DianaClient = require('./lib/DianaClient');
const middleware = require('./lib/middleware');

/**
 * Create a new DIANA client instance.
 * Reads configuration from environment variables if not provided:
 *   - DIANA_API_KEY (required)
 *   - DIANA_BASE_URL (required)
 *   - DIANA_APP_NAME (optional, default: 'DianaApp')
 * 
 * @param {Object} [config] - Configuration object
 * @param {string} [config.apiKey] - API key or JWT token for authentication
 * @param {string} [config.baseUrl] - Base URL of the DIANA server
 * @param {string} [config.appName] - Application name
 * @param {Object} [config.options] - Security options
 * @returns {DianaClient}
 */
function createClient(config = {}) {
    return new DianaClient(config);
}

module.exports = {
    createClient,
    DianaClient,
    expressMiddleware: middleware.expressMiddleware,
    fastifyPlugin: middleware.fastifyPlugin,
    koaMiddleware: middleware.koaMiddleware,
};
