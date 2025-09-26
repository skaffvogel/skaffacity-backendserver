/**
 * Player Routes - Afhandelen van speler synchronisatie en positiedata
 */

const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');

// Development fallback: allow disabling auth for player endpoints if DB is unavailable
const bypassPlayerAuth = process.env.BYPASS_PLAYER_AUTH === '1' || process.env.BYPASS_PLAYER_AUTH === 'true';
function optionalAuth(req, res, next) {
    if (bypassPlayerAuth) return next();
    return authenticateToken(req, res, next);
}

// Importeer player controller
const { 
    registerPlayer,
    updatePosition,
    updateAttributes,
    getAllPlayers,
    getPlayerById,
    deletePlayer
} = require('../controllers/player.controller');

// Speler routes
router.post('/register', optionalAuth, registerPlayer);
router.post('/position', optionalAuth, updatePosition);
router.post('/attributes', optionalAuth, updateAttributes);
router.get('/', optionalAuth, getAllPlayers);
router.get('/:id', optionalAuth, getPlayerById);
router.delete('/:id', optionalAuth, deletePlayer);

module.exports = router;