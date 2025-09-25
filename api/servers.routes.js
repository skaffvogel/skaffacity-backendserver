/**
 * Server Discovery and Management API Routes
 * Provides endpoints for Unity servers to connect and register
 */

const express = require('express');
const router = express.Router();
const axios = require('axios');

// In-memory server registry (in production, use database)
let activeServers = new Map();

/**
 * Server Discovery Endpoint
 * Unity clients can use this to find available game servers
 * @route   GET /api/v1/servers/discover
 * @access  Public
 */
router.get('/discover', (req, res) => {
    try {
        const servers = Array.from(activeServers.values()).map(server => ({
            id: server.id,
            name: server.name,
            ip: server.ip,
            port: server.port,
            currentPlayers: server.currentPlayers || 0,
            maxPlayers: server.maxPlayers || 50,
            gameMode: server.gameMode || 'standard',
            region: server.region || 'EU-West',
            status: server.status || 'online',
            lastHeartbeat: server.lastHeartbeat
        }));

        res.json({
            success: true,
            servers: servers,
            totalServers: servers.length,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('[SERVERS] Discovery error:', error);
        res.status(500).json({
            success: false,
            error: 'Server discovery failed',
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * Server Registration Endpoint
 * Unity servers can register themselves
 * @route   POST /api/v1/servers/register
 * @access  Public (but should validate server token in production)
 */
router.post('/register', (req, res) => {
    try {
        const {
            serverId,
            name,
            ip,
            port,
            maxPlayers,
            gameMode,
            region,
            version
        } = req.body;

        if (!serverId || !ip || !port) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: serverId, ip, port'
            });
        }

        const server = {
            id: serverId,
            name: name || `SkaffaCity Server #${port}`,
            ip: ip,
            port: parseInt(port),
            maxPlayers: parseInt(maxPlayers) || 50,
            currentPlayers: 0,
            gameMode: gameMode || 'standard',
            region: region || 'EU-West',
            version: version || '1.0.0',
            status: 'online',
            lastHeartbeat: new Date(),
            registeredAt: new Date()
        };

        activeServers.set(serverId, server);

        console.log(`[SERVERS] ✅ Server registered: ${serverId} (${ip}:${port})`);

        res.json({
            success: true,
            message: 'Server registered successfully',
            serverId: serverId,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('[SERVERS] Registration error:', error);
        res.status(500).json({
            success: false,
            error: 'Server registration failed',
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * Server Heartbeat Endpoint
 * Unity servers send regular heartbeats to stay alive
 * @route   POST /api/v1/servers/heartbeat
 * @access  Public
 */
router.post('/heartbeat', (req, res) => {
    try {
        const {
            serverId,
            currentPlayers,
            status,
            performance
        } = req.body;

        if (!serverId) {
            return res.status(400).json({
                success: false,
                error: 'Missing serverId'
            });
        }

        const server = activeServers.get(serverId);
        if (!server) {
            return res.status(404).json({
                success: false,
                error: 'Server not registered'
            });
        }

        // Update server info
        server.currentPlayers = parseInt(currentPlayers) || server.currentPlayers || 0;
        server.status = status || 'online';
        server.lastHeartbeat = new Date();
        
        if (performance) {
            server.performance = performance;
        }

        activeServers.set(serverId, server);

        res.json({
            success: true,
            message: 'Heartbeat received',
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('[SERVERS] Heartbeat error:', error);
        res.status(500).json({
            success: false,
            error: 'Heartbeat failed',
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * Server Unregister Endpoint
 * Unity servers kunnen zichzelf unregisteren (bij shutdown)
 * @route   DELETE /api/v1/servers/unregister/:serverId
 * @access  Public
 */
router.delete('/unregister/:serverId', (req, res) => {
    try {
        const { serverId } = req.params;

        if (!serverId) {
            return res.status(400).json({
                success: false,
                error: 'Missing serverId'
            });
        }

        const server = activeServers.get(serverId);
        if (!server) {
            return res.status(404).json({
                success: false,
                error: 'Server not found'
            });
        }

        // Remove server from registry
        activeServers.delete(serverId);

        console.log(`[SERVERS] 🗑️ Server unregistered: ${serverId} (${server.ip}:${server.port})`);

        res.json({
            success: true,
            message: 'Server unregistered successfully',
            serverId: serverId,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('[SERVERS] Unregister error:', error);
        res.status(500).json({
            success: false,
            error: 'Server unregistration failed',
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * Server Configuration Endpoint
 * Unity servers can get their configuration dynamically
 * @route   GET /api/v1/servers/config/:serverId
 * @access  Public
 */
router.get('/config/:serverId', (req, res) => {
    try {
        const { serverId } = req.params;

        // In production, get from database based on serverId
        const config = {
            masterServer: {
                url: process.env.MASTER_SERVER_URL || 'https://panel.lvlagency.nl:25566',
                heartbeatInterval: 30,
                enabled: true
            },
            network: {
                tickRate: 30,
                maxConnections: 100,
                timeout: 30
            },
            game: {
                maxPlayers: 50,
                gameMode: 'standard',
                mapName: 'SkaffaCity_Default'
            },
            server: {
                name: `SkaffaCity Server ${serverId}`,
                region: 'EU-West',
                autoRestart: true
            },
            performance: {
                targetFrameRate: 30,
                vSyncEnabled: false
            }
        };

        res.json({
            success: true,
            config: config,
            serverId: serverId,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('[SERVERS] Config error:', error);
        res.status(500).json({
            success: false,
            error: 'Configuration retrieval failed',
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * Server Status Endpoint
 * Get detailed status of all servers
 * @route   GET /api/v1/servers/status
 * @access  Public
 */
router.get('/status', (req, res) => {
    try {
        const now = new Date();
        const servers = Array.from(activeServers.values()).map(server => {
            const timeSinceHeartbeat = now - new Date(server.lastHeartbeat);
            const isOnline = timeSinceHeartbeat < 60000; // 60 seconds timeout
            
            return {
                ...server,
                isOnline: isOnline,
                timeSinceHeartbeat: Math.floor(timeSinceHeartbeat / 1000)
            };
        });

        const stats = {
            totalServers: servers.length,
            onlineServers: servers.filter(s => s.isOnline).length,
            totalPlayers: servers.reduce((sum, s) => sum + (s.currentPlayers || 0), 0),
            averageLoad: servers.length > 0 ? 
                Math.round(servers.reduce((sum, s) => sum + (s.currentPlayers || 0) / (s.maxPlayers || 50), 0) / servers.length * 100) : 0
        };

        res.json({
            success: true,
            servers: servers,
            stats: stats,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('[SERVERS] Status error:', error);
        res.status(500).json({
            success: false,
            error: 'Status retrieval failed',
            timestamp: new Date().toISOString()
        });
    }
});

// Clean up offline servers every 5 minutes
setInterval(() => {
    const now = new Date();
    const timeout = 5 * 60 * 1000; // 5 minutes
    
    for (const [serverId, server] of activeServers) {
        const timeSinceHeartbeat = now - new Date(server.lastHeartbeat);
        if (timeSinceHeartbeat > timeout) {
            console.log(`[SERVERS] 🗑️ Removing offline server: ${serverId}`);
            activeServers.delete(serverId);
        }
    }
}, 5 * 60 * 1000);

// Export router en activeServers voor andere modules
module.exports = router;
module.exports.activeServers = activeServers;