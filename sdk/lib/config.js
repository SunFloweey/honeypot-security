/**
 * SDK Global Configuration
 * 
 * This file contains the default configuration for the DIANA SDK.
 * The server URL is stored in an encoded format to prevent simple 
 * plain-text discovery.
 */

const _ENCODED_URL = 'aHR0cDovL2xvY2FsaG9zdDo1MDAy'; // Base64 for http://localhost:5002

module.exports = {
    DEFAULT_BASE_URL: Buffer.from(_ENCODED_URL, 'base64').toString('utf8')
};
