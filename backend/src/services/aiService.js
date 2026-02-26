// services/AIService.js
require('dotenv').config();
const { openai, modelName } = require('../config/openai');
const prompts = require('../config/prompts');
const PayloadDecoder = require('./payloadDecoder');

class AIService {
    // Circuit Breaker State
    static cbState = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    static consecutiveFailures = 0;
    static lastFailureTime = 0;
    static BREAKER_TIMEOUT = 300000; // 5 minutes
    static FAILURE_THRESHOLD = 3;

    // Caching properties for throttling
    static lastThreatSynthesis = null;
    static lastSynthesisTime = 0;
    static SYNTHESIS_COOLDOWN = 60000; // 60 seconds

    /**
     * Check if the circuit allows the request
     */
    static _isCircuitClosed() {
        if (this.cbState === 'OPEN') {
            const now = Date.now();
            if (now - this.lastFailureTime > this.BREAKER_TIMEOUT) {
                console.log('🔄 [CircuitBreaker] Timeout expired. Switching to HALF_OPEN.');
                this.cbState = 'HALF_OPEN';
                return true;
            }
            return false;
        }
        return true;
    }

    /**
     * Record success in the breaker
     */
    static _recordSuccess() {
        if (this.cbState !== 'CLOSED') {
            console.log('✅ [CircuitBreaker] Success detected. Closing circuit.');
            this.cbState = 'CLOSED';
            this.consecutiveFailures = 0;
        }
    }

    /**
     * Record failure in the breaker
     */
    static _recordFailure() {
        this.consecutiveFailures++;
        this.lastFailureTime = Date.now();
        console.warn(`⚠️ [CircuitBreaker] Failure ${this.consecutiveFailures}/${this.FAILURE_THRESHOLD}`);

        if (this.consecutiveFailures >= this.FAILURE_THRESHOLD) {
            console.error('🚨 [CircuitBreaker] Threshold reached. Opening circuit for 5 minutes.');
            this.cbState = 'OPEN';
        }
    }

    /**
     * Metodo core per interagire con OpenAI (Sottoposto a JSON Mode)
     */
    static async _generateContent(prompt) {
        if (!this._isCircuitClosed()) {
            console.warn('[CircuitBreaker] Request blocked (Circuit is OPEN)');
            return null;
        }

        console.log(`[OpenAI] Chiamata AI avviata nel core AIService (JSON)...`);
        try {
            const response = await openai.chat.completions.create({
                model: modelName,
                messages: [{ role: "user", content: prompt }],
                response_format: { type: "json_object" },
            });

            const content = response.choices[0].message.content;
            const data = this._decodeHtmlEntitiesRecursive(JSON.parse(content));

            this._recordSuccess();
            return data;
        } catch (error) {
            console.error("AI Service Error:", error.message);
            this._recordFailure();

            if (error.status === 429 || error.message.includes('429')) {
                console.warn("⚠️ [OpenAI] Rate Limit (429) rilevato. Uso fallback o cache.");
                return null;
            }
            throw error;
        }
    }

    /**
     * Metodo per generare testo libero (es. output shell, file finti)
     */
    static async _generateText(prompt) {
        if (!this._isCircuitClosed()) return null;

        console.log(`[OpenAI] Chiamata AI avviata nel core AIService (TEXT)...`);
        try {
            const response = await openai.chat.completions.create({
                model: modelName,
                messages: [{ role: "user", content: prompt }],
            });

            const content = response.choices[0].message.content;
            this._recordSuccess();
            // Applichiamo il decoding anche qui
            return this._decodeHtmlEntitiesRecursive(content.trim());
        } catch (error) {
            console.error("AI Text Error:", error.message);
            this._recordFailure();
            return null;
        }
    }

    /**
     * Recursive helper to decode HTML entities in AI responses
     */
    static _decodeHtmlEntitiesRecursive(obj) {
        if (typeof obj === 'string') {
            return obj
                .replace(/&#039;/g, "'")
                .replace(/&#39;/g, "'")
                .replace(/&apos;/g, "'")
                .replace(/&quot;/g, '"')
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .replace(/&amp;/g, '&');
        }
        if (Array.isArray(obj)) {
            return obj.map(item => this._decodeHtmlEntitiesRecursive(item));
        }
        if (typeof obj === 'object' && obj !== null) {
            const newObj = {};
            for (const key in obj) {
                newObj[key] = this._decodeHtmlEntitiesRecursive(obj[key]);
            }
            return newObj;
        }
        return obj;
    }

    /**
     * Analisi della sessione
     */
    static async analyzeSession(session) {
        console.log(`[OpenAI] Corretto ingresso in AIService.analyzeSession per IP: ${session.ipAddress}`);
        // Truncate logs to avoid exceeding token limits (TPM)
        const recentLogs = session.Logs.slice(-100);
        const logsText = recentLogs.map(log => {
            let logLine = `[${log.timestamp.toISOString()}] ${log.method} ${log.path} (Status: ${log.statusCode})`;
            if (log.queryParams && Object.keys(log.queryParams).length > 0) {
                logLine += ` | Query: ${JSON.stringify(log.queryParams)}`;
            }
            if (log.body && log.body !== '{}') {
                logLine += ` | Body: ${log.body.substring(0, 500)}`; // Limit body size
            }
            if (log.leakedIp || log.localIp) {
                logLine += ` | [DE-ANON] Leaked IP: ${log.leakedIp || 'N/A'}, Local IP: ${log.localIp || 'N/A'}`;
            }
            return logLine;
        }).join('\n');

        const prompt = prompts.SESSION_ANALYSIS(session.ipAddress, session.userAgent, logsText);

        const result = await this._generateContent(prompt);
        return result || this._getFallbackAnalysis(session, logsText);
    }

    /**
         * Fallback deterministico in caso di errore API
         */
    static _getFallbackAnalysis(session, logsText) {
        const isCritical = logsText.toLowerCase().includes('select') || logsText.includes("'");
        return {
            narrative: `[FALLBACK] Analisi automatizzata: Rilevata attività da ${session.ipAddress}.`,
            riskScore: isCritical ? 8 : 3,
            profile: { skillLevel: "Unknown", intent: "Probe" },
            predictions: { probabilityOfSuccess: "Low" }
        };
    }

    // Metodo per generare dati finti per l'inganno
    static async generateFakeData(req) {
        console.log(`[OpenAI] Corretto ingresso in AIService.generateFakeData per path: ${req.path}`);
        const prompt = prompts.ADAPTIVE_RESPONSE(
            req.method,
            req.path,
            req.body || req.query
        );

        try {
            return await this._generateContent(prompt);
        } catch (error) {
            console.error("Error generating fake data:", error.message);
            return null;
        }
    }

    static deceptionCache = new Map();
    static MAX_CACHE_SIZE = 1000;

    static async getDeceptiveResponse(req) {
        const { method, path, query, body } = req;

        // 1. Creiamo una chiave univoca basata sulla richiesta
        const requestSignature = `${method}:${path}:${JSON.stringify(query)}:${JSON.stringify(body)}`;

        // 2. Controllo coerenza: se abbiamo già risposto, restituiamo il vecchio dato
        if (this.deceptionCache.has(requestSignature)) {
            console.log(`[AI-COHERENCE] Restituisco dati persistenti per: ${path}`);
            return this.deceptionCache.get(requestSignature);
        }

        try {
            const prompt = prompts.ADAPTIVE_DECEPTION(method, path, query, body);
            const fakeData = await this._generateContent(prompt);

            // 3. Gestione cache con limite per prevenire memory leak
            if (this.deceptionCache.size >= this.MAX_CACHE_SIZE) {
                console.warn('[AI-CACHE] Cache size limit reached. Clearing oldest entries.');
                // Semplice svuotamento per ora, o potremmo implementare LRU
                const firstKey = this.deceptionCache.keys().next().value;
                this.deceptionCache.delete(firstKey);
            }
            
            this.deceptionCache.set(requestSignature, fakeData);

            return fakeData;
        } catch (error) {
            console.error("Deception Error:", error);
            return {
                error: "DB Connection Timeout", code: "ETIMEDOUT"
            };
        }
    }

    /**
     * Enhanced Payload Analysis: Local decoder + AI enrichment
     * 
     * Pipeline:
     * 1. PayloadDecoder runs locally (instant, deterministic)
     * 2. If obfuscated, call OpenAI with pre-decoded context for deep analysis
     * 3. Merge local + OpenAI results for comprehensive threat intel
     * 
     * @param {string} rawPayload - The raw payload to analyze
     * @param {boolean} forceAI - If true, always call AI even if not obfuscated
     * @returns {Object} Combined analysis result
     */
    static async analyzePayload(rawPayload, forceAI = false) {
        console.log(`[OpenAI] Corretto ingresso in AIService.analyzePayload`);
        if (!rawPayload || rawPayload.length < 10) return null;

        // Step 1: Local deterministic decoding (O(1), no API cost)
        const localAnalysis = PayloadDecoder.decode(rawPayload);

        // If local decoder found nothing interesting and AI not forced, skip
        if (!localAnalysis?.is_obfuscated && !forceAI && localAnalysis?.risk_level < 3) {
            return localAnalysis;
        }

        // Step 2: AI enrichment with pre-decoded context
        console.log(`[OpenAI] Chiamata AI avviata per arricchimento Payload Analysis...`);
        const prompt = prompts.DECODE_PAYLOAD(rawPayload, localAnalysis);

        try {
            const aiResult = await this._generateContent(prompt);

            if (!aiResult) {
                return localAnalysis; // AI parsing failed, return local analysis
            }

            // Step 3: Merge results (AI takes priority, local fills gaps)
            return {
                technique: aiResult.technique || localAnalysis?.technique,
                mitre_id: aiResult.mitre_id || null,
                decoded_script: aiResult.decoded_script || localAnalysis?.decoded_script,
                explanation: aiResult.explanation || null,
                indicators: this._mergeIndicators(
                    localAnalysis?.indicators,
                    aiResult.indicators
                ),
                risk_level: Math.max(
                    aiResult.risk_level || 0,
                    localAnalysis?.risk_level || 0
                ),
                encoding_layers: localAnalysis?.encoding_layers || [],
                attacker_profile: aiResult.attacker_profile || null,
                recommended_action: aiResult.recommended_action || null,
                analysis_source: 'hybrid', // local + AI
            };
        } catch (error) {
            console.error("Payload Analysis Error:", error.message);
            // AI failed, but we still have the local analysis
            if (localAnalysis) {
                localAnalysis.analysis_source = 'local_only';
                return localAnalysis;
            }
            return { error: "Analisi fallita", raw: rawPayload };
        }
    }

    /**
     * Light analysis: local decoder only, no AI call.
     * Use this for high-volume payloads where AI cost is prohibitive.
     */
    static analyzePayloadLight(rawPayload) {
        if (!rawPayload || rawPayload.length < 10) return null;
        const result = PayloadDecoder.decode(rawPayload);
        if (result) result.analysis_source = 'local_only';
        return result;
    }

    /**
     * Merge IOC indicators from local and AI analysis,
     * deduplicating entries across both sources.
     */
    static _mergeIndicators(local, ai) {
        const merged = {
            ips: [],
            domains: [],
            urls: [],
            files: [],
            emails: [],
            hashes: [],
            registry_keys: [],
        };

        const sources = [local, ai].filter(Boolean);

        for (const source of sources) {
            for (const key of Object.keys(merged)) {
                if (Array.isArray(source[key])) {
                    for (const item of source[key]) {
                        if (!merged[key].includes(item)) {
                            merged[key].push(item);
                        }
                    }
                }
            }
        }

        return merged;
    }

    /**
     * Summarizes recent activity for real-time dashboard updates.
     * Implements a 60-second cooldown and caching to protect API quota.
     */
    static async summarizeRecentActivity(logs) {
        const now = Date.now();

        // 1. Cooldown check: if less than 60s, return cached analysis
        if (this.lastThreatSynthesis && (now - this.lastSynthesisTime < this.SYNTHESIS_COOLDOWN)) {
            //console.log(`⏳ [OpenAI] Throttling: Restituisco analisi sintesi in cache...`);
            return this.lastThreatSynthesis;
        }

        const recentLogs = logs.slice(-50);
        const logsText = recentLogs.map(log => `[${log.ipAddress}] ${log.method} ${log.path}`).join('\n');
        const prompt = prompts.THREAT_SYNTHESIS(logsText);

        //console.log(`[Gemini] Corretto ingresso in AIService.summarizeRecentActivity per ${logs.length} log`);
        /* const logsText = logs.map(log =>
             `[${log.timestamp || new Date().toISOString()}] ${log.method} ${log.path} - Body: ${log.body || 'none'}`
         ).join('\n');*/

        //const prompt = prompts.THREAT_SYNTHESIS(logsText);

        try {
            //console.log(`[OpenAI] Chiamata IA avviata per NUOVA sintesi Threat Analysis...`);
            const result = await this._generateContent(prompt);

            // 2. Update cache if result is valid
            /* if (result && result.intent) {
                 this.lastThreatSynthesis = result;
                 this.lastSynthesisTime = now;
             }
 
             return result;*/
            if (result) {
                this.lastThreatSynthesis = result;
                this.lastSynthesisTime = now;
                return result;
            }
        } catch (e) {
            console.error("Critical fail in summarizeRecentActivity:", e);
            //return this.lastThreatSynthesis; // Fallback to cache on error
            // Fallback definitivo: se non c'è cache e l'AI è giù, restituisco un oggetto valido
            return this.lastThreatSynthesis || {
                level: "Monitor",
                intent: "Analisi IA temporaneamente offline",
                riskScore: 0,
                isBot: true
            };
        }
    }

}

module.exports = AIService;