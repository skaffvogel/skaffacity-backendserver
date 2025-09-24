/**
 * Shop controller voor winkel operaties
 */

const { v4: uuidv4 } = require('uuid');
const db = require('../utils/db');
const User = require('../models/user.mysql');
const Player = require('../models/player.mysql');

// Shop items configuratie
const SHOP_ITEMS = {
    // Tools & Equipment
    'iron_pickaxe': {
        id: 'iron_pickaxe',
        name: 'Iron Pickaxe',
        description: 'Een stevige ijzeren pikhouweel voor efficiënt minen',
        category: 'tools',
        price: 150,
        level_required: 5,
        stats: { mining_speed: 1.5, durability: 100 }
    },
    'diamond_pickaxe': {
        id: 'diamond_pickaxe', 
        name: 'Diamond Pickaxe',
        description: 'De ultieme mining tool met diamant punt',
        category: 'tools',
        price: 2500,
        level_required: 25,
        stats: { mining_speed: 3.0, durability: 500 }
    },
    
    // Weapons
    'iron_sword': {
        id: 'iron_sword',
        name: 'Iron Sword',
        description: 'Een scherp ijzeren zwaard voor PvP combat',
        category: 'weapons',
        price: 300,
        level_required: 10,
        stats: { damage: 25, durability: 150 }
    },
    'diamond_sword': {
        id: 'diamond_sword',
        name: 'Diamond Sword',
        description: 'Het krachtigste zwaard in SkaffaCity',
        category: 'weapons',
        price: 3000,
        level_required: 30,
        stats: { damage: 50, durability: 300 }
    },
    
    // Consumables
    'health_potion': {
        id: 'health_potion',
        name: 'Health Potion',
        description: 'Herstelt 50 HP onmiddellijk',
        category: 'consumables',
        price: 50,
        level_required: 1,
        stats: { heal_amount: 50 }
    },
    'energy_drink': {
        id: 'energy_drink',
        name: 'Energy Drink',
        description: 'Verhoogt mining snelheid voor 10 minuten',
        category: 'consumables', 
        price: 75,
        level_required: 3,
        stats: { speed_boost: 2.0, duration: 600 }
    },
    
    // Building Materials
    'steel_beam': {
        id: 'steel_beam',
        name: 'Steel Beam',
        description: 'Stalen balk voor het bouwen van structuren',
        category: 'building',
        price: 200,
        level_required: 15,
        stats: { strength: 100 }
    },
    
    // Special Items
    'faction_banner': {
        id: 'faction_banner',
        name: 'Faction Banner',
        description: 'Claim territorium voor je factie',
        category: 'special',
        price: 1000,
        level_required: 20,
        stats: { claim_radius: 50 }
    }
};

/**
 * Haal alle shop items op
 */
exports.getShopItems = async (req, res) => {
    try {
        const { category, maxPrice, minLevel } = req.query;
        
        let items = Object.values(SHOP_ITEMS);
        
        // Filter op category
        if (category) {
            items = items.filter(item => item.category === category);
        }
        
        // Filter op max price
        if (maxPrice) {
            items = items.filter(item => item.price <= parseInt(maxPrice));
        }
        
        // Filter op minimum level
        if (minLevel) {
            items = items.filter(item => item.level_required <= parseInt(minLevel));
        }
        
        // Groepeer per category
        const itemsByCategory = items.reduce((acc, item) => {
            if (!acc[item.category]) acc[item.category] = [];
            acc[item.category].push(item);
            return acc;
        }, {});
        
        res.json({
            status: 'success',
            count: items.length,
            data: {
                items: itemsByCategory,
                categories: [...new Set(items.map(item => item.category))]
            }
        });
        
    } catch (error) {
        console.error(`[ShopController] getShopItems error: ${error.message}`);
        res.status(500).json({
            status: 'error',
            message: 'Kon shop items niet ophalen'
        });
    }
};

/**
 * Koop item uit de shop
 */
exports.buyItem = async (req, res) => {
    try {
        const { itemId, quantity = 1, playerId } = req.body;
        const userId = req.user.id;
        
        // Valideer input
        if (!itemId || !playerId) {
            return res.status(400).json({
                status: 'error',
                message: 'Item ID en Player ID zijn vereist'
            });
        }
        
        // Check of item bestaat
        const item = SHOP_ITEMS[itemId];
        if (!item) {
            return res.status(404).json({
                status: 'error',
                message: 'Item niet gevonden in shop'
            });
        }
        
        // Verificeer player ownership
        const player = await Player.findById(playerId);
        if (!player || player.userId !== userId) {
            return res.status(403).json({
                status: 'error',
                message: 'Deze speler behoort niet tot jouw account'
            });
        }
        
        const totalPrice = item.price * quantity;
        
        // Begin transactie
        const connection = await db.getConnection();
        await connection.beginTransaction();
        
        try {
            // Haal gebruiker SKAFF op
            const [user] = await connection.query(
                'SELECT skaff FROM users WHERE id = ?',
                [userId]
            );
            
            if (!user) {
                await connection.rollback();
                connection.release();
                return res.status(404).json({
                    status: 'error',
                    message: 'Gebruiker niet gevonden'
                });
            }
            
            // Check level requirement (als player stats bestaan)
            const [playerStats] = await connection.query(
                'SELECT level FROM player_stats WHERE player_id = ?',
                [playerId]
            );
            
            if (playerStats && playerStats.level < item.level_required) {
                await connection.rollback();
                connection.release();
                return res.status(400).json({
                    status: 'error',
                    message: `Je hebt level ${item.level_required} nodig voor dit item`
                });
            }
            
            // Check of speler genoeg SKAFF heeft
            if (user.skaff < totalPrice) {
                await connection.rollback();
                connection.release();
                return res.status(400).json({
                    status: 'error',
                    message: `Niet genoeg SKAFF. Je hebt ${user.skaff}, maar dit kost ${totalPrice}`
                });
            }
            
            // Haal inventory op
            const [inventory] = await connection.query(
                'SELECT * FROM inventory WHERE player_id = ?',
                [playerId]
            );
            
            if (!inventory) {
                await connection.rollback();
                connection.release();
                return res.status(404).json({
                    status: 'error',
                    message: 'Inventory niet gevonden'
                });
            }
            
            // Check inventory ruimte
            const [itemCount] = await connection.query(
                'SELECT COUNT(*) as count FROM inventory_items WHERE inventory_id = ?',
                [inventory.id]
            );
            
            if (itemCount.count >= inventory.max_slots) {
                await connection.rollback();
                connection.release();
                return res.status(400).json({
                    status: 'error',
                    message: 'Inventory is vol'
                });
            }
            
            // Trekk SKAFF af
            await connection.query(
                'UPDATE users SET skaff = skaff - ? WHERE id = ?',
                [totalPrice, userId]
            );
            
            // Voeg item toe aan inventory
            const itemUuid = uuidv4();
            await connection.query(
                `INSERT INTO inventory_items (id, inventory_id, item_id, quantity, slot, metadata)
                 VALUES (?, ?, ?, ?, 
                    (SELECT COALESCE(MAX(slot), -1) + 1 FROM inventory_items WHERE inventory_id = ?),
                    ?)`,
                [itemUuid, inventory.id, itemId, quantity, inventory.id, JSON.stringify(item.stats || {})]
            );
            
            // Log transactie
            await connection.query(
                `INSERT INTO shop_transactions (id, user_id, player_id, item_id, quantity, total_price, transaction_type, created_at)
                 VALUES (UUID(), ?, ?, ?, ?, ?, 'purchase', NOW())`,
                [userId, playerId, itemId, quantity, totalPrice]
            );
            
            await connection.commit();
            connection.release();
            
            res.status(201).json({
                status: 'success',
                message: `Gekocht: ${quantity}x ${item.name}`,
                data: {
                    item: item.name,
                    quantity,
                    totalPrice,
                    newBalance: user.skaff - totalPrice
                }
            });
            
        } catch (error) {
            await connection.rollback();
            connection.release();
            throw error;
        }
        
    } catch (error) {
        console.error(`[ShopController] buyItem error: ${error.message}`);
        res.status(500).json({
            status: 'error',
            message: 'Kon item niet kopen'
        });
    }
};

/**
 * Verkoop item uit inventory
 */
exports.sellItem = async (req, res) => {
    try {
        const { inventoryItemId, quantity = 1 } = req.body;
        const userId = req.user.id;
        
        if (!inventoryItemId) {
            return res.status(400).json({
                status: 'error',
                message: 'Inventory item ID is vereist'
            });
        }
        
        const connection = await db.getConnection();
        await connection.beginTransaction();
        
        try {
            // Haal inventory item op
            const [inventoryItem] = await connection.query(
                `SELECT ii.*, i.player_id, p.user_id 
                 FROM inventory_items ii 
                 JOIN inventory i ON ii.inventory_id = i.id 
                 JOIN players p ON i.player_id = p.id 
                 WHERE ii.id = ? AND p.user_id = ?`,
                [inventoryItemId, userId]
            );
            
            if (!inventoryItem) {
                await connection.rollback();
                connection.release();
                return res.status(404).json({
                    status: 'error',
                    message: 'Item niet gevonden in je inventory'
                });
            }
            
            // Check quantity
            if (inventoryItem.quantity < quantity) {
                await connection.rollback();
                connection.release();
                return res.status(400).json({
                    status: 'error',
                    message: 'Je hebt niet genoeg van dit item'
                });
            }
            
            // Haal shop item info op
            const shopItem = SHOP_ITEMS[inventoryItem.item_id];
            if (!shopItem) {
                await connection.rollback();
                connection.release();
                return res.status(400).json({
                    status: 'error',
                    message: 'Dit item kan niet verkocht worden'
                });
            }
            
            // Bereken verkoop prijs (60% van shop prijs)
            const sellPrice = Math.floor(shopItem.price * 0.6) * quantity;
            
            // Update inventory item quantity of verwijder helemaal
            if (inventoryItem.quantity === quantity) {
                await connection.query(
                    'DELETE FROM inventory_items WHERE id = ?',
                    [inventoryItemId]
                );
            } else {
                await connection.query(
                    'UPDATE inventory_items SET quantity = quantity - ? WHERE id = ?',
                    [quantity, inventoryItemId]
                );
            }
            
            // Geef SKAFF
            await connection.query(
                'UPDATE users SET skaff = skaff + ? WHERE id = ?',
                [sellPrice, userId]
            );
            
            // Log transactie
            await connection.query(
                `INSERT INTO shop_transactions (id, user_id, player_id, item_id, quantity, total_price, transaction_type, created_at)
                 VALUES (UUID(), ?, ?, ?, ?, ?, 'sale', NOW())`,
                [userId, inventoryItem.player_id, inventoryItem.item_id, quantity, sellPrice]
            );
            
            await connection.commit();
            connection.release();
            
            res.json({
                status: 'success',
                message: `Verkocht: ${quantity}x ${shopItem.name}`,
                data: {
                    item: shopItem.name,
                    quantity,
                    sellPrice,
                    remaining: inventoryItem.quantity - quantity
                }
            });
            
        } catch (error) {
            await connection.rollback();
            connection.release();
            throw error;
        }
        
    } catch (error) {
        console.error(`[ShopController] sellItem error: ${error.message}`);
        res.status(500).json({
            status: 'error',
            message: 'Kon item niet verkopen'
        });
    }
};

/**
 * Haal shop transactie geschiedenis op
 */
exports.getShopHistory = async (req, res) => {
    try {
        const { playerId } = req.params;
        const { limit = 20, offset = 0 } = req.query;
        const userId = req.user.id;
        
        // Verificeer player ownership
        const player = await Player.findById(playerId);
        if (!player || player.userId !== userId) {
            return res.status(403).json({
                status: 'error',
                message: 'Deze speler behoort niet tot jouw account'
            });
        }
        
        const transactions = await db.query(
            `SELECT st.*, 
             CASE 
                WHEN st.transaction_type = 'purchase' THEN CONCAT('Gekocht: ', st.quantity, 'x ', st.item_id)
                WHEN st.transaction_type = 'sale' THEN CONCAT('Verkocht: ', st.quantity, 'x ', st.item_id)
             END as description
             FROM shop_transactions st 
             WHERE st.player_id = ? 
             ORDER BY st.created_at DESC 
             LIMIT ? OFFSET ?`,
            [playerId, parseInt(limit), parseInt(offset)]
        );
        
        // Enrich met item names
        const enrichedTransactions = transactions.map(transaction => ({
            ...transaction,
            itemName: SHOP_ITEMS[transaction.item_id]?.name || transaction.item_id,
            itemCategory: SHOP_ITEMS[transaction.item_id]?.category || 'unknown'
        }));
        
        res.json({
            status: 'success',
            count: enrichedTransactions.length,
            data: enrichedTransactions
        });
        
    } catch (error) {
        console.error(`[ShopController] getShopHistory error: ${error.message}`);
        res.status(500).json({
            status: 'error',
            message: 'Kon shop geschiedenis niet ophalen'
        });
    }
};

module.exports = {
    getShopItems: exports.getShopItems,
    buyItem: exports.buyItem,
    sellItem: exports.sellItem,
    getShopHistory: exports.getShopHistory
};