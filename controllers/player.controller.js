/**
 * Player controller (PURE SEQUELIZE MODE)
 */

const models = require('../models');
const { v4: uuidv4 } = require('uuid');

function mapPlayer(p) {
    return {
        id: p.id,
        username: p.username,
        position: [p.position_x, p.position_y, p.position_z],
        rotation: [p.rotation_x, p.rotation_y, p.rotation_z],
        health: p.health,
        maxHealth: p.max_health,
        factionId: p.faction_id || 0
    };
}

// Registreer (of update) speler
// Deprecated: speler wordt aangemaakt bij /auth/register. Idempotent update/create voor oude clients.
exports.registerPlayer = async (req, res) => {
    try {
        const Player = models.Player;
        const User = models.User;
        const { id, position, rotation, health, maxHealth, factionId } = req.body;
        if (!id) return res.status(400).json({ status:'error', message:'ID vereist' });
        let player = await Player.findByPk(id);
        if (!player) {
            // probeer via user koppeling (req.user) indien player ontbreekt
            if (!req.user || req.user.playerId !== id) {
                return res.status(409).json({ status:'error', message:'Speler bestaat niet (gebruik /auth/register flow)' });
            }
            player = await Player.findByPk(req.user.playerId);
        }
        if (!player) return res.status(404).json({ status:'error', message:'Speler niet gevonden' });
        if (position && rotation) {
            await player.update({
                position_x: position[0], position_y: position[1], position_z: position[2],
                rotation_x: rotation[0], rotation_y: rotation[1], rotation_z: rotation[2],
                health: (health ?? player.health),
                max_health: (maxHealth ?? player.max_health),
                faction_id: (factionId !== undefined ? factionId : player.faction_id),
                updated_at: new Date()
            });
            player = await Player.findByPk(player.id);
        }
        res.setHeader('Warning', '299 - "Deprecated endpoint: speler wordt automatisch aangemaakt"');
        return res.status(200).json({ status:'success', message:'Speler bestaand (of bijgewerkt)', player: mapPlayer(player), deprecated:true });
    } catch (e) {
        console.error('[PlayerController] registerPlayer error:', e.message);
        return res.status(500).json({ status:'error', message:'Serverfout' });
    }
};

// Update positie
exports.updatePosition = async (req, res) => {
    try {
        const Player = models.Player;
        const { id, position, rotation } = req.body;
        if (!id || !position || !rotation) return res.status(400).json({ status:'error', message:'Missende velden' });
        const player = await Player.findByPk(id);
        if (!player) return res.status(404).json({ status:'error', message:'Speler niet gevonden' });
        await player.update({
            position_x: position[0], position_y: position[1], position_z: position[2],
            rotation_x: rotation[0], rotation_y: rotation[1], rotation_z: rotation[2],
            updated_at: new Date()
        });
        return res.status(200).json({ status:'success' });
    } catch(e) {
        console.error('[PlayerController][Sequelize] updatePosition error:', e.message);
        return res.status(500).json({ status:'error', message:'Serverfout' });
    }
};

// Update attributen
exports.updateAttributes = async (req, res) => {
    try {
        const Player = models.Player;
        const { id, health, maxHealth, factionId } = req.body;
        if (!id) return res.status(400).json({ status:'error', message:'Speler ID vereist' });
        const player = await Player.findByPk(id);
        if (!player) return res.status(404).json({ status:'error', message:'Speler niet gevonden' });
        await player.update({
            health: (health !== undefined ? health : player.health),
            max_health: (maxHealth !== undefined ? maxHealth : player.max_health),
            faction_id: (factionId !== undefined ? factionId : player.faction_id),
            updated_at: new Date()
        });
        return res.status(200).json({ status:'success' });
    } catch(e) {
        console.error('[PlayerController][Sequelize] updateAttributes error:', e.message);
        return res.status(500).json({ status:'error', message:'Serverfout' });
    }
};

// Alle spelers (optioneel filter)
exports.getAllPlayers = async (req, res) => {
    try {
        const Player = models.Player;
        const exclude = req.query.exclude;
        const players = await Player.findAll();
        const mapped = players
            .filter(p => !exclude || p.id !== exclude)
            .map(mapPlayer);
    return res.status(200).json({ players: mapped });
    } catch(e) {
        console.error('[PlayerController][Sequelize] getAllPlayers error:', e.message);
        return res.status(500).json({ status:'error', message:'Serverfout' });
    }
};

// Speler op ID
exports.getPlayerById = async (req, res) => {
    try {
        const Player = models.Player;
        const player = await Player.findByPk(req.params.id);
        if (!player) return res.status(404).json({ status:'error', message:'Speler niet gevonden' });
        return res.status(200).json(mapPlayer(player));
    } catch(e) {
        console.error('[PlayerController][Sequelize] getPlayerById error:', e.message);
        return res.status(500).json({ status:'error', message:'Serverfout' });
    }
};

// Verwijder speler (admin check simplistisch)
exports.deletePlayer = async (req, res) => {
    try {
        const Player = models.Player;
        if (!req.user || req.user.role !== 'admin') {
            return res.status(403).json({ status:'error', message:'Geen toestemming' });
        }
        const deleted = await Player.destroy({ where: { id: req.params.id } });
        if (!deleted) return res.status(404).json({ status:'error', message:'Speler niet gevonden' });
        return res.status(200).json({ status:'success', message:'Speler verwijderd' });
    } catch(e) {
        console.error('[PlayerController][Sequelize] deletePlayer error:', e.message);
        return res.status(500).json({ status:'error', message:'Serverfout' });
    }
};