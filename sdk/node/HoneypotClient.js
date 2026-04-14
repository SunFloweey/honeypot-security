/**
 * Backward compatibility wrapper.
 * The SDK has been restructured — use `@diana-security/sdk` instead.
 * 
 * This file re-exports DianaClient from the new location so that
 * existing code using `require('./sdk/node/HoneypotClient')` continues to work.
 */
const DianaClient = require('../lib/DianaClient');

module.exports = DianaClient;
