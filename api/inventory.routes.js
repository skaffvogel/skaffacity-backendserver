/**
 * Inventory routes voor SkaffaCity Backend
 * Beheert de inventaris van spelers
 */
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();

// Database verbinding
const db = require('../utils/db');
const { Player } = require('../utils/database');

// Middleware
const { authenticateToken: authMiddleware } = require('../middleware/auth');

/**
 * @route   GET /api/v1/inventory/:playerId
 * @desc    Haal inventaris op van een speler
 * @access  Private
 */
router.get('/:playerId', authMiddleware, async (req, res) => {
    try {
        const playerId = req.params.playerId;
        
        // Controleer of speler bestaat
        const player = await Player.findById(playerId);
        if (!player) {
            return res.status(404).json({
                status: 'error',
                message: 'Speler niet gevonden'
            });
        }
        
        // Haal inventaris op
        const [inventoryData] = await db.query(
            'SELECT * FROM inventory WHERE player_id = ?',
            [playerId]
        );
        
        if (!inventoryData) {
            // Maak nieuwe inventaris als deze niet bestaat
            const inventoryId = uuidv4();
            await db.query(
                'INSERT INTO inventory (id, player_id, max_slots) VALUES (?, ?, ?)',
                [inventoryId, playerId, 20]
            );
            
            return res.json({
                status: 'success',
                data: {
                    id: inventoryId,
                    playerId: playerId,
                    maxSlots: 20,
                    items: [],
                    usedSlots: 0
                }
            });
        }
        
        // Haal items op uit de inventaris
        const items = await db.query(
            'SELECT * FROM inventory_items WHERE inventory_id = ?',
            [inventoryData.id]
        );
        
        res.json({
            status: 'success',
            data: {
                id: inventoryData.id,
                playerId: playerId,
                maxSlots: inventoryData.max_slots,
                items: items.map(item => ({
                    id: item.id,
                    itemId: item.item_id,
                    quantity: item.quantity,
                    slot: item.slot
                })),
                usedSlots: items.length
            }
        });
    } catch (error) {
        console.error('Inventory GET error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Inventaris ophalen mislukt',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

/**
 * @route   POST /api/v1/inventory/:playerId/add
 * @desc    Voeg een item toe aan inventaris
 * @access  Private
 */
router.post('/:playerId/add', authMiddleware, async (req, res) => {
    try {
        const playerId = req.params.playerId;
        const { itemId, quantity, slot } = req.body;
        
        if (!itemId || !quantity) {
            return res.status(400).json({
                status: 'error',
                message: 'ItemId en quantity zijn verplicht'
            });
        }
        
        // Controleer of speler bestaat
        const player = await Player.findById(playerId);
        if (!player) {
            return res.status(404).json({
                status: 'error',
                message: 'Speler niet gevonden'
            });
        }
        
        // Haal inventaris op
        const [inventoryData] = await db.query(
            'SELECT * FROM inventory WHERE player_id = ?',
            [playerId]
        );
        
        let inventoryId;
        
        if (!inventoryData) {
            // Maak nieuwe inventaris als deze niet bestaat
            inventoryId = uuidv4();
            await db.query(
                'INSERT INTO inventory (id, player_id, max_slots) VALUES (?, ?, ?)',
                [inventoryId, playerId, 20]
            );
        } else {
            inventoryId = inventoryData.id;
        }
        
        // Controleer of er nog ruimte is
        const [slotCount] = await db.query(
            'SELECT COUNT(*) as count FROM inventory_items WHERE inventory_id = ?',
            [inventoryId]
        );
        
        const maxSlots = inventoryData ? inventoryData.max_slots : 20;
        
        if (slotCount.count >= maxSlots && !slot) {
            return res.status(400).json({
                status: 'error',
                message: 'Inventaris is vol'
            });
        }
        
        // Controleer of het item al bestaat in een slot
        if (slot) {
            const [existingItem] = await db.query(
                'SELECT * FROM inventory_items WHERE inventory_id = ? AND slot = ?',
                [inventoryId, slot]
            );
            
            if (existingItem) {
                if (existingItem.item_id === itemId) {
                    // Update bestaand item in dit slot
                    await db.query(
                        'UPDATE inventory_items SET quantity = quantity + ? WHERE id = ?',
                        [quantity, existingItem.id]
                    );
                    
                    return res.json({
                        status: 'success',
                        message: `${quantity}x item ${itemId} toegevoegd aan inventaris van speler ${playerId}`,
                        slot: slot
                    });
                } else {
                    return res.status(400).json({
                        status: 'error',
                        message: 'Slot is al bezet door een ander item'
                    });
                }
            }
        }
        
        // Vind een beschikbare slot als er geen is opgegeven
        let targetSlot = slot;
        if (!targetSlot) {
            const usedSlots = await db.query(
                'SELECT slot FROM inventory_items WHERE inventory_id = ?',
                [inventoryId]
            );
            
            const usedSlotSet = new Set(usedSlots.map(item => item.slot));
            for (let i = 0; i < maxSlots; i++) {
                if (!usedSlotSet.has(i)) {
                    targetSlot = i;
                    break;
                }
            }
        }
        
        // Voeg item toe aan inventaris
        const itemUuid = uuidv4();
        await db.query(
            'INSERT INTO inventory_items (id, inventory_id, item_id, quantity, slot) VALUES (?, ?, ?, ?, ?)',
            [itemUuid, inventoryId, itemId, quantity, targetSlot]
        );
        
        res.json({
            status: 'success',
            message: `${quantity}x item ${itemId} toegevoegd aan inventaris van speler ${playerId}`,
            data: {
                id: itemUuid,
                itemId: itemId,
                quantity: quantity,
                slot: targetSlot
            }
        });
    } catch (error) {
        console.error('Inventory ADD error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Item toevoegen mislukt',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

/**
 * @route   POST /api/v1/inventory/:playerId/remove
 * @desc    Verwijder een item uit inventaris
 * @access  Private
 */
router.post('/:playerId/remove', authMiddleware, async (req, res) => {
    try {
        const playerId = req.params.playerId;
        const { itemId, quantity, slot } = req.body;
        
        if ((!itemId && slot === undefined) || !quantity) {
            return res.status(400).json({
                status: 'error',
                message: 'ItemId/slot en quantity zijn verplicht'
            });
        }
        
        // Controleer of speler bestaat
        const player = await Player.findById(playerId);
        if (!player) {
            return res.status(404).json({
                status: 'error',
                message: 'Speler niet gevonden'
            });
        }
        
        // Haal inventaris op
        const [inventoryData] = await db.query(
            'SELECT * FROM inventory WHERE player_id = ?',
            [playerId]
        );
        
        if (!inventoryData) {
            return res.status(404).json({
                status: 'error',
                message: 'Inventaris niet gevonden'
            });
        }
        
        // Zoek het item
        let query = 'SELECT * FROM inventory_items WHERE inventory_id = ?';
        const params = [inventoryData.id];
        
        if (itemId) {
            query += ' AND item_id = ?';
            params.push(itemId);
        }
        
        if (slot !== undefined) {
            query += ' AND slot = ?';
            params.push(slot);
        }
        
        const [item] = await db.query(query, params);
        
        if (!item) {
            return res.status(404).json({
                status: 'error',
                message: 'Item niet gevonden in inventaris'
            });
        }
        
        // Verwijder het item of verminder de hoeveelheid
        if (item.quantity <= quantity) {
            // Verwijder het item volledig
            await db.query(
                'DELETE FROM inventory_items WHERE id = ?',
                [item.id]
            );
            
            res.json({
                status: 'success',
                message: `${item.quantity}x item ${item.item_id} verwijderd uit inventaris van speler ${playerId}`,
                removed: true,
                slot: item.slot
            });
        } else {
            // Verminder de hoeveelheid
            await db.query(
                'UPDATE inventory_items SET quantity = quantity - ? WHERE id = ?',
                [quantity, item.id]
            );
            
            res.json({
                status: 'success',
                message: `${quantity}x item ${item.item_id} verminderd in inventaris van speler ${playerId}`,
                removed: false,
                remaining: item.quantity - quantity,
                slot: item.slot
            });
        }
    } catch (error) {
        console.error('Inventory REMOVE error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Item verwijderen mislukt',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

/**
 * @route   POST /api/v1/inventory/:playerId/move
 * @desc    Verplaats een item in de inventaris
 * @access  Private
 */
router.post('/:playerId/move', authMiddleware, async (req, res) => {
    try {
        const playerId = req.params.playerId;
        const { fromSlot, toSlot } = req.body;
        
        if (fromSlot === undefined || toSlot === undefined) {
            return res.status(400).json({
                status: 'error',
                message: 'fromSlot en toSlot zijn verplicht'
            });
        }
        
        // Controleer of speler bestaat
        const player = await Player.findById(playerId);
        if (!player) {
            return res.status(404).json({
                status: 'error',
                message: 'Speler niet gevonden'
            });
        }
        
        // Haal inventaris op
        const [inventoryData] = await db.query(
            'SELECT * FROM inventory WHERE player_id = ?',
            [playerId]
        );
        
        if (!inventoryData) {
            return res.status(404).json({
                status: 'error',
                message: 'Inventaris niet gevonden'
            });
        }
        
        // Haal items op uit de slots
        const [fromItem] = await db.query(
            'SELECT * FROM inventory_items WHERE inventory_id = ? AND slot = ?',
            [inventoryData.id, fromSlot]
        );
        
        if (!fromItem) {
            return res.status(404).json({
                status: 'error',
                message: 'Item niet gevonden in fromSlot'
            });
        }
        
        const [toItem] = await db.query(
            'SELECT * FROM inventory_items WHERE inventory_id = ? AND slot = ?',
            [inventoryData.id, toSlot]
        );
        
        // Begin een transactie
        const transaction = await db.beginTransaction();
        
        try {
            if (!toItem) {
                // Eenvoudige verplaatsing
                await transaction.query(
                    'UPDATE inventory_items SET slot = ? WHERE id = ?',
                    [toSlot, fromItem.id]
                );
            } else {
                // Items omwisselen
                await transaction.query(
                    'UPDATE inventory_items SET slot = ? WHERE id = ?',
                    [toSlot, fromItem.id]
                );
                
                await transaction.query(
                    'UPDATE inventory_items SET slot = ? WHERE id = ?',
                    [fromSlot, toItem.id]
                );
            }
            
            // Commit de transactie
            await transaction.commit();
            
            res.json({
                status: 'success',
                message: `Item verplaatst van slot ${fromSlot} naar slot ${toSlot}`,
                data: {
                    fromSlot,
                    toSlot,
                    swapped: !!toItem
                }
            });
        } catch (error) {
            // Rollback bij fout
            await transaction.rollback();
            throw error;
        }
    } catch (error) {
        console.error('Inventory MOVE error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Item verplaatsen mislukt',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

module.exports = router;