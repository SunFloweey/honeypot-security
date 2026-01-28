const crypto = require('crypto');

/**
 * Utility for performing timing-safe token comparisons.
 */
class AuthHelper {
    /**
     * Compare two tokens in constant time to prevent side-channel attacks.
     * @param {string} provided - The token provided in the request
     * @param {string} required - The secret token to compare against
     * @returns {boolean} True if they match, false otherwise
     */
    static isTokenValid(provided, required) {
        if (!provided || !required) return false;

        const providedBuffer = Buffer.from(provided);
        const requiredBuffer = Buffer.from(required);

        // Buffers must be of the same length for timingSafeEqual
        if (providedBuffer.length !== requiredBuffer.length) {
            return false;
        }

        return crypto.timingSafeEqual(providedBuffer, requiredBuffer);
    }
}

module.exports = AuthHelper;
