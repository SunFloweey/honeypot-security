/**
 * Sanitizer Utility for Admin Dashboard
 * Prevents XSS when displaying attacker-controlled data.
 */

/**
 * Escapes HTML special characters to prevent script execution
 * @param {string} str - The string to sanitize
 * @returns {string} Sanitized string
 */
export const sanitizeHTML = (str) => {
    if (typeof str !== 'string') return String(str || '');

    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
};

/**
 * Safely parses and sanitizes a JSON string or object
 * @param {any} data - The data to sanitize
 * @returns {any} Sanitized data
 */
export const sanitizeData = (data) => {
    if (data === null || data === undefined) return data;

    if (Array.isArray(data)) {
        return data.map(item => sanitizeData(item));
    }

    if (typeof data === 'object') {
        const sanitized = {};
        for (const [key, value] of Object.entries(data)) {
            sanitized[key] = sanitizeData(value);
        }
        return sanitized;
    }

    if (typeof data === 'string') {
        return sanitizeHTML(data);
    }

    return data;
};
