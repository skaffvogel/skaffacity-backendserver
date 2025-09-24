/**
 * Error handler middleware voor uniforme error responses
 */

const { logger } = require('../utils/logger');

// Custom error class voor app-specifieke errors
class AppError extends Error {
    constructor(message, statusCode) {
        super(message);
        this.statusCode = statusCode;
        this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
        this.isOperational = true;
        
        Error.captureStackTrace(this, this.constructor);
    }
}

// Error handler middleware
exports.errorHandler = (err, req, res, next) => {
    // Standaard error status als er geen is aangegeven
    err.statusCode = err.statusCode || 500;
    err.status = err.status || 'error';
    
    // Log error naar bestand in productie, console in development
    if (process.env.NODE_ENV === 'production') {
        logger.error(`${err.statusCode} - ${err.message} - ${req.originalUrl} - ${req.method} - ${req.ip}`);
    } else {
        console.error(err);
    }
    
    // Formatteer error response
    res.status(err.statusCode).json({
        status: err.status,
        message: process.env.NODE_ENV === 'production' && !err.isOperational
            ? 'Er is een serverfout opgetreden'
            : err.message,
        ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
    });
};

// Error wrapper voor async functies
exports.catchAsync = fn => {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};

// Export custom error class
exports.AppError = AppError;