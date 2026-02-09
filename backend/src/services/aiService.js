const model = require('../../config/gemini');

class AIService {
    static async analyzeLog(logData) {
        const prompt = `Analizza questo log di sicurezza e restituisci un JSON con pericolosità (0-10) e categoria: ${JSON.stringify(logData)}`;
        const result = await model.generateContent(prompt);
        return result.response.text();
    }
}

module.exports = AIService;