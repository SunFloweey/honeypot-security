const axios = require('axios');

/**
 * HoneypotClient - Node.js SDK for the Honeypot Security System
 */
class HoneypotClient {
    /**
     * @param {Object} options
     * @param {string} options.apiKey - Use your ADMIN_TOKEN
     * @param {string} options.baseUrl - The URL of your honeypot server
     * @param {string} [options.appName] - Name of the application (e.g., 'streetcats')
     */
    constructor({ apiKey, baseUrl, appName = 'ExternalApp' }) {
        if (!apiKey) throw new Error('Honeypot SDK error: apiKey is required');
        if (!baseUrl) throw new Error('Honeypot SDK error: baseUrl is required');

        this.apiKey = apiKey;
        this.appName = appName;
        this.baseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;

        this.client = axios.create({
            baseURL: `${this.baseUrl}/api/v1/sdk`,
            headers: {
                'x-api-key': this.apiKey,
                'Content-Type': 'application/json',
                'X-App-Name': this.appName
            }
        });
    }

    /**
     * Track a custom security event
     * @param {string} event - Name of the event (e.g., 'unauthorized_access_attempt')
     * @param {Object} metadata - Additional info about the event
     * @param {string} [ipAddress] - Optional source IP
     */
    async trackEvent(event, metadata = {}, ipAddress = null) {
        try {
            const response = await this.client.post('/logs', {
                event,
                metadata,
                ipAddress
            });
            return response.data;
        } catch (error) {
            console.error('Honeypot SDK Log Error:', error.response?.data || error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * Request a new honeytoken from the honeypot
     * @param {string} type - Type of token (aws, mongo, stripe, jwt, env)
     */
    async generateToken(type = 'env') {
        try {
            const response = await this.client.get('/honeytoken', {
                params: { type }
            });
            return response.data;
        } catch (error) {
            console.error('Honeypot SDK Token Error:', error.response?.data || error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * Analyze a suspicious payload using the Honeypot AI
     * @param {string} payload - The content to analyze
     */
    async analyzePayload(payload) {
        try {
            const response = await this.client.post('/analyze', { payload });
            return response.data;
        } catch (error) {
            console.error('Honeypot SDK Analysis Error:', error.response?.data || error.message);
            return { success: false, error: error.message };
        }
    }
}

module.exports = HoneypotClient;
