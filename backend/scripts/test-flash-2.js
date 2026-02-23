const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config();

async function test() {
    const key = process.env.GEMINI_KEY;
    const modelName = "gemini-2.0-flash";
    console.log(`🔍 Testing ${modelName}...`);
    const genAI = new GoogleGenerativeAI(key);
    const model = genAI.getGenerativeModel({ model: modelName });

    try {
        const result = await model.generateContent("Hello?");
        console.log(`✅ ${modelName} works!`);
        console.log("Response:", result.response.text());
    } catch (e) {
        console.error(`❌ ${modelName} failed:`, e.message);
        if (e.response) {
            console.error("Details:", JSON.stringify(e.response.data, null, 2));
        }
    }
}

test();
