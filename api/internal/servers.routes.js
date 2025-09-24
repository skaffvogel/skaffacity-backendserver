/**
 * Internal Server API Routes
 * Voor communicatie tussen game servers en master server
 */

const express = require('express');
const router = express.Router();

// In-memory server registry (in productie zou je een database gebruiken)
const registeredServers = new Map(); // serverId -> serverInfo

/**
 * @route   POST /api/v1/internal/servers/register
 * @desc    Register nieuwe game server
 * @access  Internal
 */
router.post('/register', async (req, res) => {
    try {
        const {
            serverId,
            serverPort,
            maxPlayers,
            currentPlayers,
            mapName,
            gameMode,
            status,
            version,
            serverType,
            region
        } = req.body;

        // Validatie
        if (!serverId || !serverPort) {
            return res.status(400).json({
                success: false,
                message: 'ServerId en serverPort zijn verplicht'
            });
        }

        // Server info
        const serverInfo = {
            serverId,
            serverPort,
            maxPlayers: maxPlayers || 50,
            currentPlayers: currentPlayers || 0,
            mapName: mapName || 'SkaffaCity_Default',
            gameMode: gameMode || 'default',
            status: status || 'starting',
            version: version || '1.0.0',
            serverType: serverType || 'dedicated',
            region: region || 'default',
            registeredAt: new Date(),
            lastHeartbeat: new Date(),
            uptime: 0,
            cpuUsage: 0,
            memoryUsage: 0,
            tickRate: 20
        };

        // Registreer server
        registeredServers.set(serverId, serverInfo);

        console.log(`[INTERNAL] 🖥️ Game server registered: ${serverId} (${serverPort})`);

        res.json({
            success: true,
            message: 'Server successfully registered',
            serverId: serverId
        });

    } catch (error) {
        console.error('[INTERNAL] Server registration error:', error.message);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

/**
 * @route   POST /api/v1/internal/servers/heartbeat
 * @desc    Heartbeat van game server
 * @access  Internal
 */
router.post('/heartbeat', async (req, res) => {
    try {
        const {
            serverId,
            currentPlayers,
            status,
            uptime,
            cpuUsage,
            memoryUsage,
            tickRate
        } = req.body;

        if (!serverId) {
            return res.status(400).json({
                success: false,
                message: 'ServerId is verplicht'
            });
        }

        // Check if server is registered
        if (!registeredServers.has(serverId)) {
            return res.status(404).json({
                success: false,
                message: 'Server not found - please register first'
            });
        }

        // Update server info
        const serverInfo = registeredServers.get(serverId);
        serverInfo.currentPlayers = currentPlayers || serverInfo.currentPlayers;
        serverInfo.status = status || serverInfo.status;
        serverInfo.uptime = uptime || serverInfo.uptime;
        serverInfo.cpuUsage = cpuUsage || serverInfo.cpuUsage;
        serverInfo.memoryUsage = memoryUsage || serverInfo.memoryUsage;
        serverInfo.tickRate = tickRate || serverInfo.tickRate;
        serverInfo.lastHeartbeat = new Date();

        registeredServers.set(serverId, serverInfo);

        res.json({
            success: true,
            message: 'Heartbeat received'
        });

    } catch (error) {
        console.error('[INTERNAL] Heartbeat error:', error.message);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

/**
 * @route   POST /api/v1/internal/servers/status
 * @desc    Update server status
 * @access  Internal
 */
router.post('/status', async (req, res) => {
    try {
        const { serverId, status } = req.body;

        if (!serverId || !status) {
            return res.status(400).json({
                success: false,
                message: 'ServerId en status zijn verplicht'
            });
        }

        if (!registeredServers.has(serverId)) {
            return res.status(404).json({
                success: false,
                message: 'Server not found'
            });
        }

        // Update status
        const serverInfo = registeredServers.get(serverId);
        serverInfo.status = status;
        serverInfo.lastHeartbeat = new Date();
        
        registeredServers.set(serverId, serverInfo);

        console.log(`[INTERNAL] 🔄 Server ${serverId} status updated: ${status}`);

        res.json({
            success: true,
            message: 'Status updated'
        });

    } catch (error) {
        console.error('[INTERNAL] Status update error:', error.message);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

/**
 * @route   POST /api/v1/internal/servers/player-event
 * @desc    Player join/leave notificatie
 * @access  Internal
 */
router.post('/player-event', async (req, res) => {
    try {
        const { serverId, action, playerId, playerName, timestamp } = req.body;

        if (!serverId || !action || !playerId) {
            return res.status(400).json({
                success: false,
                message: 'ServerId, action en playerId zijn verplicht'
            });
        }

        if (!registeredServers.has(serverId)) {
            return res.status(404).json({
                success: false,
                message: 'Server not found'
            });
        }

        const serverInfo = registeredServers.get(serverId);

        if (action === 'join') {
            console.log(`[INTERNAL] 👤 Player ${playerName} (${playerId}) joined server ${serverId}`);
        } else if (action === 'leave') {
            console.log(`[INTERNAL] 👋 Player ${playerName} (${playerId}) left server ${serverId}`);
        }

        res.json({
            success: true,
            message: 'Player event processed'
        });

    } catch (error) {
        console.error('[INTERNAL] Player event error:', error.message);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

/**
 * @route   POST /api/v1/internal/servers/unregister
 * @desc    Unregister game server
 * @access  Internal
 */
router.post('/unregister', async (req, res) => {
    try {
        const { serverId, status } = req.body;

        if (!serverId) {
            return res.status(400).json({
                success: false,
                message: 'ServerId is verplicht'
            });
        }

        if (registeredServers.has(serverId)) {
            registeredServers.delete(serverId);
            console.log(`[INTERNAL] 🗑️ Game server unregistered: ${serverId}`);
        }

        res.json({
            success: true,
            message: 'Server unregistered'
        });

    } catch (error) {
        console.error('[INTERNAL] Unregister error:', error.message);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

/**
 * @route   GET /api/v1/internal/servers/list
 * @desc    Lijst van geregistreerde servers (voor debugging)
 * @access  Internal
 */
router.get('/list', async (req, res) => {
    try {
        const servers = Array.from(registeredServers.values());
        
        // Cleanup oude servers (geen heartbeat in laatste 2 minuten)
        const now = new Date();
        const staleServers = [];
        
        for (const [serverId, serverInfo] of registeredServers.entries()) {
            const timeSinceHeartbeat = now - serverInfo.lastHeartbeat;
            if (timeSinceHeartbeat > 120000) { // 2 minuten
                staleServers.push(serverId);
            }
        }
        
        // Verwijder oude servers
        staleServers.forEach(serverId => {
            registeredServers.delete(serverId);
            console.log(`[INTERNAL] 🧹 Removed stale server: ${serverId}`);
        });

        res.json({
            success: true,
            servers: Array.from(registeredServers.values()),
            totalServers: registeredServers.size
        });

    } catch (error) {
        console.error('[INTERNAL] List servers error:', error.message);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

/**
 * @route   GET /api/v1/internal/servers/:serverId
 * @desc    Specifieke server info
 * @access  Internal
 */
router.get('/:serverId', async (req, res) => {
    try {
        const { serverId } = req.params;

        if (!registeredServers.has(serverId)) {
            return res.status(404).json({
                success: false,
                message: 'Server not found'
            });
        }

        const serverInfo = registeredServers.get(serverId);

        res.json({
            success: true,
            server: serverInfo
        });

    } catch (error) {
        console.error('[INTERNAL] Get server error:', error.message);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

/**
 * Utility functie om alle geregistreerde servers te krijgen
 */
function getAllServers() {
    return Array.from(registeredServers.values());
}

/**
 * Utility functie om actieve servers te krijgen
 */
function getActiveServers() {
    const now = new Date();
    return Array.from(registeredServers.values()).filter(server => {
        const timeSinceHeartbeat = now - server.lastHeartbeat;
        return timeSinceHeartbeat < 60000 && server.status === 'online'; // 1 minuut
    });
}

/**
 * Utility functie om server te vinden met ruimte
 */
function findAvailableServer() {
    const activeServers = getActiveServers();
    return activeServers.find(server => 
        server.currentPlayers < server.maxPlayers && 
        server.status === 'online'
    );
}

// Export utility functions voor gebruik in andere routes
module.exports = router;
module.exports.getAllServers = getAllServers;
module.exports.getActiveServers = getActiveServers;
module.exports.findAvailableServer = findAvailableServer;