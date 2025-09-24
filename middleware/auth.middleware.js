/**
 * Authentication middleware voor het beveiligen van routes
 * Dit is een wrapper rond auth.js voor compatibiliteit
 */

const { authenticateToken } = require('./auth');

// Exporteer beide varianten voor compatibiliteit
exports.authMiddleware = authenticateToken;
exports.authenticate = authenticateToken;
exports.authenticateToken = authenticateToken;