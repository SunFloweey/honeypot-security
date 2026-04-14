const axios = require('axios');
require('dotenv').config();

async function listModelsREST() {
    const key = process.env.GEMINI_KEY;
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`;

    try {
        console.log("Fetching models via REST...");
        const response = await axios.get(url);
        console.log("Models found:");
        response.data.models.forEach(m => {
            console.log(`- ${m.name} (${m.displayName})`);
            console.log(`  Supported methods: ${m.supportedGenerationMethods.join(', ')}`);
        });
    } catch (error) {
        console.error("REST Error:", error.response ? error.response.data : error.message);
    }
}

listModelsREST();
