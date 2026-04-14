const axios = require('axios');
require('dotenv').config();

const ADMIN_PORT = process.env.ADMIN_PORT || 4003;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'PasswordSuperSegreta';
const BASE_URL = `http://localhost:${ADMIN_PORT}/api`;

async function verifyAI() {
    try {
        console.log('🔍 1. Fetching latest logs to find a session...');
        const logsRes = await axios.get(`${BASE_URL}/logs?limit=5`, {
            headers: { 'x-admin-token': ADMIN_TOKEN }
        });

        if (!logsRes.data.rows || logsRes.data.rows.length === 0) {
            console.error('❌ No logs found. Generate some traffic first!');
            return;
        }

        const sessionKey = logsRes.data.rows[0].sessionKey;
        if (!sessionKey) {
            console.error('❌ Latest log has no sessionKey.');
            return;
        }
        console.log(`✅ Found Session Key: ${sessionKey}`);

        console.log('🧠 2. Requesting AI Analysis...');
        const aiRes = await axios.post(`${BASE_URL}/ai/session`, {
            sessionKey: sessionKey
        }, {
            headers: { 'x-admin-token': ADMIN_TOKEN }
        });

        console.log('✅ AI Response Received:');
        console.log(JSON.stringify(aiRes.data, null, 2));

        if (aiRes.data.narrative && aiRes.data.riskScore !== undefined) {
            console.log('🎉 Verification SUCCESS: Narrative and Risk Score present.');
        } else {
            console.error('⚠️ Verification PARTIAL: Response format unexpected.');
        }

    } catch (error) {
        console.error('❌ Verification Failed:', error.message);
        if (error.response) {
            console.error('Response Data:', error.response.data);
        }
    }
}

verifyAI();
