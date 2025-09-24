/**
 * Player controller voor het afhandelen van speler synchronisatie
 */

const Player = require('./models/player.mysql');
const User = require('./models/user.mysql');

// Helper functie om position en rotation formaat te converteren
const formatPosition = (posArray) => {
    return {
        x: posArray[0],
        y: posArray[1],
        z: posArray[2]
    };
};

/**
 * Registreer een speler in het spel
 */
exports.registerPlayer = async (req, res) => {
    try {
        const { id, position, rotation, health, maxHealth, factionId, username } = req.body;
        
        // Valideer input
        if (!id || !position || !rotation) {
            return res.status(400).json({ 
                status: 'error', 
                message: 'Missende vereiste velden' 
            });
        }
        
        // Format positie en rotatie
        const formattedPosition = formatPosition(position);
        const formattedRotation = formatPosition(rotation);
        
        // Controleer of speler al bestaat
        let player = await Player.findOne({ playerId: id });
        
        if (player) {
            // Update bestaande speler
            player.position = formattedPosition;
            player.rotation = formattedRotation;
            player.health = health || player.health;
            player.maxHealth = maxHealth || player.maxHealth;
            player.factionId = factionId !== undefined ? factionId : player.factionId;
            player.isOnline = true;
            player.lastActive = Date.now();
            
            await player.save();
            
            return res.status(200).json({ 
                status: 'success', 
                message: 'Speler succesvol bijgewerkt',
                player: {
                    id: player.playerId,
                    username: player.username,
                    position: [player.position.x, player.position.y, player.position.z],
                    rotation: [player.rotation.x, player.rotation.y, player.rotation.z],
                    health: player.health,
                    maxHealth: player.maxHealth,
                    factionId: player.factionId
                }
            });
        }
        
        // Vind de bijbehorende gebruiker
        const user = await User.findOne({ username: username || id });
        
        if (!user) {
            return res.status(404).json({ 
                status: 'error', 
                message: 'Gebruiker niet gevonden' 
            });
        }
        
        // Maak nieuwe speler aan
        const newPlayer = new Player({
            playerId: id,
            userId: user._id,
            username: username || id,
            position: formattedPosition,
            rotation: formattedRotation,
            health: health || 100,
            maxHealth: maxHealth || 100,
            factionId: factionId || 0,
            isOnline: true
        });
        
        await newPlayer.save();
        
        res.status(201).json({ 
            status: 'success', 
            message: 'Speler succesvol geregistreerd',
            player: {
                id: newPlayer.playerId,
                username: newPlayer.username,
                position: [newPlayer.position.x, newPlayer.position.y, newPlayer.position.z],
                rotation: [newPlayer.rotation.x, newPlayer.rotation.y, newPlayer.rotation.z],
                health: newPlayer.health,
                maxHealth: newPlayer.maxHealth,
                factionId: newPlayer.factionId
            }
        });
    } catch (error) {
        console.error(`[PlayerController] registerPlayer error: ${error.message}`);
        res.status(500).json({ 
            status: 'error', 
            message: 'Er is een serverfout opgetreden' 
        });
    }
};

/**
 * Update speler positie en rotatie
 */
exports.updatePosition = async (req, res) => {
    try {
        const { id, position, rotation } = req.body;
        
        // Valideer input
        if (!id || !position || !rotation) {
            return res.status(400).json({ 
                status: 'error', 
                message: 'Missende vereiste velden' 
            });
        }
        
        // Format positie en rotatie
        const formattedPosition = formatPosition(position);
        const formattedRotation = formatPosition(rotation);
        
        // Vind en update speler
        const player = await Player.findOne({ playerId: id });
        
        if (!player) {
            return res.status(404).json({ 
                status: 'error', 
                message: 'Speler niet gevonden' 
            });
        }
        
        // Update positie
        player.position = formattedPosition;
        player.rotation = formattedRotation;
        player.lastActive = Date.now();
        player.isOnline = true;
        
        await player.save();
        
        // Stuur minimaal antwoord terug om bandbreedte te besparen
        res.status(200).json({ 
            status: 'success'
        });
    } catch (error) {
        console.error(`[PlayerController] updatePosition error: ${error.message}`);
        res.status(500).json({ 
            status: 'error', 
            message: 'Er is een serverfout opgetreden' 
        });
    }
};

/**
 * Update speler attributen (health, factie, etc)
 */
exports.updateAttributes = async (req, res) => {
    try {
        const { id, health, maxHealth, factionId } = req.body;
        
        // Valideer input
        if (!id) {
            return res.status(400).json({ 
                status: 'error', 
                message: 'Speler ID is vereist' 
            });
        }
        
        // Vind en update speler
        const player = await Player.findOne({ playerId: id });
        
        if (!player) {
            return res.status(404).json({ 
                status: 'error', 
                message: 'Speler niet gevonden' 
            });
        }
        
        // Update attributen indien beschikbaar
        if (health !== undefined) player.health = health;
        if (maxHealth !== undefined) player.maxHealth = maxHealth;
        if (factionId !== undefined) player.factionId = factionId;
        
        player.isAlive = player.health > 0;
        player.lastActive = Date.now();
        
        await player.save();
        
        // Stuur minimaal antwoord terug om bandbreedte te besparen
        res.status(200).json({ 
            status: 'success'
        });
    } catch (error) {
        console.error(`[PlayerController] updateAttributes error: ${error.message}`);
        res.status(500).json({ 
            status: 'error', 
            message: 'Er is een serverfout opgetreden' 
        });
    }
};

/**
 * Krijg alle actieve spelers
 */
exports.getAllPlayers = async (req, res) => {
    try {
        // Krijg alleen online spelers, tenzij anders aangegeven
        const showOffline = req.query.showOffline === 'true';
        const excludeId = req.query.exclude || '';
        
        let query = {};
        
        // Filter online status
        if (!showOffline) {
            query.isOnline = true;
        }
        
        // Exclude specifieke speler indien nodig
        if (excludeId) {
            query.playerId = { $ne: excludeId };
        }
        
        // Haal spelers op
        const players = await Player.find(query).select(
            'playerId username position rotation health maxHealth factionId isAlive'
        );
        
        // Formatteer voor client
        const formattedPlayers = players.map(player => ({
            id: player.playerId,
            username: player.username,
            position: [player.position.x, player.position.y, player.position.z],
            rotation: [player.rotation.x, player.rotation.y, player.rotation.z],
            health: player.health,
            maxHealth: player.maxHealth,
            factionId: player.factionId,
            isAlive: player.isAlive
        }));
        
        res.status(200).json(formattedPlayers);
    } catch (error) {
        console.error(`[PlayerController] getAllPlayers error: ${error.message}`);
        res.status(500).json({ 
            status: 'error', 
            message: 'Er is een serverfout opgetreden' 
        });
    }
};

/**
 * Krijg specifieke speler op ID
 */
exports.getPlayerById = async (req, res) => {
    try {
        const playerId = req.params.id;
        
        const player = await Player.findOne({ playerId }).select(
            'playerId username position rotation health maxHealth factionId isAlive stats'
        );
        
        if (!player) {
            return res.status(404).json({ 
                status: 'error', 
                message: 'Speler niet gevonden' 
            });
        }
        
        // Formatteer voor client
        const formattedPlayer = {
            id: player.playerId,
            username: player.username,
            position: [player.position.x, player.position.y, player.position.z],
            rotation: [player.rotation.x, player.rotation.y, player.rotation.z],
            health: player.health,
            maxHealth: player.maxHealth,
            factionId: player.factionId,
            isAlive: player.isAlive,
            stats: player.stats
        };
        
        res.status(200).json(formattedPlayer);
    } catch (error) {
        console.error(`[PlayerController] getPlayerById error: ${error.message}`);
        res.status(500).json({ 
            status: 'error', 
            message: 'Er is een serverfout opgetreden' 
        });
    }
};

/**
 * Verwijder een speler
 */
exports.deletePlayer = async (req, res) => {
    try {
        const playerId = req.params.id;
        
        // Admin check
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                status: 'error',
                message: 'Geen toestemming voor deze actie'
            });
        }
        
        const result = await Player.deleteOne({ playerId });
        
        if (result.deletedCount === 0) {
            return res.status(404).json({ 
                status: 'error', 
                message: 'Speler niet gevonden' 
            });
        }
        
        res.status(200).json({ 
            status: 'success', 
            message: 'Speler succesvol verwijderd' 
        });
    } catch (error) {
        console.error(`[PlayerController] deletePlayer error: ${error.message}`);
        res.status(500).json({ 
            status: 'error', 
            message: 'Er is een serverfout opgetreden' 
        });
    }
};