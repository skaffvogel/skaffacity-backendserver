/**
 * Faction Wars routes voor SkaffaCity Backend
 * Beheert oorlogen tussen facties en territory claiming
 */
const express = require('express');
const router = express.Router();

// Middleware
const { authenticateToken: authMiddleware } = require('../middleware/auth');

// Controllers  
const factionWarsController = require('../controllers/faction-wars.controller');

// Basic faction management routes
router.get('/factions', factionWarsController.getFactions);
router.post('/factions', authMiddleware, factionWarsController.createFaction);
router.post('/join', authMiddleware, factionWarsController.joinFaction);
router.post('/leave', authMiddleware, factionWarsController.leaveFaction);

// War routes
router.post('/declare', authMiddleware, factionWarsController.declareWar);
router.post('/kill', authMiddleware, factionWarsController.registerKill);

// Territory routes
router.post('/claim-territory', authMiddleware, factionWarsController.claimTerritory);
router.get('/territories', factionWarsController.getTerritoryMap);

module.exports = router;