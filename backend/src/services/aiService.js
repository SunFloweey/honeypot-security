const { model } = require('../config/gemini');

class AIService {
    static async ask(prompt) {
        try {
            const result = await model.generateContent(prompt);
            return result.response.text();
        } catch (error) {
            console.error("Errore AI Service:", error);
            throw new Error("Fallimento nella generazione del contenuto");
        }
    }
}

module.exports = AIService;