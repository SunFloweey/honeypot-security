/**
 * PayloadDecoder - Deterministic Payload Analysis Engine
 * 
 * Decodes obfuscated payloads locally (Base64, PowerShell -e, hex, URL encoding)
 * BEFORE sending to OpenAI for deep analysis. This ensures:
 * 1. Instant decoding without API latency
 * 2. Reliable fallback when AI is unavailable
 * 3. Pre-processed data for more accurate AI analysis
 * 
 * @module services/payloadDecoder
 */
class PayloadDecoder {

    // ============================
    // DETECTION PATTERNS
    // ============================
    static ENCODING_PATTERNS = {
        POWERSHELL_ENCODED: /powershell(?:\.exe)?\s+.*-e(?:ncodedcommand)?\s+([A-Za-z0-9+/=]{20,})/i,
        POWERSHELL_BYPASS: /powershell(?:\.exe)?\s+.*-(?:exec(?:utionpolicy)?\s+bypass|nop(?:rofile)?|w(?:indowstyle)?\s+hidden)/i,
        CMD_EXEC: /cmd(?:\.exe)?\s*\/c\s+(.+)/i,
        BASE64_INLINE: /(?:echo|printf)\s+["']?([A-Za-z0-9+/=]{20,})["']?\s*\|\s*(?:base64\s+-d|openssl\s+base64)/i,
        BASE64_STANDALONE: /^[A-Za-z0-9+/=]{20,}$/,
        HEX_ENCODED: /(?:\\x[0-9a-fA-F]{2}){4,}/,
        URL_ENCODED: /(?:%[0-9a-fA-F]{2}){4,}/,
        BASH_EVAL: /(?:eval|exec)\s*\(\s*["'](.+?)["']\s*\)/i,
        CURL_WGET: /(?:curl|wget)\s+.*?(https?:\/\/[^\s;|&]+)/i,
        REVERSE_SHELL: /(?:bash\s+-i|nc\s+-e|ncat|socat|python\s+-c.*socket|php\s+-r.*fsockopen)/i,
        DOWNLOAD_EXEC: /(?:curl|wget|certutil|bitsadmin).*?(?:\|\s*(?:bash|sh|powershell)|>\s*\w+\.(?:exe|bat|ps1|sh))/i,
    };

    // IOC (Indicator of Compromise) Extraction Patterns
    static IOC_PATTERNS = {
        IPV4: /\b(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\b/g,
        DOMAIN: /\b(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+(?:com|net|org|io|info|biz|xyz|top|ru|cn|tk|ml|ga|cf|pw|cc|su|onion)\b/g,
        URL: /https?:\/\/[^\s"'<>]+/g,
        FILE_PATH: /(?:\/(?:tmp|var|etc|usr|home|root|opt|dev|proc)\/[^\s"'<>;|&]+|[A-Z]:\\(?:Users|Windows|Temp|Program)[^\s"'<>;|&]*)/gi,
        EMAIL: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
        REGISTRY_KEY: /HKCU|HKLM|HKEY_[A-Z_]+\\[^\s"'<>;]+/gi,
    };

    // Known benign/private IPs to exclude from IOCs
    static PRIVATE_IP_RANGES = [
        /^127\./,
        /^10\./,
        /^172\.(1[6-9]|2\d|3[01])\./,
        /^192\.168\./,
        /^0\./,
        /^169\.254\./,
    ];

    // ============================
    // CORE DECODE PIPELINE
    // ============================

    /**
     * Main entry point: attempts to decode a raw payload through
     * a pipeline of decoders, extracting IOCs along the way.
     * 
     * @param {string} rawPayload - The raw command/script to analyze
     * @returns {Object} Decoded result with IOCs and metadata
     */
    static decode(rawPayload) {
        if (!rawPayload || typeof rawPayload !== 'string' || rawPayload.length < 5) {
            return null;
        }

        const result = {
            original: rawPayload,
            decoded_script: null,
            encoding_layers: [],
            technique: null,
            indicators: { ips: [], domains: [], urls: [], files: [], emails: [], registry_keys: [] },
            risk_level: 0,
            is_obfuscated: false,
            decoder_used: 'local',
        };

        // Run through decoding pipeline
        let decoded = rawPayload;
        let previousDecoded = '';
        let iterations = 0;
        const MAX_ITERATIONS = 5; // Prevent infinite loops on recursive encoding

        while (decoded !== previousDecoded && iterations < MAX_ITERATIONS) {
            previousDecoded = decoded;
            decoded = this._decodePowerShellEncoded(decoded, result);
            decoded = this._decodeCmdExec(decoded, result);
            decoded = this._decodeBase64Inline(decoded, result);
            decoded = this._decodeHex(decoded, result);
            decoded = this._decodeUrlEncoding(decoded, result);
            decoded = this._decodeBashEval(decoded, result);
            iterations++;
        }

        // If we decoded something, mark it
        if (result.encoding_layers.length > 0) {
            result.is_obfuscated = true;
            result.decoded_script = decoded;
        } else {
            // Try standalone Base64 as last resort
            decoded = this._decodeStandaloneBase64(rawPayload, result);
            if (result.encoding_layers.length > 0) {
                result.is_obfuscated = true;
                result.decoded_script = decoded;
            } else {
                result.decoded_script = rawPayload;
            }
        }

        // Extract IOCs from both original and decoded
        this._extractIOCs(rawPayload, result);
        this._extractIOCs(decoded, result);

        // Classify technique
        result.technique = this._classifyTechnique(rawPayload, decoded);

        // Calculate risk
        result.risk_level = this._calculateRisk(result);

        return result;
    }

    // ============================
    // INDIVIDUAL DECODERS
    // ============================

    /**
     * PowerShell -EncodedCommand decoder
     * Handles: powershell -e <base64> (UTF-16LE encoded)
     */
    static _decodePowerShellEncoded(input, result) {
        const match = input.match(this.ENCODING_PATTERNS.POWERSHELL_ENCODED);
        if (!match) return input;

        try {
            const b64 = match[1];
            // PowerShell -e uses UTF-16LE encoding
            const buffer = Buffer.from(b64, 'base64');
            const decoded = buffer.toString('utf16le');

            if (this._isPrintable(decoded)) {
                result.encoding_layers.push({
                    type: 'PowerShell EncodedCommand',
                    encoding: 'Base64 → UTF-16LE',
                    raw_segment: b64.substring(0, 40) + '...',
                });
                return decoded;
            }
        } catch (e) { /* Not valid Base64, skip */ }

        return input;
    }

    /**
     * cmd.exe /c wrapper decoder
     */
    static _decodeCmdExec(input, result) {
        const match = input.match(this.ENCODING_PATTERNS.CMD_EXEC);
        if (!match) return input;

        result.encoding_layers.push({
            type: 'CMD Wrapper',
            encoding: 'cmd.exe /c',
            raw_segment: match[0].substring(0, 60),
        });

        return match[1].trim();
    }

    /**
     * Inline Base64 piped to decoder
     * Handles: echo "..." | base64 -d
     */
    static _decodeBase64Inline(input, result) {
        const match = input.match(this.ENCODING_PATTERNS.BASE64_INLINE);
        if (!match) return input;

        try {
            const decoded = Buffer.from(match[1], 'base64').toString('utf-8');
            if (this._isPrintable(decoded)) {
                result.encoding_layers.push({
                    type: 'Piped Base64',
                    encoding: 'echo ... | base64 -d',
                    raw_segment: match[1].substring(0, 40) + '...',
                });
                return input.replace(match[0], decoded);
            }
        } catch (e) { /* skip */ }

        return input;
    }

    /**
     * Standalone Base64 blob decoder
     */
    static _decodeStandaloneBase64(input, result) {
        const trimmed = input.trim();
        if (!this.ENCODING_PATTERNS.BASE64_STANDALONE.test(trimmed)) return input;
        if (trimmed.length < 20) return input;

        try {
            // Try UTF-16LE first (PowerShell style)
            const bufferUtf16 = Buffer.from(trimmed, 'base64');
            const decodedUtf16 = bufferUtf16.toString('utf16le');

            if (this._isPrintable(decodedUtf16) && decodedUtf16.length > 3) {
                result.encoding_layers.push({
                    type: 'Standalone Base64',
                    encoding: 'Base64 → UTF-16LE',
                    raw_segment: trimmed.substring(0, 40) + '...',
                });
                return decodedUtf16;
            }

            // Fallback to UTF-8
            const decodedUtf8 = bufferUtf16.toString('utf-8');
            if (this._isPrintable(decodedUtf8) && decodedUtf8.length > 3) {
                result.encoding_layers.push({
                    type: 'Standalone Base64',
                    encoding: 'Base64 → UTF-8',
                    raw_segment: trimmed.substring(0, 40) + '...',
                });
                return decodedUtf8;
            }
        } catch (e) { /* skip */ }

        return input;
    }

    /**
     * Hex-encoded string decoder
     * Handles: \x48\x65\x6c\x6c\x6f
     */
    static _decodeHex(input, result) {
        if (!this.ENCODING_PATTERNS.HEX_ENCODED.test(input)) return input;

        try {
            const decoded = input.replace(/\\x([0-9a-fA-F]{2})/g, (_, hex) =>
                String.fromCharCode(parseInt(hex, 16))
            );

            if (decoded !== input) {
                result.encoding_layers.push({
                    type: 'Hex Encoding',
                    encoding: '\\xNN',
                    raw_segment: input.substring(0, 40) + '...',
                });
                return decoded;
            }
        } catch (e) { /* skip */ }

        return input;
    }

    /**
     * URL-encoded string decoder
     * Handles: %48%65%6C%6C%6F
     */
    static _decodeUrlEncoding(input, result) {
        if (!this.ENCODING_PATTERNS.URL_ENCODED.test(input)) return input;

        try {
            const decoded = decodeURIComponent(input);
            if (decoded !== input) {
                result.encoding_layers.push({
                    type: 'URL Encoding',
                    encoding: '%NN',
                    raw_segment: input.substring(0, 40) + '...',
                });
                return decoded;
            }
        } catch (e) { /* skip */ }

        return input;
    }

    /**
     * Bash eval/exec decoder
     * Handles: eval("...")
     */
    static _decodeBashEval(input, result) {
        const match = input.match(this.ENCODING_PATTERNS.BASH_EVAL);
        if (!match) return input;

        result.encoding_layers.push({
            type: 'Eval Wrapper',
            encoding: 'eval()',
            raw_segment: match[0].substring(0, 60),
        });

        return match[1];
    }

    // ============================
    // IOC EXTRACTION
    // ============================

    /**
     * Extracts all Indicators of Compromise from a string
     */
    static _extractIOCs(text, result) {
        if (!text) return;

        // IPs (excluding private ranges)
        const ips = text.match(this.IOC_PATTERNS.IPV4) || [];
        for (const ip of ips) {
            const isPrivate = this.PRIVATE_IP_RANGES.some(r => r.test(ip));
            if (!isPrivate && !result.indicators.ips.includes(ip)) {
                result.indicators.ips.push(ip);
            }
        }

        // Domains
        const domains = text.match(this.IOC_PATTERNS.DOMAIN) || [];
        for (const domain of domains) {
            if (!result.indicators.domains.includes(domain) &&
                !domain.endsWith('.local') &&
                !domain.endsWith('.internal')) {
                result.indicators.domains.push(domain);
            }
        }

        // URLs
        const urls = text.match(this.IOC_PATTERNS.URL) || [];
        for (const url of urls) {
            if (!result.indicators.urls.includes(url)) {
                result.indicators.urls.push(url);
            }
        }

        // File paths
        const files = text.match(this.IOC_PATTERNS.FILE_PATH) || [];
        for (const file of files) {
            if (!result.indicators.files.includes(file)) {
                result.indicators.files.push(file);
            }
        }

        // Emails
        const emails = text.match(this.IOC_PATTERNS.EMAIL) || [];
        for (const email of emails) {
            if (!result.indicators.emails.includes(email)) {
                result.indicators.emails.push(email);
            }
        }

        // Registry Keys
        const regKeys = text.match(this.IOC_PATTERNS.REGISTRY_KEY) || [];
        for (const key of regKeys) {
            if (!result.indicators.registry_keys.includes(key)) {
                result.indicators.registry_keys.push(key);
            }
        }
    }

    // ============================
    // TECHNIQUE CLASSIFICATION
    // ============================

    static _classifyTechnique(original, decoded) {
        const combined = `${original} ${decoded}`.toLowerCase();

        if (this.ENCODING_PATTERNS.REVERSE_SHELL.test(combined)) return 'Reverse Shell';
        if (this.ENCODING_PATTERNS.DOWNLOAD_EXEC.test(combined)) return 'Download & Execute';
        if (/(?:crontab|schtasks|at\s|reg\s+add.*\\run)/i.test(combined)) return 'Persistence / Scheduled Task';
        if (/(?:net\s+user|whoami|id\s|cat\s+\/etc\/shadow)/i.test(combined)) return 'Reconnaissance / Credential Harvesting';
        if (/(?:nc\s+-l|ncat.*-l|socat\s+tcp-l)/i.test(combined)) return 'Bind Shell / Listener';
        if (/(?:iptables|ufw|netsh.*firewall)/i.test(combined)) return 'Firewall Manipulation';
        if (/(?:rm\s+-rf|del\s+\/[sf]|format\s+c:)/i.test(combined)) return 'Destructive / Wiper';
        if (/(?:certutil.*-decode|mshta|regsvr32|rundll32)/i.test(combined)) return 'LOLBin Abuse (Living off the Land)';
        if (this.ENCODING_PATTERNS.POWERSHELL_BYPASS.test(original)) return 'PowerShell Execution Policy Bypass';
        if (/(?:crypto|ransom|encrypt|\.locked|\.crypt)/i.test(combined)) return 'Ransomware Indicator';

        if (this.ENCODING_PATTERNS.POWERSHELL_ENCODED.test(original)) return 'Encoded PowerShell Command';
        if (this.ENCODING_PATTERNS.CURL_WGET.test(combined)) return 'Remote Resource Fetch';

        return 'Obfuscated Command Execution';
    }

    // ============================
    // RISK CALCULATION
    // ============================

    static _calculateRisk(result) {
        let risk = 0;

        // Encoding layers add risk (obfuscation = evasion intent)
        risk += Math.min(result.encoding_layers.length * 2, 4);

        // External IOCs are always dangerous
        if (result.indicators.ips.length > 0) risk += 3;
        if (result.indicators.domains.length > 0) risk += 2;
        if (result.indicators.urls.length > 0) risk += 1;

        // Technique-based risk
        const highRiskTechniques = [
            'Reverse Shell', 'Download & Execute', 'Destructive / Wiper',
            'Ransomware Indicator', 'Bind Shell / Listener'
        ];
        const medRiskTechniques = [
            'LOLBin Abuse (Living off the Land)', 'Persistence / Scheduled Task',
            'Firewall Manipulation', 'PowerShell Execution Policy Bypass'
        ];

        if (highRiskTechniques.includes(result.technique)) risk += 4;
        else if (medRiskTechniques.includes(result.technique)) risk += 2;
        else risk += 1;

        return Math.min(risk, 10);
    }

    // ============================
    // HELPERS
    // ============================

    /**
     * Checks if a decoded string is mostly printable ASCII/Unicode
     * (filters out garbage from bad decoding attempts)
     */
    static _isPrintable(str) {
        if (!str || str.length === 0) return false;
        let printableCount = 0;
        for (let i = 0; i < Math.min(str.length, 200); i++) {
            const code = str.charCodeAt(i);
            if ((code >= 32 && code <= 126) || code === 10 || code === 13 || code === 9 || code > 127) {
                printableCount++;
            }
        }
        return (printableCount / Math.min(str.length, 200)) > 0.7;
    }
}

module.exports = PayloadDecoder;
