/**
 * Player Routes - Afhandelen van speler synchronisatie en positiedata
 */

const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');

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
router.post('/register', authenticateToken, registerPlayer);
router.post('/position', authenticateToken, updatePosition);
router.post('/attributes', authenticateToken, updateAttributes);
router.get('/', authenticateToken, getAllPlayers);
router.get('/:id', authenticateToken, getPlayerById);
router.delete('/:id', authenticateToken, deletePlayer);

module.exports = router;