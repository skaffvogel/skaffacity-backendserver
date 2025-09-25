/**
 * Game Server API Routes
 * RESTful endpoints voor game server management
 */

const express = require('express');
const router = express.Router();
const GameServerManager = require('../managers/GameServerManager');

// Initialize game server manager
const gameServerManager = new GameServerManager();

// Admin key for server management without authentication
const ADMIN_KEY = process.env.GAMESERVER_ADMIN_KEY || 'skaffa-admin-2025';

/**
 * @route   GET /api/v1/gameservers
 * @desc    Haal alle beschikbare game servers op
 * @access  Private
 */
router.get('/', async (req, res) => {
    try {
        // Get servers from internal registry first, fallback to Pterodactyl
        let servers = [];
        
        try {
            const internalServers = require('./internal/servers.routes');
            const activeServers = internalServers.getActiveServers();
            
            if (activeServers && activeServers.length > 0) {
                servers = activeServers.map(server => ({
                    id: server.serverId,
                    name: `SkaffaCity Server ${server.serverId}`,
                    address: 'localhost', // Would be actual server IP
                    port: server.serverPort,
                    playerCount: server.currentPlayers,
                    maxPlayers: server.maxPlayers,
                    mapName: server.mapName,
                    gameMode: server.gameMode,
                    status: server.status,
                    ping: 0 // Would be calculated
                }));
            }
        } catch (error) {
            console.warn('[GameServerAPI] Internal servers not available, using fallback');
        }
        
        // Fallback to GameServerManager if no internal servers
        if (servers.length === 0) {
            servers = gameServerManager.getAllServers();
        }
        
        res.json({
            status: 'success',
            data: {
                servers: servers,
                totalServers: servers.length,
                availableSlots: servers.reduce((total, server) => 
                    total + (server.maxPlayers - server.playerCount), 0
                )
            }
        });
    } catch (error) {
        console.error('[GameServerAPI] Error getting servers:', error.message);
        res.status(500).json({
            status: 'error',
            message: 'Fout bij ophalen game servers',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

/**
 * @route   POST /api/v1/gameservers/join
 * @desc    Voeg speler toe aan game server queue
 * @access  Private
 */
router.post('/join', async (req, res) => {
    try {
        const playerId = req.user.id; // Van JWT middleware
        const { preferredServerId } = req.body;

        // Find available server from internal registry
        let selectedServer = null;
        
        try {
            const internalServers = require('./internal/servers.routes');
            
            if (preferredServerId) {
                // Try to find preferred server
                const allServers = internalServers.getAllServers();
                selectedServer = allServers.find(s => s.serverId === preferredServerId && 
                    s.status === 'online' && s.currentPlayers < s.maxPlayers);
            }
            
            // If no preferred server or preferred not available, find any available server
            if (!selectedServer) {
                selectedServer = internalServers.findAvailableServer();
            }
        } catch (error) {
            console.warn('[GameServerAPI] Internal server registry not available, using GameServerManager');
        }
        
        // Fallback to GameServerManager if no internal servers
        if (!selectedServer) {
            const queueResult = await gameServerManager.joinServerQueue(playerId, preferredServerId);
            return res.json({
                status: 'success',
                message: 'Successfully joined server queue',
                data: queueResult
            });
        }
        
        // Return selected server info for UDP connection
        res.json({
            status: 'success',
            message: 'Server assigned successfully',
            data: {
                serverId: selectedServer.serverId,
                serverAddress: 'localhost', // Would be actual server IP
                serverPort: selectedServer.serverPort,
                playerId: playerId,
                queuePosition: 0 // Direct assignment
            }
        });
        
    } catch (error) {
        console.error('[GameServerAPI] Error joining server:', error.message);
        res.status(400).json({
            status: 'error',
            message: error.message || 'Fout bij toetreden tot game server'
        });
    }
});

/**
 * @route   POST /api/v1/gameservers/leave
 * @desc    Verlaat huidige game server
 * @access  Private
 */
router.post('/leave', async (req, res) => {
    try {
        const playerId = req.user.id;
        
        // Remove from queue if present
        gameServerManager.playerQueue.delete(playerId);
        
        // Hier zou je ook de UDP game server notificeren
        // dat de speler de server heeft verlaten
        
        res.json({
            status: 'success',
            message: 'Successfully left game server'
        });
    } catch (error) {
        console.error('[GameServerAPI] Error leaving server:', error.message);
        res.status(500).json({
            status: 'error',
            message: 'Fout bij verlaten game server'
        });
    }
});

/**
 * @route   GET /api/v1/gameservers/status/:serverId
 * @desc    Haal status van specifieke game server op
 * @access  Private
 */
router.get('/status/:serverId', async (req, res) => {
    try {
        const { serverId } = req.params;
        const servers = gameServerManager.getAllServers();
        const server = servers.find(s => s.id === serverId);
        
        if (!server) {
            return res.status(404).json({
                status: 'error',
                message: 'Game server niet gevonden'
            });
        }
        
        res.json({
            status: 'success',
            data: server
        });
    } catch (error) {
        console.error('[GameServerAPI] Error getting server status:', error.message);
        res.status(500).json({
            status: 'error',
            message: 'Fout bij ophalen server status'
        });
    }
});

/**
 * @route   POST /api/v1/gameservers/create
 * @desc    Maak nieuwe game server aan (Admin only)
 * @access  Admin
 */
router.post('/create', async (req, res) => {
    try {
        // Check admin permissions
        if (!req.user.isAdmin) {
            return res.status(403).json({
                status: 'error',
                message: 'Admin rechten vereist'
            });
        }

        const newServer = await gameServerManager.createGameServer();
        
        res.json({
            status: 'success',
            message: 'Game server succesvol aangemaakt',
            data: newServer
        });
    } catch (error) {
        console.error('[GameServerAPI] Error creating server:', error.message);
        res.status(500).json({
            status: 'error',
            message: error.message || 'Fout bij aanmaken game server'
        });
    }
});

/**
 * @route   DELETE /api/v1/gameservers/:serverId
 * @desc    Verwijder game server (Admin only)
 * @access  Admin
 */
router.delete('/:serverId', async (req, res) => {
    try {
        // Check admin permissions
        if (!req.user.isAdmin) {
            return res.status(403).json({
                status: 'error',
                message: 'Admin rechten vereist'
            });
        }

        const { serverId } = req.params;
        await gameServerManager.deleteServer(serverId);
        
        res.json({
            status: 'success',
            message: 'Game server succesvol verwijderd'
        });
    } catch (error) {
        console.error('[GameServerAPI] Error deleting server:', error.message);
        res.status(500).json({
            status: 'error',
            message: error.message || 'Fout bij verwijderen game server'
        });
    }
});

/**
 * @route   POST /api/v1/gameservers/:serverId/start
 * @desc    Start game server (Admin only)
 * @access  Admin
 */
router.post('/:serverId/start', async (req, res) => {
    try {
        // Check admin permissions
        if (!req.user.isAdmin) {
            return res.status(403).json({
                status: 'error',
                message: 'Admin rechten vereist'
            });
        }

        const { serverId } = req.params;
        await gameServerManager.startServer(serverId);
        
        res.json({
            status: 'success',
            message: 'Game server wordt gestart'
        });
    } catch (error) {
        console.error('[GameServerAPI] Error starting server:', error.message);
        res.status(500).json({
            status: 'error',
            message: error.message || 'Fout bij starten game server'
        });
    }
});

/**
 * @route   POST /api/v1/gameservers/:serverId/stop
 * @desc    Stop game server (Admin only)
 * @access  Admin
 */
router.post('/:serverId/stop', async (req, res) => {
    try {
        // Check admin permissions
        if (!req.user.isAdmin) {
            return res.status(403).json({
                status: 'error',
                message: 'Admin rechten vereist'
            });
        }

        const { serverId } = req.params;
        await gameServerManager.stopServer(serverId);
        
        res.json({
            status: 'success',
            message: 'Game server wordt gestopt'
        });
    } catch (error) {
        console.error('[GameServerAPI] Error stopping server:', error.message);
        res.status(500).json({
            status: 'error',
            message: error.message || 'Fout bij stoppen game server'
        });
    }
});

/**
 * @route   POST /api/v1/gameservers/admin/create
 * @desc    Admin endpoint - Maak nieuwe game server aan (zonder user auth)
 * @access  Admin Key Required
 */
router.post('/admin/create', async (req, res) => {
    try {
        const { adminKey } = req.body;
        
        // Check admin key
        if (adminKey !== ADMIN_KEY) {
            return res.status(403).json({
                status: 'error',
                message: 'Invalid admin key'
            });
        }

        const newServer = await gameServerManager.createGameServer();
        
        res.json({
            status: 'success',
            message: 'Game server succesvol aangemaakt via admin endpoint',
            data: newServer
        });
    } catch (error) {
        console.error('[GameServerAPI] Admin create error:', error.message);
        res.status(500).json({
            status: 'error',
            message: error.message || 'Fout bij aanmaken game server'
        });
    }
});

/**
 * @route   POST /api/v1/gameservers/admin/start
 * @desc    Admin endpoint - Start game server (zonder user auth)
 * @access  Admin Key Required
 */
router.post('/admin/start', async (req, res) => {
    try {
        const { adminKey, serverId } = req.body;
        
        // Check admin key
        if (adminKey !== ADMIN_KEY) {
            return res.status(403).json({
                status: 'error',
                message: 'Invalid admin key'
            });
        }

        if (!serverId) {
            return res.status(400).json({
                status: 'error',
                message: 'Server ID is vereist'
            });
        }

        await gameServerManager.startServer(serverId);
        
        res.json({
            status: 'success',
            message: `Game server ${serverId} wordt gestart via admin endpoint`
        });
    } catch (error) {
        console.error('[GameServerAPI] Admin start error:', error.message);
        res.status(500).json({
            status: 'error',
            message: error.message || 'Fout bij starten game server'
        });
    }
});

/**
 * @route   GET /api/v1/gameservers/admin/status
 * @desc    Admin endpoint - Haal alle server status op (zonder user auth)  
 * @access  Admin Key Required
 */
router.get('/admin/status', async (req, res) => {
    try {
        const { adminKey } = req.query;
        
        // Check admin key
        if (adminKey !== ADMIN_KEY) {
            return res.status(403).json({
                status: 'error',
                message: 'Invalid admin key'
            });
        }

        const servers = gameServerManager.getAllServers();
        
        res.json({
            status: 'success',
            message: 'Server status opgehaald via admin endpoint',
            data: {
                servers: servers,
                totalServers: servers.length,
                timestamp: new Date().toISOString()
            }
        });
    } catch (error) {
        console.error('[GameServerAPI] Admin status error:', error.message);
        res.status(500).json({
            status: 'error',
            message: error.message || 'Fout bij ophalen server status'
        });
    }
});

/**
 * Initialize game server manager when routes are loaded
 */
router.initialize = async () => {
    try {
        const success = await gameServerManager.initialize();
        if (success) {
            console.log('[GameServerAPI] ✅ Game server manager geïnitialiseerd');
        } else {
            console.error('[GameServerAPI] ❌ Game server manager initialisatie mislukt');
        }
    } catch (error) {
        console.error('[GameServerAPI] Initialisatie error:', error.message);
    }
};

module.exports = router;