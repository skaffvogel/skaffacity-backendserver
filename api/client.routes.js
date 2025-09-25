/**
 * Client Routes - Endpoints voor Unity client communicatie met master server
 */

const express = require('express');
const router = express.Router();

/**
 * Client Master Server Connection Endpoint
 * Unity clients gebruik dit om te verbinden met de master server
 * @route   POST /api/v1/client/connectmaster
 * @access  Public
 */
router.post('/connectmaster', (req, res) => {
    try {
        const { clientId, version, platform } = req.body;
        
        console.log(`[CLIENT] Master server connection request from client: ${clientId || 'unknown'}`);
        
        // Valideer client info
        if (!clientId) {
            return res.status(400).json({
                success: false,
                message: 'Client ID is required',
                timestamp: new Date().toISOString()
            });
        }
        
        // Hier kan je client validatie toevoegen (versie check, etc.)
        const supportedVersion = "1.0.0";
        if (version && version !== supportedVersion) {
            console.log(`[CLIENT] Warning: Client version ${version} differs from supported ${supportedVersion}`);
        }
        
        // Return master server info and available game servers (Minecraft-style)
        // Import the active servers from the servers routes
        const serversRoutes = require('./servers.routes');
        const activeServers = require('./servers.routes').activeServers || new Map();
        
        // Convert Map to Array voor client response
        const availableGameServers = Array.from(activeServers.values()).filter(server => 
            server.status === 'online'
        );
        
        res.json({
            success: true,
            message: 'Successfully connected to master server (Minecraft-style)',
            data: {
                masterServer: {
                    id: 'skaffacity-master-001',
                    name: 'SkaffaCity Master Server',
                    version: '1.0.0',
                    status: 'online',
                    type: 'mojang-style-auth',
                    timestamp: new Date().toISOString()
                },
                availableServers: availableGameServers.map(server => ({
                    id: server.id,
                    name: server.name,
                    ip: server.ip || process.env.GAME_SERVER_HOST || 'panel.lvlagency.nl',
                    port: server.port,
                    currentPlayers: server.currentPlayers || 0,
                    maxPlayers: server.maxPlayers || 50,
                    status: server.status,
                    gameMode: server.gameMode || 'multiplayer',
                    region: server.region || 'EU-West',
                    version: server.version,
                    lastHeartbeat: server.lastHeartbeat
                })),
                clientId: clientId,
                sessionToken: `session_${clientId}_${Date.now()}` // Voor toekomstige authenticatie
            },
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('[CLIENT] Master connection error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error during master connection',
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * Client Game Server Join Endpoint  
 * Unity clients gebruiken dit om deel te nemen aan een game server
 * @route   POST /api/v1/client/joinserver
 * @access  Public
 */
router.post('/joinserver', (req, res) => {
    try {
        const { clientId, serverId, playerInfo } = req.body;
        
        console.log(`[CLIENT] Join server request - Client: ${clientId}, Server: ${serverId}`);
        
        // Valideer input
        if (!clientId || !serverId) {
            return res.status(400).json({
                success: false,
                message: 'Client ID and Server ID are required',
                timestamp: new Date().toISOString()
            });
        }
        
        // Zoek de gevraagde server in de active servers registry (Minecraft-style)
        const serversRoutes = require('./servers.routes');
        const activeServers = require('./servers.routes').activeServers || new Map();
        
        const targetServer = activeServers.get(serverId);
        
        if (!targetServer) {
            return res.status(404).json({
                success: false,
                message: 'Game server not found or not available',
                requestedServerId: serverId,
                availableServers: Array.from(activeServers.keys()),
                timestamp: new Date().toISOString()
            });
        }
        
        // Check server status
        if (targetServer.status !== 'online') {
            return res.status(503).json({
                success: false,
                message: `Game server is ${targetServer.status}`,
                timestamp: new Date().toISOString()
            });
        }
        
        // Check server capacity
        if (targetServer.currentPlayers >= targetServer.maxPlayers) {
            return res.status(409).json({
                success: false,
                message: 'Game server is full',
                currentPlayers: targetServer.currentPlayers,
                maxPlayers: targetServer.maxPlayers,
                timestamp: new Date().toISOString()
            });
        }
        
        // Return connection details (Minecraft-style)
        const connectionToken = `session_${clientId}_${serverId}_${Date.now()}`;
        
        res.json({
            success: true,
            message: 'Game server join approved (Minecraft-style)',
            data: {
                server: {
                    id: targetServer.id,
                    name: targetServer.name,
                    ip: targetServer.ip || process.env.GAME_SERVER_HOST || 'panel.lvlagency.nl',
                    port: targetServer.port,
                    currentPlayers: targetServer.currentPlayers,
                    maxPlayers: targetServer.maxPlayers,
                    status: targetServer.status,
                    gameMode: targetServer.gameMode,
                    region: targetServer.region
                },
                connectionToken: connectionToken,
                joinInstructions: {
                    protocol: 'UDP',
                    connectTimeout: 30,
                    heartbeatInterval: 5,
                    retries: 3,
                    authMethod: 'session-token'
                },
                playerInfo: playerInfo || { name: `Player_${clientId}` }
            },
            timestamp: new Date().toISOString()
        });
        
        // Optionally notify game server of incoming player
        console.log(`[CLIENT] Client ${clientId} approved to join server ${serverId}`);

    } catch (error) {
        console.error('[CLIENT] Join server error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error during server join',
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * Client Disconnect Endpoint
 * Unity clients gebruiken dit om netjes af te melden
 * @route   POST /api/v1/client/disconnect
 * @access  Public
 */
router.post('/disconnect', (req, res) => {
    try {
        const { clientId, serverId, reason } = req.body;
        
        console.log(`[CLIENT] Disconnect request - Client: ${clientId}, Server: ${serverId}, Reason: ${reason || 'normal'}`);
        
        res.json({
            success: true,
            message: 'Client disconnected successfully',
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('[CLIENT] Disconnect error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error during disconnect',
            timestamp: new Date().toISOString()
        });
    }
});

module.exports = router;