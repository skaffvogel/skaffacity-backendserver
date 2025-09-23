/**
 * Logger utility voor consistente logging door de hele applicatie
 */

const winston = require('winston');
const path = require('path');
const fs = require('fs');

// Maak logs directory als het niet bestaat
const logDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir);
}

// Definieer logger met verschillende transport methoden
const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
        winston.format.timestamp({
            format: 'YYYY-MM-DD HH:mm:ss'
        }),
        winston.format.errors({ stack: true }),
        winston.format.splat(),
        winston.format.json()
    ),
    defaultMeta: { service: 'skaffacity-backend' },
    transports: [
        // Log naar console in development
        ...(process.env.NODE_ENV !== 'production' ? [
            new winston.transports.Console({
                format: winston.format.combine(
                    winston.format.colorize(),
                    winston.format.printf(info => `${info.timestamp} ${info.level}: ${info.message}`)
                )
            })
        ] : []),
        
        // Altijd loggen naar bestanden
        new winston.transports.File({ 
            filename: path.join(logDir, 'error.log'),
            level: 'error',
            maxsize: 5242880, // 5MB
            maxFiles: 5,
        }),
        new winston.transports.File({ 
            filename: path.join(logDir, 'combined.log'),
            maxsize: 5242880, // 5MB
            maxFiles: 5,
        })
    ],
    exitOnError: false // Niet afsluiten bij logfouten
});

module.exports = { logger };