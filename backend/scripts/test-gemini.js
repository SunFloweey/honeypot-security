const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config();

async function testGemini() {
    const key = process.env.GEMINI_KEY;
    if (!key) {
        console.error("❌ No GEMINI_KEY found in .env");
        return;
    }

    const genAI = new GoogleGenerativeAI(key);

    try {
        console.log("🔍 Testing gemini-1.5-flash...");
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const result = await model.generateContent("Test");
        console.log("✅ gemini-1.5-flash works!");
    } catch (e) {
        console.error("❌ gemini-1.5-flash failed:", e.message);

        try {
            console.log("🔍 Testing gemini-pro...");
            const modelPro = genAI.getGenerativeModel({ model: "gemini-pro" });
            const resultPro = await modelPro.generateContent("Test");
            console.log("✅ gemini-pro works!");
        } catch (e2) {
            console.error("❌ gemini-pro failed:", e2.message);
        }
    }
}

testGemini();
