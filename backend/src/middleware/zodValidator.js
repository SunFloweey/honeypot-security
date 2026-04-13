'use strict';
const { z } = require('zod');

// ============================================================
// SCHEMI ZOD (Single Source of Truth per la validazione)
// ============================================================

/**
 * Schema per i log inviati dall'SDK.
 * Regole:
 *  - event: stringa uppercase, max 100 char (es. "USER_LOGIN", "FILE_ACCESS")
 *  - metadata: oggetto arbitrario ma serializzato <2KB
 *  - sessionKey: hex string di esattamente 32 char
 */
const sdkLogSchema = z.object({
    event: z
        .string()
        .min(1)
        .max(100)
        .regex(/^[A-Z0-9_]+$/, 'event deve essere UPPERCASE con solo lettere, numeri e underscore'),
    metadata: z
        .record(z.unknown())
        .optional()
        .superRefine((val, ctx) => {
            if (val === undefined) return;
            const serialized = JSON.stringify(val);
            if (serialized.length > 2048) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: `metadata supera il limite di 2KB (${serialized.length} bytes)`
                });
            }
        }),
    sessionKey: z
        .string()
        .regex(/^[0-9a-f]{32}$/, 'sessionKey deve essere una stringa hex di 32 caratteri')
        .optional(),
    ipAddress: z
        .string()
        .ip()
        .optional()
});

/**
 * Schema per il login SaaS.
 */
const loginSchema = z.object({
    email: z.string().email().max(254).toLowerCase(),
    password: z.string().min(8).max(128)
});

/**
 * Schema per il provisioning tenant.
 */
const provisionSchema = z.object({
    email: z.string().email().max(254).toLowerCase(),
    name: z.string().min(2).max(100),
    phoneNumber: z.string().regex(/^\+?[1-9]\d{1,14}$/, 'Formato telefono internazionale richiesto')
});

/**
 * Schema per la creazione di una chiave API.
 */
const apiKeySchema = z.object({
    name: z.string()
        .min(2)
        .max(50)
        .regex(/^[a-zA-Z0-9\s\-_]+$/, 'Nome non valido: solo alfanumerici, spazi, trattini e underscore')
});

/**
 * Schema per UUID v4 nei parametri di rotta.
 */
const uuidParamSchema = z.object({
    id: z.string().uuid('ID non valido: deve essere un UUID v4')
});

/**
 * Schema per l'analisi AI (limita payload a 5KB).
 */
const aiAnalyzeSchema = z.object({
    payload: z.string().min(1).max(5000)
});

// ============================================================
// SANITIZZAZIONE RICORSIVA ANTI-XSS
// ============================================================

const HTML_ESCAPE_MAP = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;'
};

/**
 * Esegue l'escaping dei caratteri HTML pericolosi in una stringa.
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
    return str.replace(/[&<>"'/]/g, (char) => HTML_ESCAPE_MAP[char]);
}

/**
 * Sanitizzazione ricorsiva di un oggetto/array/primitivo.
 * - Escape HTML su tutte le stringhe
 * - Limita la profondità di nesting a 5 livelli (protezione ReDoS/Stack overflow)
 * @param {unknown} value - Il valore da sanitizzare
 * @param {number} depth - Profondità corrente (default 0)
 * @returns {unknown} 
 */
function sanitizeDeep(value, depth = 0) {
    if (depth > 5) return '[MAX_DEPTH_EXCEEDED]';

    if (typeof value === 'string') {
        return escapeHtml(value);
    }

    if (Array.isArray(value)) {
        return value.map((item) => sanitizeDeep(item, depth + 1));
    }

    if (value !== null && typeof value === 'object') {
        const sanitized = {};
        for (const [key, val] of Object.entries(value)) {
            // Sanitizza anche le chiavi per prevenire prototype pollution
            const safeKey = escapeHtml(String(key));
            sanitized[safeKey] = sanitizeDeep(val, depth + 1);
        }
        return sanitized;
    }

    // number, boolean, null, undefined: sicuri per definizione
    return value;
}

// ============================================================
// MIDDLEWARE FACTORY
// ============================================================

/**
 * Middleware universale di validazione con Zod.
 * Logica di sicurezza:
 *  1. Valida lo schema in modo strict (no unknown keys)
 *  2. Sanitizza ricorsivamente l'output per prevenire XSS memorizzati
 *  3. In caso di errore, risponde con 422 senza esporre dettagli interni
 *
 * @param {z.ZodObject} schema - Schema Zod da applicare
 * @param {'body'|'params'|'query'} source - Proprietà di req da validare
 */
function validateZod(schema, source = 'body') {
    return (req, res, next) => {
        try {
            const result = schema.safeParse(req[source]);

            if (!result.success) {
                // Log interno con i dettagli, ma risposta generica all'utente
                console.warn('[SecurityShield] Validation failed:', {
                    path: req.path,
                    source,
                    errors: result.error.flatten()
                });

                return res.status(422).json({
                    success: false,
                    error: 'Unprocessable Entity',
                    // Esponiamo solo i field path, mai i valori rifiutati
                    fields: result.error.errors.map((e) => ({
                        path: e.path.join('.'),
                        message: e.message
                    }))
                });
            }

            // Sostituiamo req[source] con i dati validati e sanitizzati
            req[source] = sanitizeDeep(result.data);
            next();
        } catch (err) {
            // Fallback sicuro: blocca la richiesta senza crashare il server
            console.error('[SecurityShield] Unexpected validation error:', err.message);
            return res.status(500).json({ success: false, error: 'Internal validation error' });
        }
    };
}

module.exports = {
    validateZod,
    sanitizeDeep,
    escapeHtml,
    schemas: {
        sdkLog: sdkLogSchema,
        login: loginSchema,
        provision: provisionSchema,
        apiKey: apiKeySchema,
        uuidParam: uuidParamSchema,
        aiAnalyze: aiAnalyzeSchema
    }
};
