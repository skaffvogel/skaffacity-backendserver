/**
 * Faction Wars controller voor PvP, territorium en faction management
 */

const { v4: uuidv4 } = require('uuid');
const db = require('../utils/db');
const User = require('../models/user.mysql');
const Player = require('../models/player.mysql');

/**
 * Haal alle facties op
 */
exports.getFactions = async (req, res) => {
    try {
        const { includeStats = true } = req.query;
        
        let query = `
            SELECT f.*,
                   COUNT(p.id) as member_count,
                   COALESCE(SUM(ps.kills), 0) as total_kills,
                   COALESCE(AVG(ps.level), 1) as avg_level
            FROM factions f
            LEFT JOIN players p ON f.id = p.faction_id
            LEFT JOIN player_stats ps ON p.id = ps.player_id
            GROUP BY f.id
            ORDER BY total_kills DESC, member_count DESC
        `;
        
        const factions = await db.query(query);
        
        // Haal territorium informatie op als gewenst
        if (includeStats === 'true') {
            for (let faction of factions) {
                const territories = await db.query(
                    'SELECT COUNT(*) as count FROM territories WHERE faction_id = ?',
                    [faction.id]
                );
                
                const activeWars = await db.query(
                    `SELECT COUNT(*) as count FROM faction_wars 
                     WHERE (faction_a = ? OR faction_b = ?) AND status = 'active'`,
                    [faction.id, faction.id]
                );
                
                faction.territory_count = territories[0]?.count || 0;
                faction.active_wars = activeWars[0]?.count || 0;
            }
        }
        
        res.json({
            status: 'success',
            count: factions.length,
            data: factions
        });
        
    } catch (error) {
        console.error(`[FactionWarsController] getFactions error: ${error.message}`);
        res.status(500).json({
            status: 'error',
            message: 'Kon facties niet ophalen'
        });
    }
};

/**
 * Creëer nieuwe factie
 */
exports.createFaction = async (req, res) => {
    try {
        const { name, description, playerId } = req.body;
        const userId = req.user.id;
        
        // Valideer input
        if (!name || !playerId) {
            return res.status(400).json({
                status: 'error',
                message: 'Naam en speler ID zijn vereist'
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
        
        // Check of speler al in een factie zit
        if (player.factionId) {
            return res.status(400).json({
                status: 'error',
                message: 'Je zit al in een factie. Verlaat eerst je huidige factie.'
            });
        }
        
        const connection = await db.getConnection();
        await connection.beginTransaction();
        
        try {
            // Check of faction naam al bestaat
            const [existingFaction] = await connection.query(
                'SELECT id FROM factions WHERE name = ?',
                [name]
            );
            
            if (existingFaction) {
                await connection.rollback();
                connection.release();
                return res.status(400).json({
                    status: 'error',
                    message: 'Deze factie naam is al in gebruik'
                });
            }
            
            // Creëer factie
            const factionId = uuidv4();
            await connection.query(
                `INSERT INTO factions (id, name, description, leader_id, created_at)
                 VALUES (?, ?, ?, ?, NOW())`,
                [factionId, name, description || '', playerId]
            );
            
            // Voeg speler toe als leader
            await connection.query(
                'UPDATE players SET faction_id = ?, faction_role = ? WHERE id = ?',
                [factionId, 'leader', playerId]
            );
            
            await connection.commit();
            connection.release();
            
            res.status(201).json({
                status: 'success',
                message: `Factie '${name}' succesvol aangemaakt`,
                data: {
                    factionId,
                    name,
                    role: 'leader'
                }
            });
            
        } catch (error) {
            await connection.rollback();
            connection.release();
            throw error;
        }
        
    } catch (error) {
        console.error(`[FactionWarsController] createFaction error: ${error.message}`);
        res.status(500).json({
            status: 'error',
            message: 'Kon factie niet aanmaken'
        });
    }
};

/**
 * Word lid van een factie
 */
exports.joinFaction = async (req, res) => {
    try {
        const { factionId, playerId } = req.body;
        const userId = req.user.id;
        
        // Verificeer player ownership
        const player = await Player.findById(playerId);
        if (!player || player.userId !== userId) {
            return res.status(403).json({
                status: 'error',
                message: 'Deze speler behoort niet tot jouw account'
            });
        }
        
        // Check of speler al in een factie zit
        if (player.factionId) {
            return res.status(400).json({
                status: 'error',
                message: 'Je zit al in een factie. Verlaat eerst je huidige factie.'
            });
        }
        
        // Check of factie bestaat
        const faction = await db.query(
            'SELECT * FROM factions WHERE id = ?',
            [factionId]
        );
        
        if (!faction.length) {
            return res.status(404).json({
                status: 'error',
                message: 'Factie niet gevonden'
            });
        }
        
        // Voeg speler toe aan factie
        await db.query(
            'UPDATE players SET faction_id = ?, faction_role = ? WHERE id = ?',
            [factionId, 'member', playerId]
        );
        
        res.json({
            status: 'success',
            message: `Je bent nu lid van factie '${faction[0].name}'`,
            data: {
                factionId,
                factionName: faction[0].name,
                role: 'member'
            }
        });
        
    } catch (error) {
        console.error(`[FactionWarsController] joinFaction error: ${error.message}`);
        res.status(500).json({
            status: 'error',
            message: 'Kon niet lid worden van factie'
        });
    }
};

/**
 * Verlaat factie
 */
exports.leaveFaction = async (req, res) => {
    try {
        const { playerId } = req.body;
        const userId = req.user.id;
        
        // Verificeer player ownership
        const player = await Player.findById(playerId);
        if (!player || player.userId !== userId) {
            return res.status(403).json({
                status: 'error',
                message: 'Deze speler behoort niet tot jouw account'
            });
        }
        
        if (!player.factionId) {
            return res.status(400).json({
                status: 'error',
                message: 'Je zit niet in een factie'
            });
        }
        
        const connection = await db.getConnection();
        await connection.beginTransaction();
        
        try {
            // Check of speler leader is
            const [faction] = await connection.query(
                'SELECT * FROM factions WHERE id = ? AND leader_id = ?',
                [player.factionId, playerId]
            );
            
            if (faction) {
                // Check of er andere leden zijn om leadership over te dragen
                const [otherMembers] = await connection.query(
                    'SELECT * FROM players WHERE faction_id = ? AND id != ? LIMIT 1',
                    [player.factionId, playerId]
                );
                
                if (otherMembers) {
                    // Draag leadership over
                    await connection.query(
                        'UPDATE factions SET leader_id = ? WHERE id = ?',
                        [otherMembers.id, player.factionId]
                    );
                    
                    await connection.query(
                        'UPDATE players SET faction_role = ? WHERE id = ?',
                        ['leader', otherMembers.id]
                    );
                } else {
                    // Verwijder factie als geen andere leden
                    await connection.query('DELETE FROM factions WHERE id = ?', [player.factionId]);
                }
            }
            
            // Verwijder speler uit factie
            await connection.query(
                'UPDATE players SET faction_id = NULL, faction_role = NULL WHERE id = ?',
                [playerId]
            );
            
            await connection.commit();
            connection.release();
            
            res.json({
                status: 'success',
                message: 'Je hebt de factie verlaten'
            });
            
        } catch (error) {
            await connection.rollback();
            connection.release();
            throw error;
        }
        
    } catch (error) {
        console.error(`[FactionWarsController] leaveFaction error: ${error.message}`);
        res.status(500).json({
            status: 'error',
            message: 'Kon factie niet verlaten'
        });
    }
};

/**
 * Declareer oorlog tegen andere factie
 */
exports.declareWar = async (req, res) => {
    try {
        const { targetFactionId, playerId, reason } = req.body;
        const userId = req.user.id;
        
        // Verificeer player ownership
        const player = await Player.findById(playerId);
        if (!player || player.userId !== userId) {
            return res.status(403).json({
                status: 'error',
                message: 'Deze speler behoort niet tot jouw account'
            });
        }
        
        // Check of speler leader is
        if (!player.factionId || player.factionRole !== 'leader') {
            return res.status(403).json({
                status: 'error',
                message: 'Alleen faction leaders kunnen oorlog declareren'
            });
        }
        
        // Check of target factie bestaat
        const [targetFaction] = await db.query(
            'SELECT * FROM factions WHERE id = ?',
            [targetFactionId]
        );
        
        if (!targetFaction) {
            return res.status(404).json({
                status: 'error',
                message: 'Doel factie niet gevonden'
            });
        }
        
        // Check of al oorlog is
        const [existingWar] = await db.query(
            `SELECT * FROM faction_wars 
             WHERE ((faction_a = ? AND faction_b = ?) OR (faction_a = ? AND faction_b = ?))
             AND status = 'active'`,
            [player.factionId, targetFactionId, targetFactionId, player.factionId]
        );
        
        if (existingWar) {
            return res.status(400).json({
                status: 'error',
                message: 'Er is al een actieve oorlog tussen deze facties'
            });
        }
        
        // Start oorlog
        const warId = uuidv4();
        await db.query(
            `INSERT INTO faction_wars (id, faction_a, faction_b, declared_by, reason, status, started_at, ends_at)
             VALUES (?, ?, ?, ?, ?, 'active', NOW(), DATE_ADD(NOW(), INTERVAL 7 DAY))`,
            [warId, player.factionId, targetFactionId, playerId, reason || 'Geen reden opgegeven']
        );
        
        res.status(201).json({
            status: 'success',
            message: `Oorlog gedeclareerd tegen '${targetFaction.name}'`,
            data: {
                warId,
                targetFaction: targetFaction.name,
                duration: '7 dagen'
            }
        });
        
    } catch (error) {
        console.error(`[FactionWarsController] declareWar error: ${error.message}`);
        res.status(500).json({
            status: 'error',
            message: 'Kon oorlog niet declareren'
        });
    }
};

/**
 * Registreer kill in faction war
 */
exports.registerKill = async (req, res) => {
    try {
        const { killerPlayerId, victimPlayerId, location } = req.body;
        const userId = req.user.id;
        
        // Verificeer killer ownership
        const killer = await Player.findById(killerPlayerId);
        if (!killer || killer.userId !== userId) {
            return res.status(403).json({
                status: 'error',
                message: 'Deze speler behoort niet tot jouw account'
            });
        }
        
        // Haal victim info op
        const victim = await Player.findById(victimPlayerId);
        if (!victim) {
            return res.status(404).json({
                status: 'error',
                message: 'Slachtoffer speler niet gevonden'
            });
        }
        
        // Check of beide spelers in verschillende facties zitten
        if (!killer.factionId || !victim.factionId || killer.factionId === victim.factionId) {
            return res.status(400).json({
                status: 'error',
                message: 'PvP kills tellen alleen tussen vijandige facties'
            });
        }
        
        // Check of er een actieve oorlog is
        const [war] = await db.query(
            `SELECT * FROM faction_wars 
             WHERE ((faction_a = ? AND faction_b = ?) OR (faction_a = ? AND faction_b = ?))
             AND status = 'active' AND ends_at > NOW()`,
            [killer.factionId, victim.factionId, victim.factionId, killer.factionId]
        );
        
        const connection = await db.getConnection();
        await connection.beginTransaction();
        
        try {
            // Registreer kill
            const killId = uuidv4();
            await connection.query(
                `INSERT INTO faction_kills (id, war_id, killer_id, victim_id, location, created_at)
                 VALUES (?, ?, ?, ?, ?, NOW())`,
                [killId, war?.id || null, killerPlayerId, victimPlayerId, location || 'Unknown']
            );
            
            // Update killer stats
            await connection.query(
                `INSERT INTO player_stats (player_id, kills, deaths, experience, level, last_updated)
                 VALUES (?, 1, 0, 50, 1, NOW())
                 ON DUPLICATE KEY UPDATE 
                    kills = kills + 1,
                    experience = experience + 50,
                    level = GREATEST(level, FLOOR((experience + 50) / 100) + 1),
                    last_updated = NOW()`,
                [killerPlayerId]
            );
            
            // Update victim stats  
            await connection.query(
                `INSERT INTO player_stats (player_id, kills, deaths, experience, level, last_updated)
                 VALUES (?, 0, 1, 0, 1, NOW())
                 ON DUPLICATE KEY UPDATE 
                    deaths = deaths + 1,
                    experience = GREATEST(0, experience - 25),
                    last_updated = NOW()`,
                [victimPlayerId]
            );
            
            // Beloon killer met SKAFF
            await connection.query(
                'UPDATE users SET skaff = skaff + ? WHERE id = ?',
                [war ? 100 : 25, userId] // Meer SKAFF voor oorlog kills
            );
            
            await connection.commit();
            connection.release();
            
            res.status(201).json({
                status: 'success',
                message: war ? 'Oorlog kill geregistreerd!' : 'PvP kill geregistreerd!',
                data: {
                    killId,
                    skaffReward: war ? 100 : 25,
                    experienceReward: 50,
                    warKill: !!war
                }
            });
            
        } catch (error) {
            await connection.rollback();
            connection.release();
            throw error;
        }
        
    } catch (error) {
        console.error(`[FactionWarsController] registerKill error: ${error.message}`);
        res.status(500).json({
            status: 'error',
            message: 'Kon kill niet registreren'
        });
    }
};

/**
 * Claim territorium voor factie
 */
exports.claimTerritory = async (req, res) => {
    try {
        const { playerId, name, x, y, radius = 50 } = req.body;
        const userId = req.user.id;
        
        // Verificeer player ownership
        const player = await Player.findById(playerId);
        if (!player || player.userId !== userId) {
            return res.status(403).json({
                status: 'error',
                message: 'Deze speler behoort niet tot jouw account'
            });
        }
        
        if (!player.factionId) {
            return res.status(400).json({
                status: 'error',
                message: 'Je moet lid zijn van een factie om territorium te claimen'
            });
        }
        
        // Check of locatie al geclaimd is
        const [existingTerritory] = await db.query(
            `SELECT * FROM territories 
             WHERE SQRT(POW(x - ?, 2) + POW(y - ?, 2)) < (radius + ?)`,
            [x, y, radius]
        );
        
        if (existingTerritory) {
            return res.status(400).json({
                status: 'error',
                message: 'Dit gebied overlapt met bestaand territorium'
            });
        }
        
        // Check of speler faction banner heeft
        const [bannerItem] = await db.query(
            `SELECT ii.* FROM inventory_items ii
             JOIN inventory i ON ii.inventory_id = i.id
             WHERE i.player_id = ? AND ii.item_id = 'faction_banner' AND ii.quantity > 0`,
            [playerId]
        );
        
        if (!bannerItem) {
            return res.status(400).json({
                status: 'error',
                message: 'Je hebt een Faction Banner nodig om territorium te claimen'
            });
        }
        
        const connection = await db.getConnection();
        await connection.beginTransaction();
        
        try {
            // Claim territorium
            const territoryId = uuidv4();
            await connection.query(
                `INSERT INTO territories (id, faction_id, name, x, y, radius, claimed_by, claimed_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
                [territoryId, player.factionId, name, x, y, radius, playerId]
            );
            
            // Verbruik banner
            await connection.query(
                'UPDATE inventory_items SET quantity = quantity - 1 WHERE id = ?',
                [bannerItem.id]
            );
            
            // Verwijder item als quantity 0
            await connection.query(
                'DELETE FROM inventory_items WHERE id = ? AND quantity <= 0',
                [bannerItem.id]
            );
            
            await connection.commit();
            connection.release();
            
            res.status(201).json({
                status: 'success',
                message: `Territorium '${name}' geclaimd voor je factie`,
                data: {
                    territoryId,
                    name,
                    coordinates: { x, y },
                    radius
                }
            });
            
        } catch (error) {
            await connection.rollback();
            connection.release();
            throw error;
        }
        
    } catch (error) {
        console.error(`[FactionWarsController] claimTerritory error: ${error.message}`);
        res.status(500).json({
            status: 'error',
            message: 'Kon territorium niet claimen'
        });
    }
};

/**
 * Haal territorium kaart op
 */
exports.getTerritoryMap = async (req, res) => {
    try {
        const { minX, maxX, minY, maxY } = req.query;
        
        let query = `
            SELECT t.*, f.name as faction_name, f.color as faction_color,
                   COUNT(p.id) as faction_members
            FROM territories t
            JOIN factions f ON t.faction_id = f.id
            LEFT JOIN players p ON f.id = p.faction_id
        `;
        
        const params = [];
        
        if (minX && maxX && minY && maxY) {
            query += ` WHERE t.x BETWEEN ? AND ? AND t.y BETWEEN ? AND ?`;
            params.push(minX, maxX, minY, maxY);
        }
        
        query += ` GROUP BY t.id ORDER BY t.claimed_at DESC`;
        
        const territories = await db.query(query, params);
        
        res.json({
            status: 'success',
            count: territories.length,
            data: territories
        });
        
    } catch (error) {
        console.error(`[FactionWarsController] getTerritoryMap error: ${error.message}`);
        res.status(500).json({
            status: 'error',
            message: 'Kon territorium kaart niet ophalen'
        });
    }
};

module.exports = {
    getFactions: exports.getFactions,
    createFaction: exports.createFaction,
    joinFaction: exports.joinFaction,
    leaveFaction: exports.leaveFaction,
    declareWar: exports.declareWar,
    registerKill: exports.registerKill,
    claimTerritory: exports.claimTerritory,
    getTerritoryMap: exports.getTerritoryMap
};