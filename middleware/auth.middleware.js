/**
 * Authentication middleware voor het beveiligen van routes
 * Dit is een wrapper rond auth.js voor compatibiliteit
 */

const { authenticateToken } = require('./auth');

// Exporteer de middleware functie als authMiddleware
exports.authMiddleware = authenticateToken;