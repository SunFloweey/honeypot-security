const Joi = require('joi');

/**
 * Middleware di validazione universale
 * @param {Joi.ObjectSchema} schema - Lo schema di validazione Joi
 * @param {string} property - La proprietà di req da validare ('body', 'query', 'params')
 */
const validate = (schema, property = 'body') => {
  return (req, res, next) => {
    const { error } = schema.validate(req[property], {
      abortEarly: false,
      stripUnknown: true,
      allowUnknown: false
    });

    if (error) {
      const details = error.details.map(i => ({
        message: i.message,
        path: i.path
      }));
      
      console.warn(`[Security Shield] Tentativo di input malformato su ${req.path}:`, JSON.stringify(details));
      
      return res.status(422).json({
        success: false,
        error: 'Unprocessable Entity',
        message: 'La validazione dei dati di input è fallita.',
        details
      });
    }
    next();
  };
};

// --- Schemi Specifici per DIANA ---

const saasSchemas = {
  // Validazione Registrazione/Provisioning
  provision: Joi.object({
    email: Joi.string().email().required().lowercase(),
    name: Joi.string().min(2).max(100).required(),
    phoneNumber: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/).required()
  }),

  // Validazione Login
  login: Joi.object({
    email: Joi.string().email().required().lowercase(),
    password: Joi.string().min(8).max(100).required()
  }),

  // Validazione Gestione Chiavi
  apiKey: Joi.object({
    name: Joi.string().min(2).max(50).required().pattern(/^[a-zA-Z0-9\s-_]+$/)
  }),

  // Validazione ID Risorse (UUID)
  resourceId: Joi.object({
    id: Joi.string().guid({ version: 'uuidv4' }).required()
  }),

  // Validazione Log SDK
  sdkLog: Joi.object({
    event: Joi.string().min(1).max(100).required(),
    sessionKey: Joi.string().max(64).optional(),
    ipAddress: Joi.string().ip().optional(),
    metadata: Joi.object().max(50).optional() // Limita a 50 campi per metadata
  }),

  // Validazione Analisi IA
  aiAnalyze: Joi.object({
    payload: Joi.string().min(1).max(5000).required() // Max 5KB per analisi
  })
};

module.exports = {
  validate,
  saasSchemas
};
