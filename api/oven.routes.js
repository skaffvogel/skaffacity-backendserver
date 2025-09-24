/**
 * Oven routes voor SkaffaCity Backend
 * Beheert de ovens voor het smelten van mineralen
 */
const express = require('express');
const router = express.Router();

// Middleware
const { authenticateToken: authMiddleware } = require('./middleware/auth');

/**
 * @route   GET /api/v1/oven/:ovenId
 * @desc    Haal status van een specifieke oven op
 * @access  Private
 */
router.get('/:ovenId', authMiddleware, (req, res) => {
    try {
        // Simuleer oven status (implementeer echte database query in productie)
        const oven = { 
            id: req.params.ovenId, 
            owner: 'player123',
            status: 'active', 
            fuelLevel: 75, 
            contents: {
                inputSlot: { itemId: 'raw_iron', quantity: 10 },
                outputSlot: { itemId: 'iron_ingot', quantity: 2 }
            },
            progress: 35, // percentage complete
            timeRemaining: 120, // seconds
            position: { x: -125.4, y: 12.8, z: 64.2 }
        };
        
        res.json({
            status: 'success',
            data: oven
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: 'Oven status ophalen mislukt',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

/**
 * @route   POST /api/v1/oven/:ovenId/start
 * @desc    Start een oven smelting proces
 * @access  Private
 */
router.post('/:ovenId/start', authMiddleware, (req, res) => {
    try {
        const { playerId, itemId, quantity, fuelAmount } = req.body;
        
        if (!playerId || !itemId || !quantity || !fuelAmount) {
            return res.status(400).json({
                status: 'error',
                message: 'PlayerId, itemId, quantity, en fuelAmount zijn verplicht'
            });
        }
        
        // Implementeer echte oven logica in productie
        const smeltTime = 180; // seconden
        
        res.json({
            status: 'success',
            message: 'Oven smelting gestart',
            data: {
                ovenId: req.params.ovenId,
                playerId,
                startTime: new Date(),
                expectedCompletionTime: new Date(Date.now() + (smeltTime * 1000)),
                smeltTimeSeconds: smeltTime
            }
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: 'Oven starten mislukt',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

/**
 * @route   POST /api/v1/oven/:ovenId/collect
 * @desc    Verzamel output van een oven
 * @access  Private
 */
router.post('/:ovenId/collect', authMiddleware, (req, res) => {
    try {
        const { playerId } = req.body;
        
        if (!playerId) {
            return res.status(400).json({
                status: 'error',
                message: 'PlayerId is verplicht'
            });
        }
        
        // Implementeer echte collect logica in productie
        res.json({
            status: 'success',
            message: 'Output verzameld uit oven',
            data: {
                ovenId: req.params.ovenId,
                playerId,
                collected: {
                    itemId: 'iron_ingot',
                    quantity: 8
                }
            }
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: 'Output verzamelen mislukt',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

/**
 * @route   POST /api/v1/oven/:ovenId/addfuel
 * @desc    Voeg brandstof toe aan een oven
 * @access  Private
 */
router.post('/:ovenId/addfuel', authMiddleware, (req, res) => {
    try {
        const { playerId, fuelItemId, amount } = req.body;
        
        if (!playerId || !fuelItemId || !amount) {
            return res.status(400).json({
                status: 'error',
                message: 'PlayerId, fuelItemId en amount zijn verplicht'
            });
        }
        
        // Implementeer echte brandstof logica in productie
        res.json({
            status: 'success',
            message: 'Brandstof toegevoegd aan oven',
            data: {
                ovenId: req.params.ovenId,
                playerId,
                newFuelLevel: 95,
                addedAmount: amount
            }
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: 'Brandstof toevoegen mislukt',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

module.exports = router;