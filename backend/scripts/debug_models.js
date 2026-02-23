const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config();

async function listModels() {
    try {
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_KEY);
        // There isn't a direct 'listModels' in the simple SDK, but we can try a few common variants
        const models = ['gemini-1.5-flash', 'gemini-1.5-flash-8b', 'gemini-1.5-pro', 'gemini-1.0-pro'];

        console.log("Checking model availability...");
        for (const modelName of models) {
            try {
                const model = genAI.getGenerativeModel({ model: modelName });
                const result = await model.generateContent("test");
                if (result.response) {
                    console.log(`✅ [${modelName}] is AVAILABLE and WORKING.`);
                }
            } catch (e) {
                console.log(`❌ [${modelName}] failed: ${e.message}`);
            }
        }
    } catch (error) {
        console.error("Fatal error:", error);
    }
}

listModels();
