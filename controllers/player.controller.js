/**
 * Player controller (Sequelize versie)
 */

const { User, Player } = require('../models');
const { v4: uuidv4 } = require('uuid');

function ensureModels(req, res) {
    if (!User || !Player) {
        res.status(503).json({ status:'error', message:'Models niet beschikbaar (Sequelize niet geïnitialiseerd)' });
        return false;
    }
    return true;
}

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
exports.registerPlayer = async (req, res) => {
    try {
        if (!ensureModels(req, res)) return;
        const { id, position, rotation, health, maxHealth, factionId, username, user_id, userId } = req.body;
        if (!id || !position || !rotation) {
            return res.status(400).json({ status:'error', message:'Missende vereiste velden' });
        }

        // Bestaande speler?
        let existing = await Player.findByPk(id);
        if (existing) {
            await existing.update({
                position_x: position[0], position_y: position[1], position_z: position[2],
                rotation_x: rotation[0], rotation_y: rotation[1], rotation_z: rotation[2],
                health: (health ?? existing.health),
                max_health: (maxHealth ?? existing.max_health),
                faction_id: (factionId !== undefined ? factionId : existing.faction_id),
                updated_at: new Date()
            });
            existing = await Player.findByPk(id);
            return res.status(200).json({ status:'success', message:'Speler succesvol bijgewerkt', player: mapPlayer(existing) });
        }

        // Koppel gebruiker
        const effectiveUsername = username || id;
        let user = null;
        const incomingUserId = user_id || userId; // compat
        if (incomingUserId) {
            user = await User.findByPk(incomingUserId);
        }
        if (!user) {
            user = await User.findOne({ where: { username: effectiveUsername } });
        }
        if (!user) {
            return res.status(404).json({ status:'error', message:'Gebruiker niet gevonden' });
        }

        // Maak nieuwe speler
        const newPlayer = await Player.create({
            id: id.length > 36 ? uuidv4() : id, // safeguard voor te lange device identifiers
            user_id: user.id,
            username: effectiveUsername,
            faction_id: factionId || 0,
            health: health || 100,
            max_health: maxHealth || 100,
            position_x: position[0], position_y: position[1], position_z: position[2],
            rotation_x: rotation[0], rotation_y: rotation[1], rotation_z: rotation[2],
            created_at: new Date()
        });
        return res.status(201).json({ status:'success', message:'Speler succesvol geregistreerd', player: mapPlayer(newPlayer) });
    } catch (e) {
        console.error('[PlayerController][Sequelize] registerPlayer error:', e.message);
        return res.status(500).json({ status:'error', message:'Serverfout bij registreren speler' });
    }
};

// Update positie
exports.updatePosition = async (req, res) => {
    try {
        if (!ensureModels(req, res)) return;
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
        if (!ensureModels(req, res)) return;
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
        if (!ensureModels(req, res)) return;
        const exclude = req.query.exclude;
        const players = await Player.findAll();
        const mapped = players
            .filter(p => !exclude || p.id !== exclude)
            .map(mapPlayer);
        return res.status(200).json(mapped);
    } catch(e) {
        console.error('[PlayerController][Sequelize] getAllPlayers error:', e.message);
        return res.status(500).json({ status:'error', message:'Serverfout' });
    }
};

// Speler op ID
exports.getPlayerById = async (req, res) => {
    try {
        if (!ensureModels(req, res)) return;
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
        if (!ensureModels(req, res)) return;
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