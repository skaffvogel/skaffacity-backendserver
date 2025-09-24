/**
 * Auth Routes - Afhandelen van authenticatie en gebruikersbeheer
 */

const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');

// Importeer auth controller
const {
    register,
    login,
    validateToken,
    refreshToken,
    getUserProfile,
    updateUserProfile
} = require('../controllers/auth.controller');

// Auth routes
router.post('/register', register);
router.post('/login', login);
router.post('/validate', validateToken);
router.post('/refresh', refreshToken);
router.get('/me', authenticateToken, getUserProfile);
router.put('/me', authenticateToken, updateUserProfile);

module.exports = router;