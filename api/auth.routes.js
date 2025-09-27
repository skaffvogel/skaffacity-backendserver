/**
 * Auth Routes - Afhandelen van authenticatie en gebruikersbeheer
 */

const express = require('express');
const router = express.Router();
const { authenticateJWT } = require('../middleware/jwt');

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
router.get('/me', authenticateJWT, getUserProfile);
router.put('/me', authenticateJWT, updateUserProfile);

module.exports = router;