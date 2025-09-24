/**
 * Shop routes voor SkaffaCity Backend
 * Beheert de in-game winkel en item trading
 */
const express = require('express');
const router = express.Router();

// Middleware
const { authenticateToken: authMiddleware } = require('../middleware/auth');

// Controllers
const shopController = require('../controllers/shop.controller');

/**
 * @route   GET /api/v1/shop/items
 * @desc    Haal alle shop items op
 * @access  Public
 */
router.get('/items', shopController.getShopItems);

/**
 * @route   POST /api/v1/shop/buy
 * @desc    Koop item uit de shop
 * @access  Private  
 */
router.post('/buy', authMiddleware, shopController.buyItem);

/**
 * @route   POST /api/v1/shop/sell
 * @desc    Verkoop item uit inventory
 * @access  Private
 */
router.post('/sell', authMiddleware, shopController.sellItem);

/**
 * @route   GET /api/v1/shop/history/:playerId
 * @desc    Haal shop transactie geschiedenis op
 * @access  Private
 */
router.get('/history/:playerId', authMiddleware, shopController.getShopHistory);

module.exports = router;