// services/AIService.js
require('dotenv').config();
const { openai, modelName: openAiModel } = require('../config/openai');
const { geminiModel, geminiTextModel } = require('../config/gemini');
const prompts = require('../config/prompts');
const PayloadDecoder = require('./payloadDecoder');

class AIService {
    static cbState = 'CLOSED';
    static consecutiveFailures = 0;
    static lastFailureTime = 0;
    static BREAKER_TIMEOUT = 60000; // 1 minute retry
    static FAILURE_THRESHOLD = 5;

    static lastThreatSynthesis = null;
    static lastSynthesisTime = 0;
    static SYNTHESIS_COOLDOWN = 60000;

    static _isCircuitClosed() {
        const now = Date.now();
        if (this.cbState === 'OPEN') {
            if (now - this.lastFailureTime > this.BREAKER_TIMEOUT) {
                console.log('🔄 [AIService] Circuit Breaker: HALF_OPEN (Retrying...)');
                this.cbState = 'HALF_OPEN';
                return true;
            }
            return false;
        }
        return true;
    }

    /**
     * Core method: Tries OpenAI first (Primary), fallbacks to Gemini
     */
    static async _generateContent(prompt) {
        if (!this._isCircuitClosed()) {
            console.warn('🛑 [AIService] Request blocked by Circuit Breaker');
            return null;
        }

        try {
            console.log(`🤖 [AIService] Calling AI (JSON mode, State: ${this.cbState})...`);
            const response = await openai.chat.completions.create({
                model: openAiModel,
                messages: [{ role: "user", content: prompt }],
                response_format: { type: "json_object" },
            });

            this.consecutiveFailures = 0;
            this.cbState = 'CLOSED';
            return JSON.parse(response.choices[0].message.content);

        } catch (openAiError) {
            console.warn(`⚠️ [OpenAI] Failed: ${openAiError.message}. Trying Gemini fallback...`);

            try {
                const result = await geminiModel.generateContent(prompt);
                const response = await result.response;
                const text = response.text();
                const cleanJson = text.replace(/```json|```/g, '').trim();

                this.consecutiveFailures = 0;
                this.cbState = 'CLOSED';
                return JSON.parse(cleanJson);
            } catch (geminiError) {
                console.error("❌ Both AI Services (OpenAI & Gemini) failed.");
                this.consecutiveFailures++;
                if (this.consecutiveFailures >= this.FAILURE_THRESHOLD) {
                    console.error('🚨 [AIService] CIRCUIT BREAKER OPENED!');
                    this.cbState = 'OPEN';
                    this.lastFailureTime = Date.now();
                }
                return null;
            }
        }
    }

    /**
     * Text-only generation (Shell output, fake files)
     */
    static async _generateText(prompt) {
        if (!this._isCircuitClosed()) return "bash: service temporarily unavailable";

        try {
            const response = await openai.chat.completions.create({
                model: openAiModel,
                messages: [{ role: "user", content: prompt }],
            });
            this.cbState = 'CLOSED';
            return response.choices[0].message.content.trim();
        } catch (e) {
            try {
                const result = await geminiTextModel.generateContent(prompt);
                this.cbState = 'CLOSED';
                return result.response.text().trim();
            } catch (err) {
                this.consecutiveFailures++;
                return "bash: command execution failed";
            }
        }
    }

    static async analyzeSession(session) {
        const recentLogs = session.Logs ? session.Logs.slice(-50) : [];
        const logsText = recentLogs.map(log =>
            `[${log.method}] ${log.path} - Body: ${log.body || ''}`
        ).join('\n');

        const prompt = prompts.SESSION_ANALYSIS(session.ipAddress, session.userAgent, logsText);
        return await this._generateContent(prompt);
    }

    static async analyzePayload(rawPayload) {
        if (!rawPayload || rawPayload.length < 10) return null;
        const localAnalysis = PayloadDecoder.decode(rawPayload);

        const prompt = prompts.DECODE_PAYLOAD(rawPayload, localAnalysis);
        const aiResult = await this._generateContent(prompt);

        return aiResult || localAnalysis;
    }

    static async summarizeRecentActivity(logs) {
        const now = Date.now();
        if (this.lastThreatSynthesis && (now - this.lastSynthesisTime < this.SYNTHESIS_COOLDOWN)) {
            return this.lastThreatSynthesis;
        }

        const logsText = logs.slice(-50).map(log => `[IP: ${log.ipAddress}][SESS: ${log.sessionKey}] ${log.method} ${log.path}`).join('\n');
        const prompt = prompts.THREAT_SYNTHESIS(logsText);

        const result = await this._generateContent(prompt);
        if (result) {
            // Normalizzazione per Smart Alert UI
            const lastLog = logs.length > 0 ? logs[logs.length - 1] : {};

            result.type = 'THREAT_SYNTHESIS';
            result.ipAddress = result.heuristic?.primaryIp || result.primaryIp || lastLog.ipAddress;
            result.sessionKey = result.sessionKey || result.primarySession || lastLog.sessionKey;

            // Garantiamo la struttura per il frontend
            if (!result.heuristic) result.heuristic = { primaryIp: result.ipAddress, riskScore: 50 };
            if (!result.the_brain) result.the_brain = { analysis: "Analisi in corso...", actorType: "Unknown" };
            if (!result.response) result.response = { severity: "Medium" };

            this.lastThreatSynthesis = result;
            this.lastSynthesisTime = now;
        }
        return result;
    }

    static async getDeceptiveResponse(req) {
        try {
            const prompt = prompts.ADAPTIVE_DECEPTION(req.method, req.path, req.query, req.body);
            console.log(`🤖 [Deception IA] Richiesta generazione per: ${req.path}`);
            
            const result = await this._generateContent(prompt);
            
            if (!result) {
                console.warn('⚠️ [Deception IA] L\'IA non ha restituito alcun dato. Fallback.');
                return null;
            }

            console.log('✅ [Deception IA] Risposta generata con successo.');
            return result;
        } catch (error) {
            console.error('❌ [Deception IA] Errore critico generazione:', error.message);
            return null;
        }
    }
}

module.exports = AIService;
