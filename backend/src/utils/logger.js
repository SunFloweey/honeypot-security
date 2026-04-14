/**
 * DIANA Logger Utility
 * Sistema centralizzato di logging per tutti i componenti
 */

const winston = require('winston');

// Configurazione logger per produzione
const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
    ),
    defaultMeta: { service: 'diana-admin' },
    transports: [
        // Log su console per container
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.simple()
            )
        })
    ]
});

// Se siamo in sviluppo, aggiungi formattazione leggibile
if (process.env.NODE_ENV !== 'production') {
    logger.add(new winston.transports.Console({
        format: winston.format.simple()
    }));
}

module.exports = logger;
