/**
 * Faction routes voor het beheer van facties en factie relaties
 */

const express = require('express');
const router = express.Router();
const { authenticateToken } = require('./middleware/auth');
const factionController = require('./controllers/faction.controller');

// Factie routes
router.get('/', authenticateToken, factionController.getAllFactions);
router.get('/:id', authenticateToken, factionController.getFactionById);
router.post('/join', authenticateToken, factionController.joinFaction);
router.get('/relations', authenticateToken, factionController.getFactionRelations);
router.get('/members/:factionId', authenticateToken, factionController.getFactionMembers);

// Admin only routes
router.post('/', authenticateToken, factionController.createFaction);
router.put('/:id', authenticateToken, factionController.updateFaction);
router.post('/relations', authenticateToken, factionController.updateFactionRelations);

module.exports = router;