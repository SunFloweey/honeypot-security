/**
 * Framework-specific middleware factories for DIANA SDK
 * 
 * These are convenience wrappers that can be used independently:
 * 
 *   // Express
 *   const { expressMiddleware } = require('@diana-security/sdk');
 *   app.use(expressMiddleware({ apiKey: '...', baseUrl: '...' }));
 * 
 *   // Or more commonly, via the client:
 *   const diana = require('@diana-security/sdk').createClient();
 *   app.use(diana.monitor());
 */

const DianaClient = require('./DianaClient');

/**
 * Express middleware factory
 * Creates a DianaClient and returns its monitor middleware
 * 
 * @param {Object} config - DianaClient configuration
 * @returns {Function} Express middleware
 */
function expressMiddleware(config = {}) {
    const client = new DianaClient(config);

    const mw = client.monitor();

    // Attach the client instance to the middleware for direct access
    mw.diana = client;

    console.log(`🛡️  [DIANA] Express protection active for "${client.appName}"`);
    return mw;
}

/**
 * Fastify plugin factory
 * 
 * Usage:
 *   const { fastifyPlugin } = require('@diana-security/sdk');
 *   fastify.register(fastifyPlugin, { apiKey: '...', baseUrl: '...' });
 * 
 * @param {Object} fastify - Fastify instance
 * @param {Object} opts - DianaClient configuration
 * @param {Function} done - Callback
 */
function fastifyPlugin(fastify, opts, done) {
    const client = new DianaClient(opts);

    fastify.addHook('onRequest', async (request, reply) => {
        const reqPath = request.url;
        const ip = request.ip;

        // Bait path check
        if (client.options.baitPaths.includes(reqPath)) {
            client.trackEvent('BAIT_TOUCHED', { path: reqPath, ip }, ip).catch(() => {});
        }

        // Canary path check
        if (client.options.canaryPaths.includes(reqPath)) {
            client.trackEvent('CANARY_TOUCHED', { path: reqPath, method: request.method, ip }, ip).catch(() => {});
            reply.code(404).send('Not Found');
            return;
        }

        // Suspicious payload check
        const payload = JSON.stringify({ query: request.query, body: request.body });
        if (client._isSuspicious && client._isSuspicious(payload)) {
            client.trackEvent('SUSPICIOUS_PAYLOAD', { path: reqPath, payload, ip }, ip).catch(() => {});
        }
    });

    // Decorate fastify instance with diana client
    fastify.decorate('diana', client);

    console.log(`🛡️  [DIANA] Fastify plugin registered for "${client.appName}"`);
    done();
}

// Mark as a fastify plugin (compatible without fastify-plugin dependency)
fastifyPlugin[Symbol.for('skip-override')] = true;
fastifyPlugin[Symbol.for('fastify.display-name')] = 'diana-security';

/**
 * Koa middleware factory
 * 
 * Usage:
 *   const { koaMiddleware } = require('@diana-security/sdk');
 *   app.use(koaMiddleware({ apiKey: '...', baseUrl: '...' }));
 * 
 * @param {Object} config - DianaClient configuration
 * @returns {Function} Koa middleware
 */
function koaMiddleware(config = {}) {
    const client = new DianaClient(config);

    const mw = async (ctx, next) => {
        const reqPath = ctx.path;
        const ip = ctx.ip || ctx.request.ip;

        // Bait path check
        if (client.options.baitPaths.includes(reqPath)) {
            client.trackEvent('BAIT_TOUCHED', { path: reqPath, ip }, ip).catch(() => {});
        }

        // Canary path check
        if (client.options.canaryPaths.includes(reqPath)) {
            client.trackEvent('CANARY_TOUCHED', { path: reqPath, method: ctx.method, ip }, ip).catch(() => {});
            ctx.status = 404;
            ctx.body = 'Not Found';
            return;
        }

        // Suspicious payload check
        const payload = JSON.stringify({ query: ctx.query, body: ctx.request.body });
        if (client._isSuspicious && client._isSuspicious(payload)) {
            client.trackEvent('SUSPICIOUS_PAYLOAD', { path: reqPath, payload, ip }, ip).catch(() => {});
        }

        await next();
    };

    mw.diana = client;

    console.log(`🛡️  [DIANA] Koa protection active for "${client.appName}"`);
    return mw;
}

module.exports = {
    expressMiddleware,
    fastifyPlugin,
    koaMiddleware
};
