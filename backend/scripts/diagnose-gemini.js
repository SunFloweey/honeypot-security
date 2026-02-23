const { GoogleGenerativeAI } = require("@google/generative-ai");
const axios = require('axios');
require('dotenv').config();

async function diagnose() {
    const key = process.env.GEMINI_KEY;
    if (!key) {
        console.error("❌ No GEMINI_KEY");
        return;
    }

    console.log("--- 1. Listing Models via REST (v1beta) ---");
    try {
        const res = await axios.get(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
        const models = res.data.models.map(m => m.name.replace('models/', ''));
        console.log("Available (v1beta):", models.join(', '));
    } catch (e) {
        console.error("REST v1beta failed:", e.message);
    }

    console.log("\n--- 2. Listing Models via REST (v1) ---");
    try {
        const res = await axios.get(`https://generativelanguage.googleapis.com/v1/models?key=${key}`);
        const models = res.data.models.map(m => m.name.replace('models/', ''));
        console.log("Available (v1):", models.join(', '));
    } catch (e) {
        console.error("REST v1 failed:", e.message);
    }

    console.log("\n--- 3. Testing with SDK (default) ---");
    const genAI = new GoogleGenerativeAI(key);
    const testModels = ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-2.0-flash'];

    for (const mName of testModels) {
        try {
            console.log(`Testing ${mName}...`);
            const model = genAI.getGenerativeModel({ model: mName });
            const result = await model.generateContent("Say 'OK'");
            console.log(`✅ ${mName} works! Response: ${result.response.text()}`);
        } catch (e) {
            console.error(`❌ ${mName} failed: ${e.message}`);
        }
    }
}

diagnose();
