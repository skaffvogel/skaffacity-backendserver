/**
 * Mining routes voor SkaffaCity Backend
 * Beheert het minen van resources en mining locaties
 */
const express = require('express');
const router = express.Router();

// Middleware
const { authenticateToken: authMiddleware } = require('../middleware/auth');

// Controllers
const miningController = require('../controllers/mining.controller');

// Mining routes
router.get('/locations', miningController.getMiningLocations);
router.post('/start', authMiddleware, miningController.startMining);
router.post('/complete/:sessionId', authMiddleware, miningController.completeMining);
router.get('/status/:playerId', authMiddleware, miningController.getMiningStatus);

module.exports = router;