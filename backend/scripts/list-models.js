const axios = require('axios');
require('dotenv').config();

async function listModels() {
    const key = process.env.GEMINI_KEY;
    if (!key) {
        console.error("❌ No GEMINI_KEY found in .env");
        return;
    }

    try {
        const response = await axios.get(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
        console.log("--- v1beta Models (EXACT) ---");
        response.data.models.forEach(m => {
            console.log(m.name);
        });
    } catch (e) {
        console.error("❌ Error fetching models:", e.response?.data?.error?.message || e.message);
    }
}

listModels();
