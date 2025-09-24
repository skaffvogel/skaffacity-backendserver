/**
 * Economy routes voor het beheer van SKAFF currency
 */

const express = require('express');
const router = express.Router();
const { authenticateToken, isAdmin } = require('./middleware/auth');
const economyController = require('./controllers/economy.controller');

// Economie routes
router.get('/balance', authenticateToken, economyController.getBalance);
router.post('/transfer', authenticateToken, economyController.transferSkaff);
router.post('/reward', authenticateToken, isAdmin, economyController.rewardSkaff);
router.post('/penalty', authenticateToken, isAdmin, economyController.penaltySkaff);
router.get('/transactions', authenticateToken, economyController.getTransactions);
router.get('/transactions/global', authenticateToken, isAdmin, economyController.getGlobalTransactions);

module.exports = router;