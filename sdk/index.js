/**
 * @diana-security/sdk
 * 
 * DIANA - Deceptive Infrastructure & Active Network Armor
 * 
 * Usage:
 *   const { createClient, createMiddleware } = require('@diana-security/sdk');
 * 
 *   // 1. Create a client directly
 *   const diana = createClient();
 *   app.use(diana.monitor());
 * 
 *   // 2. Or use the middleware factory shorthand
 *   const shield = createMiddleware('express');
 *   app.use(shield);
 */

const DianaClient = require('./lib/DianaClient');

/**
 * Factory to create a new DIANA client instance.
 * @param {Object} config - Configuration object
 * @returns {DianaClient}
 */
const createClient = (config) => new DianaClient(config);

/**
 * Factory to create a middleware for specific frameworks.
 * @param {string} framework - 'express' | 'koa' | 'fastify' (currently express)
 * @param {Object} config - Client configuration
 * @returns {Function} Middleware function
 */
const createMiddleware = (framework = 'express', config = {}) => {
    const client = new DianaClient(config);
    if (framework === 'express') return client.monitor();
    
    // Support for future frameworks can be added here
    throw new Error(`Framework "${framework}" is not yet supported by DIANA SDK.`);
};

module.exports = {
    DianaClient,
    createClient,
    createMiddleware,
    // For backward compatibility with some versions
    createClientInstance: createClient
};
