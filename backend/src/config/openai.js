const { OpenAI } = require('openai');
require('dotenv').config();

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

const modelName = process.env.OPENAI_MODEL || "gpt-4o-mini";

console.log(`🤖 Configurazione IA (OpenAI): Model=${modelName}`);

module.exports = {
    openai,
    modelName
};
