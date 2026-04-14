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
const DianaDaemon = require('./lib/Daemon');

// Create a default instance (Singleton) for easier programmatic use
const defaultInstance = new DianaClient();

/**
 * Factory to create a new DIANA client instance.
 * @param {Object} config - Configuration object
 * @returns {DianaClient}
 */
const createClient = (config) => new DianaClient(config);

/**
 * Factory to create a new DIANA daemon instance.
 * @param {Object} config - Configuration object
 * @returns {DianaDaemon}
 */
const createDaemon = (config) => new DianaDaemon(config);

/**
 * Factory to create a middleware for specific frameworks.
 */
const createMiddleware = (framework = 'express', config = {}) => {
    const client = config ? new DianaClient(config) : defaultInstance;
    if (framework === 'express') return client.monitor();
    throw new Error(`Framework "${framework}" is not yet supported.`);
};

// Main Export
module.exports = {
    DianaClient,
    DianaDaemon,
    createClient,
    createDaemon,
    createMiddleware,
    
    // Auto-initialized instance methods for direct access
    // This allows: require('@diana-security/sdk').log('...')
    monitor: (...args) => defaultInstance.monitor(...args),
    log: (...args) => defaultInstance.log(...args),
    info: (...args) => defaultInstance.info(...args),
    warn: (...args) => defaultInstance.warn(...args),
    error: (...args) => defaultInstance.error(...args),
    trackEvent: (...args) => defaultInstance.trackEvent(...args),
    triggerEvacuation: (...args) => defaultInstance.triggerEvacuation(...args)
};
