const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_KEY || "");
const modelName = process.env.GEMINI_MODEL || "gemini-1.5-flash";

const geminiModel = genAI.getGenerativeModel({ 
    model: modelName,
    generationConfig: {
        responseMimeType: "application/json"
    }
});

// Modello per testo libero (shell, file finti)
const geminiTextModel = genAI.getGenerativeModel({ model: modelName });

console.log(`♊ Configurazione IA (Gemini): Model=${modelName}`);

module.exports = {
    genAI,
    geminiModel,
    geminiTextModel
};
