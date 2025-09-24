/**
 * Game Server API Routes
 * RESTful endpoints voor game server management
 */

const express = require('express');
const router = express.Router();
const GameServerManager = require('../managers/GameServerManager');

// Initialize game server manager
const gameServerManager = new GameServerManager();

/**
 * @route   GET /api/v1/gameservers
 * @desc    Haal alle beschikbare game servers op
 * @access  Private
 */
router.get('/', async (req, res) => {
    try {
        const servers = gameServerManager.getAllServers();
        
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

        const queueResult = await gameServerManager.joinServerQueue(playerId, preferredServerId);
        
        res.json({
            status: 'success',
            message: 'Successfully joined server queue',
            data: queueResult
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