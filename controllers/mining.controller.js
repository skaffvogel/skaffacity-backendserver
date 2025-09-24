/**
 * Mining controller voor mining operaties
 */

const { v4: uuidv4 } = require('uuid');
const db = require('../utils/db');
const User = require('../models/user.mysql');
const Player = require('../models/player.mysql');

// Mining locations configuratie
const MINING_LOCATIONS = {
    'iron_mine': {
        id: 'iron_mine',
        name: 'Iron Mine',
        position: { x: 200, y: 10, z: -150 },
        resources: ['raw_iron', 'coal'],
        difficulty: 1,
        respawnTime: 300000 // 5 minuten in ms
    },
    'gold_mine': {
        id: 'gold_mine', 
        name: 'Gold Mine',
        position: { x: -300, y: 15, z: 200 },
        resources: ['raw_gold', 'precious_gems'],
        difficulty: 3,
        respawnTime: 900000 // 15 minuten
    },
    'diamond_cave': {
        id: 'diamond_cave',
        name: 'Diamond Cave', 
        position: { x: 500, y: -20, z: -400 },
        resources: ['raw_diamond', 'rare_crystals'],
        difficulty: 5,
        respawnTime: 1800000 // 30 minuten
    }
};

// Mining rewards gebaseerd op difficulty
const MINING_REWARDS = {
    1: { skaff: [5, 15], xp: [10, 25] },
    2: { skaff: [15, 30], xp: [25, 50] },
    3: { skaff: [30, 60], xp: [50, 100] },
    4: { skaff: [60, 120], xp: [100, 200] },
    5: { skaff: [120, 250], xp: [200, 400] }
};

/**
 * Haal alle mining locaties op
 */
exports.getMiningLocations = async (req, res) => {
    try {
        const locations = Object.values(MINING_LOCATIONS);
        
        res.json({
            status: 'success',
            count: locations.length,
            data: locations
        });
    } catch (error) {
        console.error(`[MiningController] getMiningLocations error: ${error.message}`);
        res.status(500).json({
            status: 'error',
            message: 'Kon mining locaties niet ophalen'
        });
    }
};

/**
 * Start mining sessie
 */
exports.startMining = async (req, res) => {
    try {
        const { locationId, playerId } = req.body;
        const userId = req.user.id;

        // Valideer input
        if (!locationId || !playerId) {
            return res.status(400).json({
                status: 'error',
                message: 'Location ID en Player ID zijn vereist'
            });
        }

        // Check mining location
        const location = MINING_LOCATIONS[locationId];
        if (!location) {
            return res.status(404).json({
                status: 'error',
                message: 'Mining locatie niet gevonden'
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

        // Check of speler al aan het minen is
        const [existingSession] = await db.query(
            'SELECT * FROM mining_sessions WHERE player_id = ? AND status = "active"',
            [playerId]
        );

        if (existingSession) {
            return res.status(400).json({
                status: 'error',
                message: 'Je bent al aan het minen op een andere locatie'
            });
        }

        // Start nieuwe mining sessie
        const sessionId = uuidv4();
        const startTime = new Date();
        const estimatedDuration = 60000 + (location.difficulty * 30000); // Base 1 min + difficulty

        await db.query(
            `INSERT INTO mining_sessions 
             (id, player_id, location_id, status, start_time, estimated_end_time)
             VALUES (?, ?, ?, 'active', ?, ?)`,
            [sessionId, playerId, locationId, startTime, new Date(startTime.getTime() + estimatedDuration)]
        );

        res.status(201).json({
            status: 'success',
            message: 'Mining sessie gestart',
            data: {
                sessionId,
                location: location.name,
                estimatedDuration,
                difficulty: location.difficulty
            }
        });

    } catch (error) {
        console.error(`[MiningController] startMining error: ${error.message}`);
        res.status(500).json({
            status: 'error',
            message: 'Kon mining sessie niet starten'
        });
    }
};

/**
 * Voltooi mining sessie en claim rewards
 */
exports.completeMining = async (req, res) => {
    try {
        const { sessionId } = req.params;
        const userId = req.user.id;

        // Haal mining sessie op
        const [session] = await db.query(
            `SELECT ms.*, p.user_id 
             FROM mining_sessions ms 
             JOIN players p ON ms.player_id = p.id 
             WHERE ms.id = ? AND ms.status = "active"`,
            [sessionId]
        );

        if (!session) {
            return res.status(404).json({
                status: 'error',
                message: 'Mining sessie niet gevonden of al voltooid'
            });
        }

        // Verificeer ownership
        if (session.user_id !== userId) {
            return res.status(403).json({
                status: 'error',
                message: 'Deze mining sessie behoort niet tot jouw account'
            });
        }

        const location = MINING_LOCATIONS[session.location_id];
        const currentTime = new Date();
        const sessionDuration = currentTime - new Date(session.start_time);
        const minDuration = 30000; // Minimum 30 seconden

        if (sessionDuration < minDuration) {
            return res.status(400).json({
                status: 'error',
                message: 'Mining sessie is nog niet lang genoeg bezig'
            });
        }

        // Bereken rewards
        const rewardData = MINING_REWARDS[location.difficulty];
        const skaffReward = Math.floor(Math.random() * (rewardData.skaff[1] - rewardData.skaff[0])) + rewardData.skaff[0];
        const xpReward = Math.floor(Math.random() * (rewardData.xp[1] - rewardData.xp[0])) + rewardData.xp[0];

        // Random resource from location
        const randomResource = location.resources[Math.floor(Math.random() * location.resources.length)];
        const resourceQuantity = Math.floor(Math.random() * 3) + 1; // 1-3 items

        // Begin transactie
        const connection = await db.getConnection();
        await connection.beginTransaction();

        try {
            // Update mining sessie
            await connection.query(
                'UPDATE mining_sessions SET status = "completed", end_time = ?, rewards_claimed = 1 WHERE id = ?',
                [currentTime, sessionId]
            );

            // Geef SKAFF reward
            await connection.query(
                'UPDATE users SET skaff = skaff + ? WHERE id = ?',
                [skaffReward, userId]
            );

            // Update mining XP
            await connection.query(
                `INSERT INTO player_stats (player_id, mining_xp) 
                 VALUES (?, ?) 
                 ON DUPLICATE KEY UPDATE mining_xp = mining_xp + ?`,
                [session.player_id, xpReward, xpReward]
            );

            // Voeg item toe aan inventory
            const [inventory] = await connection.query(
                'SELECT * FROM inventory WHERE player_id = ?',
                [session.player_id]
            );

            if (inventory) {
                await connection.query(
                    `INSERT INTO inventory_items (id, inventory_id, item_id, quantity, slot)
                     VALUES (UUID(), ?, ?, ?, 
                        (SELECT COALESCE(MAX(slot), -1) + 1 FROM inventory_items WHERE inventory_id = ?))`,
                    [inventory.id, randomResource, resourceQuantity, inventory.id]
                );
            }

            await connection.commit();
            connection.release();

            res.json({
                status: 'success',
                message: 'Mining voltooid!',
                data: {
                    location: location.name,
                    rewards: {
                        skaff: skaffReward,
                        xp: xpReward,
                        item: randomResource,
                        quantity: resourceQuantity
                    },
                    duration: Math.floor(sessionDuration / 1000)
                }
            });

        } catch (error) {
            await connection.rollback();
            connection.release();
            throw error;
        }

    } catch (error) {
        console.error(`[MiningController] completeMining error: ${error.message}`);
        res.status(500).json({
            status: 'error',
            message: 'Kon mining sessie niet voltooien'
        });
    }
};

/**
 * Check mining status van een speler
 */
exports.getMiningStatus = async (req, res) => {
    try {
        const { playerId } = req.params;
        const userId = req.user.id;

        // Verificeer player ownership
        const player = await Player.findById(playerId);
        if (!player || player.userId !== userId) {
            return res.status(403).json({
                status: 'error',
                message: 'Deze speler behoort niet tot jouw account'
            });
        }

        const [session] = await db.query(
            'SELECT * FROM mining_sessions WHERE player_id = ? AND status = "active"',
            [playerId]
        );

        if (!session) {
            return res.json({
                status: 'success',
                data: {
                    isMining: false,
                    message: 'Niet aan het minen'
                }
            });
        }

        const location = MINING_LOCATIONS[session.location_id];
        const currentTime = new Date();
        const startTime = new Date(session.start_time);
        const estimatedEndTime = new Date(session.estimated_end_time);
        
        const elapsedTime = currentTime - startTime;
        const totalTime = estimatedEndTime - startTime;
        const progress = Math.min((elapsedTime / totalTime) * 100, 100);

        res.json({
            status: 'success',
            data: {
                isMining: true,
                sessionId: session.id,
                location: location.name,
                progress: Math.floor(progress),
                timeRemaining: Math.max(0, Math.floor((estimatedEndTime - currentTime) / 1000)),
                canComplete: elapsedTime >= 30000
            }
        });

    } catch (error) {
        console.error(`[MiningController] getMiningStatus error: ${error.message}`);
        res.status(500).json({
            status: 'error',
            message: 'Kon mining status niet ophalen'
        });
    }
};

module.exports = {
    getMiningLocations: exports.getMiningLocations,
    startMining: exports.startMining,
    completeMining: exports.completeMining,
    getMiningStatus: exports.getMiningStatus
};