/**
 * Faction controller voor factie beheer
 */

const Faction = require('./models/faction.mysql');
const Player = require('./models/player.mysql');
const User = require('./models/user.mysql');

/**
 * Krijg alle actieve facties
 */
exports.getAllFactions = async (req, res) => {
    try {
        const factions = await Faction.find({ isActive: true })
            .select('factionId name description color memberCount baseLocation safeZoneRadius');
        
        res.status(200).json({
            status: 'success',
            data: factions
        });
    } catch (error) {
        console.error(`[FactionController] getAllFactions error: ${error.message}`);
        res.status(500).json({ 
            status: 'error', 
            message: 'Er is een serverfout opgetreden' 
        });
    }
};

/**
 * Krijg specifieke factie op ID
 */
exports.getFactionById = async (req, res) => {
    try {
        const { id } = req.params;
        
        // Controleer of ID een nummer is of niet
        const query = Number.isInteger(parseInt(id)) 
            ? { factionId: parseInt(id) } 
            : { id: id };
        
        const faction = await Faction.findOne(query);
        
        if (!faction) {
            return res.status(404).json({
                status: 'error',
                message: 'Factie niet gevonden'
            });
        }
        
        res.status(200).json({
            status: 'success',
            data: faction
        });
    } catch (error) {
        console.error(`[FactionController] getFactionById error: ${error.message}`);
        res.status(500).json({ 
            status: 'error', 
            message: 'Er is een serverfout opgetreden' 
        });
    }
};

/**
 * Word lid van een factie
 */
exports.joinFaction = async (req, res) => {
    try {
        const { playerId, factionId } = req.body;
        
        // Valideer input
        if (!playerId || factionId === undefined) {
            return res.status(400).json({
                status: 'error',
                message: 'Speler ID en Factie ID zijn vereist'
            });
        }
        
        // Controleer of factie bestaat
        const faction = await Faction.findOne({ factionId });
        if (!faction) {
            return res.status(404).json({
                status: 'error',
                message: 'Factie niet gevonden'
            });
        }
        
        // Vind de speler
        const player = await Player.findOne({ playerId });
        if (!player) {
            return res.status(404).json({
                status: 'error',
                message: 'Speler niet gevonden'
            });
        }
        
        // Update speler factie
        player.factionId = factionId;
        await player.save();
        
        // Update factie ledenaantallen
        await Faction.updateMemberCount(factionId);
        
        // Als de speler eerder in een andere factie zat, update die ook
        if (player.factionId !== factionId) {
            await Faction.updateMemberCount(player.factionId);
        }
        
        res.status(200).json({
            status: 'success',
            message: 'Speler is nu lid van de factie',
            data: {
                playerId: player.playerId,
                factionId: player.factionId
            }
        });
    } catch (error) {
        console.error(`[FactionController] joinFaction error: ${error.message}`);
        res.status(500).json({ 
            status: 'error', 
            message: 'Er is een serverfout opgetreden' 
        });
    }
};

/**
 * Krijg factie relaties
 */
exports.getFactionRelations = async (req, res) => {
    try {
        const { factionId } = req.query;
        
        // Valideer input
        if (factionId === undefined) {
            return res.status(400).json({
                status: 'error',
                message: 'Factie ID is vereist'
            });
        }
        
        // Zoek factie en haar relaties
        const faction = await Faction.findOne({ factionId }).select('relations');
        
        if (!faction) {
            return res.status(404).json({
                status: 'error',
                message: 'Factie niet gevonden'
            });
        }
        
        res.status(200).json({
            status: 'success',
            data: faction.relations
        });
    } catch (error) {
        console.error(`[FactionController] getFactionRelations error: ${error.message}`);
        res.status(500).json({ 
            status: 'error', 
            message: 'Er is een serverfout opgetreden' 
        });
    }
};

/**
 * Krijg leden van een factie
 */
exports.getFactionMembers = async (req, res) => {
    try {
        const { factionId } = req.params;
        
        // Valideer input
        if (factionId === undefined) {
            return res.status(400).json({
                status: 'error',
                message: 'Factie ID is vereist'
            });
        }
        
        // Zoek alle spelers in de factie
        const players = await Player.find({ 
            factionId: parseInt(factionId)
        }).select('playerId username isOnline');
        
        res.status(200).json({
            status: 'success',
            count: players.length,
            data: players
        });
    } catch (error) {
        console.error(`[FactionController] getFactionMembers error: ${error.message}`);
        res.status(500).json({ 
            status: 'error', 
            message: 'Er is een serverfout opgetreden' 
        });
    }
};

/**
 * Maak een nieuwe factie aan (admin only)
 */
exports.createFaction = async (req, res) => {
    try {
        // Admin check
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                status: 'error',
                message: 'Geen toestemming voor deze actie'
            });
        }
        
        const { name, description, color, factionId, baseLocation, safeZoneRadius, leaderId } = req.body;
        
        // Valideer input
        if (!name || !description || !factionId) {
            return res.status(400).json({
                status: 'error',
                message: 'Naam, beschrijving en factie ID zijn vereist'
            });
        }
        
        // Controleer of factie al bestaat
        const existingFaction = await Faction.findOne({ 
            $or: [{ name }, { factionId }]
        });
        
        if (existingFaction) {
            return res.status(400).json({
                status: 'error',
                message: 'Factie naam of ID is al in gebruik'
            });
        }
        
        // Maak nieuwe factie
        const newFaction = new Faction({
            factionId,
            name,
            description,
            color: color || "#FFFFFF",
            baseLocation: baseLocation || { x: 0, y: 0, z: 0 },
            safeZoneRadius: safeZoneRadius || 30,
            leaderId: leaderId || null
        });
        
        await newFaction.save();
        
        res.status(201).json({
            status: 'success',
            message: 'Factie succesvol aangemaakt',
            data: {
                _id: newFaction._id,
                factionId: newFaction.factionId,
                name: newFaction.name
            }
        });
    } catch (error) {
        console.error(`[FactionController] createFaction error: ${error.message}`);
        res.status(500).json({ 
            status: 'error', 
            message: 'Er is een serverfout opgetreden' 
        });
    }
};

/**
 * Update een bestaande factie (admin only)
 */
exports.updateFaction = async (req, res) => {
    try {
        // Admin check
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                status: 'error',
                message: 'Geen toestemming voor deze actie'
            });
        }
        
        const { id } = req.params;
        const { name, description, color, baseLocation, safeZoneRadius, leaderId, isActive } = req.body;
        
        // Zoek de factie
        const faction = await Faction.findOne({ factionId: id });
        
        if (!faction) {
            return res.status(404).json({
                status: 'error',
                message: 'Factie niet gevonden'
            });
        }
        
        // Update factie velden
        if (name) faction.name = name;
        if (description) faction.description = description;
        if (color) faction.color = color;
        if (baseLocation) faction.baseLocation = baseLocation;
        if (safeZoneRadius !== undefined) faction.safeZoneRadius = safeZoneRadius;
        if (leaderId) faction.leaderId = leaderId;
        if (isActive !== undefined) faction.isActive = isActive;
        
        await faction.save();
        
        res.status(200).json({
            status: 'success',
            message: 'Factie succesvol bijgewerkt',
            data: {
                factionId: faction.factionId,
                name: faction.name,
                isActive: faction.isActive
            }
        });
    } catch (error) {
        console.error(`[FactionController] updateFaction error: ${error.message}`);
        res.status(500).json({ 
            status: 'error', 
            message: 'Er is een serverfout opgetreden' 
        });
    }
};

/**
 * Update factie relaties (admin only)
 */
exports.updateFactionRelations = async (req, res) => {
    try {
        // Admin check
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                status: 'error',
                message: 'Geen toestemming voor deze actie'
            });
        }
        
        const { factionId, targetFactionId, status } = req.body;
        
        // Valideer input
        if (factionId === undefined || targetFactionId === undefined || !status) {
            return res.status(400).json({
                status: 'error',
                message: 'Factie ID, doel Factie ID en status zijn vereist'
            });
        }
        
        // Controleer of status geldig is
        if (!['friendly', 'neutral', 'hostile'].includes(status)) {
            return res.status(400).json({
                status: 'error',
                message: 'Status moet friendly, neutral of hostile zijn'
            });
        }
        
        // Zoek de factie
        const faction = await Faction.findOne({ factionId });
        
        if (!faction) {
            return res.status(404).json({
                status: 'error',
                message: 'Factie niet gevonden'
            });
        }
        
        // Update de relatie
        await faction.updateRelation(targetFactionId, status);
        
        // Reciprociteit behouden - ook de andere factie updaten indien nodig
        if (factionId !== targetFactionId) {
            const targetFaction = await Faction.findOne({ factionId: targetFactionId });
            if (targetFaction) {
                await targetFaction.updateRelation(factionId, status);
            }
        }
        
        res.status(200).json({
            status: 'success',
            message: 'Factie relaties succesvol bijgewerkt'
        });
    } catch (error) {
        console.error(`[FactionController] updateFactionRelations error: ${error.message}`);
        res.status(500).json({ 
            status: 'error', 
            message: 'Er is een serverfout opgetreden' 
        });
    }
};