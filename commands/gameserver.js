/**
 * SkaffaCity UDP Game Server Instance
 * Real-time multiplayer game server voor een specifieke server instantie
 */

const dgram = require('dgram');
const { EventEmitter } = require('events');
const axios = require('axios');

class SkaffaCityGameServer extends EventEmitter {
    constructor(config = {}) {
        super();
        
        this.config = {
            serverId: process.env.GAME_SERVER_ID || 'gameserver-' + Date.now(),
            port: parseInt(process.env.GAME_SERVER_PORT) || 7001,
            masterServerUrl: process.env.MASTER_SERVER_URL || 'http://localhost:8000',
            maxPlayers: parseInt(process.env.MAX_PLAYERS) || 50,
            tickRate: parseInt(process.env.TICK_RATE) || 20, // 20 Hz
            worldSize: { x: 2000, y: 2000, z: 2000 },
            ...config
        };

        // Server state
        this.players = new Map(); // playerId -> playerData
        this.gameObjects = new Map(); // objectId -> gameObjectData
        this.isRunning = false;
        this.tickCount = 0;
        this.lastTick = Date.now();
        
        // Network
        this.socket = null;
        this.clients = new Map(); // address:port -> clientInfo
        
        // Performance tracking
        this.stats = {
            packetsReceived: 0,
            packetsSent: 0,
            playersConnected: 0,
            uptime: Date.now()
        };

        console.log(`[GameServer-${this.config.serverId}] Geïnitialiseerd op poort ${this.config.port}`);
    }

    /**
     * Start de UDP game server
     */
    async start() {
        try {
            this.socket = dgram.createSocket('udp4');
            
            // Setup event listeners
            this.setupSocketListeners();
            
            // Bind socket
            await new Promise((resolve, reject) => {
                this.socket.bind(this.config.port, (error) => {
                    if (error) reject(error);
                    else resolve();
                });
            });

            // Register met master server
            await this.registerWithMasterServer();
            
            // Start game loop
            this.startGameLoop();
            
            this.isRunning = true;
            console.log(`[GameServer-${this.config.serverId}] ✅ Server gestart op poort ${this.config.port}`);
            
        } catch (error) {
            console.error(`[GameServer-${this.config.serverId}] ❌ Fout bij starten:`, error.message);
            throw error;
        }
    }

    /**
     * Setup UDP socket event listeners
     */
    setupSocketListeners() {
        this.socket.on('message', (message, remoteInfo) => {
            this.handleIncomingPacket(message, remoteInfo);
        });

        this.socket.on('error', (error) => {
            console.error(`[GameServer-${this.config.serverId}] Socket error:`, error.message);
        });

        this.socket.on('close', () => {
            console.log(`[GameServer-${this.config.serverId}] Socket gesloten`);
            this.isRunning = false;
        });
    }

    /**
     * Handle inkomende UDP packets
     */
    handleIncomingPacket(buffer, remoteInfo) {
        try {
            this.stats.packetsReceived++;
            
            const clientKey = `${remoteInfo.address}:${remoteInfo.port}`;
            
            // Parse packet
            const packet = this.parsePacket(buffer);
            if (!packet) return;

            // Update client info
            this.clients.set(clientKey, {
                address: remoteInfo.address,
                port: remoteInfo.port,
                lastSeen: Date.now(),
                playerId: packet.playerId
            });

            // Process packet gebaseerd op type
            this.processPacket(packet, clientKey);
            
        } catch (error) {
            console.error(`[GameServer-${this.config.serverId}] Packet processing error:`, error.message);
        }
    }

    /**
     * Parse binary UDP packet
     */
    parsePacket(buffer) {
        try {
            // Eenvoudig JSON protocol voor nu (in productie zou je binary gebruiken)
            const packetData = JSON.parse(buffer.toString());
            return packetData;
        } catch (error) {
            console.error('Packet parse error:', error.message);
            return null;
        }
    }

    /**
     * Process parsed packet
     */
    processPacket(packet, clientKey) {
        const { type, playerId, data } = packet;

        switch (type) {
            case 'PLAYER_JOIN':
                this.handlePlayerJoin(playerId, data, clientKey);
                break;
                
            case 'PLAYER_MOVE':
                this.handlePlayerMove(playerId, data);
                break;
                
            case 'PLAYER_ACTION':
                this.handlePlayerAction(playerId, data);
                break;
                
            case 'CHAT_MESSAGE':
                this.handleChatMessage(playerId, data);
                break;
                
            case 'PING':
                this.handlePing(playerId, clientKey);
                break;
                
            default:
                console.warn(`[GameServer-${this.config.serverId}] Unknown packet type: ${type}`);
        }
    }

    /**
     * Handle speler join
     */
    handlePlayerJoin(playerId, data, clientKey) {
        if (this.players.has(playerId)) {
            console.log(`[GameServer-${this.config.serverId}] Speler ${playerId} opnieuw verbonden`);
        } else {
            console.log(`[GameServer-${this.config.serverId}] Nieuwe speler: ${playerId}`);
            
            // Spawn positie bepalen
            const spawnPosition = this.getSpawnPosition();
            
            const playerData = {
                id: playerId,
                username: data.username || `Player${playerId}`,
                position: spawnPosition,
                rotation: { x: 0, y: 0, z: 0 },
                health: 100,
                maxHealth: 100,
                isAlive: true,
                lastUpdate: Date.now(),
                clientKey: clientKey
            };

            this.players.set(playerId, playerData);
            this.stats.playersConnected = this.players.size;

            // Stuur welkom bericht
            this.sendToPlayer(playerId, {
                type: 'WELCOME',
                data: {
                    serverId: this.config.serverId,
                    spawnPosition: spawnPosition,
                    worldSize: this.config.worldSize
                }
            });

            // Notify andere spelers
            this.broadcastToOthers(playerId, {
                type: 'PLAYER_JOINED',
                data: playerData
            });
        }
    }

    /**
     * Handle speler movement
     */
    handlePlayerMove(playerId, data) {
        const player = this.players.get(playerId);
        if (!player) return;

        // Validate movement (basic anti-cheat)
        if (this.validateMovement(player.position, data.position)) {
            player.position = data.position;
            player.rotation = data.rotation;
            player.lastUpdate = Date.now();

            // Broadcast movement naar andere spelers
            this.broadcastToOthers(playerId, {
                type: 'PLAYER_MOVED',
                data: {
                    playerId: playerId,
                    position: data.position,
                    rotation: data.rotation
                }
            });
        }
    }

    /**
     * Handle speler actions (combat, interactions, etc.)
     */
    handlePlayerAction(playerId, data) {
        const player = this.players.get(playerId);
        if (!player) return;

        const { action, target, parameters } = data;

        switch (action) {
            case 'ATTACK':
                this.handleAttack(playerId, target, parameters);
                break;
                
            case 'INTERACT':
                this.handleInteraction(playerId, target, parameters);
                break;
                
            case 'USE_ITEM':
                this.handleItemUse(playerId, parameters);
                break;
        }
    }

    /**
     * Handle chat berichten
     */
    handleChatMessage(playerId, data) {
        const player = this.players.get(playerId);
        if (!player) return;

        const chatMessage = {
            type: 'CHAT_MESSAGE',
            data: {
                playerId: playerId,
                username: player.username,
                message: data.message,
                timestamp: Date.now()
            }
        };

        // Broadcast naar alle spelers
        this.broadcastToAll(chatMessage);
    }

    /**
     * Handle ping requests
     */
    handlePing(playerId, clientKey) {
        this.sendToClient(clientKey, {
            type: 'PONG',
            timestamp: Date.now()
        });
    }

    /**
     * Stuur packet naar specifieke speler
     */
    sendToPlayer(playerId, packet) {
        const player = this.players.get(playerId);
        if (player && player.clientKey) {
            this.sendToClient(player.clientKey, packet);
        }
    }

    /**
     * Stuur packet naar specifieke client
     */
    sendToClient(clientKey, packet) {
        const client = this.clients.get(clientKey);
        if (!client) return;

        try {
            const buffer = Buffer.from(JSON.stringify(packet));
            this.socket.send(buffer, client.port, client.address);
            this.stats.packetsSent++;
        } catch (error) {
            console.error(`[GameServer-${this.config.serverId}] Send error:`, error.message);
        }
    }

    /**
     * Broadcast naar alle spelers behalve één
     */
    broadcastToOthers(excludePlayerId, packet) {
        for (const [playerId, player] of this.players) {
            if (playerId !== excludePlayerId) {
                this.sendToPlayer(playerId, packet);
            }
        }
    }

    /**
     * Broadcast naar alle spelers
     */
    broadcastToAll(packet) {
        for (const [playerId] of this.players) {
            this.sendToPlayer(playerId, packet);
        }
    }

    /**
     * Valideer speler movement (anti-cheat)
     */
    validateMovement(oldPos, newPos) {
        const maxSpeed = 10; // meters per seconde
        const deltaTime = 1 / this.config.tickRate;
        const maxDistance = maxSpeed * deltaTime;

        const distance = Math.sqrt(
            Math.pow(newPos.x - oldPos.x, 2) +
            Math.pow(newPos.y - oldPos.y, 2) +
            Math.pow(newPos.z - oldPos.z, 2)
        );

        return distance <= maxDistance;
    }

    /**
     * Krijg spawn positie voor nieuwe speler
     */
    getSpawnPosition() {
        // Eenvoudige spawn logic - random positie binnen spawn area
        return {
            x: Math.random() * 100 - 50, // -50 tot 50
            y: 0,
            z: Math.random() * 100 - 50
        };
    }

    /**
     * Start main game loop
     */
    startGameLoop() {
        const tickInterval = 1000 / this.config.tickRate; // ms per tick

        this.gameLoopInterval = setInterval(() => {
            this.gameTick();
        }, tickInterval);

        console.log(`[GameServer-${this.config.serverId}] Game loop gestart (${this.config.tickRate} Hz)`);
    }

    /**
     * Main game tick
     */
    gameTick() {
        const now = Date.now();
        const deltaTime = (now - this.lastTick) / 1000;
        
        this.tickCount++;
        this.lastTick = now;

        // Update game state
        this.updatePlayers(deltaTime);
        this.updateGameObjects(deltaTime);
        
        // Cleanup disconnected clients
        this.cleanupDisconnectedClients();
        
        // Stuur server status naar master server (elke 10 seconden)
        if (this.tickCount % (this.config.tickRate * 10) === 0) {
            this.reportToMasterServer();
        }
    }

    /**
     * Update alle spelers
     */
    updatePlayers(deltaTime) {
        const now = Date.now();
        const disconnectTimeout = 30000; // 30 seconden

        for (const [playerId, player] of this.players) {
            // Check voor disconnected spelers
            if (now - player.lastUpdate > disconnectTimeout) {
                console.log(`[GameServer-${this.config.serverId}] Speler ${playerId} disconnected (timeout)`);
                this.removePlayer(playerId);
                continue;
            }

            // Update speler logica hier
            // Bijv. health regeneration, buffs/debuffs, etc.
        }
    }

    /**
     * Update game objects
     */
    updateGameObjects(deltaTime) {
        for (const [objectId, gameObject] of this.gameObjects) {
            // Update game object logica
            // Bijv. moving platforms, spawners, etc.
        }
    }

    /**
     * Cleanup disconnected clients
     */
    cleanupDisconnectedClients() {
        const now = Date.now();
        const timeout = 60000; // 60 seconden

        for (const [clientKey, client] of this.clients) {
            if (now - client.lastSeen > timeout) {
                this.clients.delete(clientKey);
            }
        }
    }

    /**
     * Verwijder speler van server
     */
    removePlayer(playerId) {
        const player = this.players.get(playerId);
        if (player) {
            this.players.delete(playerId);
            this.stats.playersConnected = this.players.size;

            // Notify andere spelers
            this.broadcastToAll({
                type: 'PLAYER_LEFT',
                data: { playerId: playerId }
            });

            console.log(`[GameServer-${this.config.serverId}] Speler ${playerId} verwijderd`);
        }
    }

    /**
     * Registreer met master server (Minecraft-style registration)
     */
    async registerWithMasterServer() {
        try {
            console.log(`[GameServer-${this.config.serverId}] Registratie met master server (Minecraft-style)...`);
            
            const registrationData = {
                serverId: this.config.serverId,
                name: `SkaffaCity Game Server ${this.config.serverId}`,
                serverType: 'gameserver',
                ip: process.env.GAME_SERVER_IP || 'localhost',
                port: this.config.port,
                maxPlayers: this.config.maxPlayers,
                currentPlayers: this.players.size,
                gameMode: 'multiplayer',
                region: process.env.GAME_SERVER_REGION || 'EU-West',
                version: '1.0.0',
                status: 'online',
                capabilities: ['UDP', 'realtime', 'multiplayer'],
                worldSize: this.config.worldSize
            };
            
            const response = await axios.post(`${this.config.masterServerUrl}/api/v1/servers/register`, registrationData, {
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': `SkaffaCityGameServer/${registrationData.version}`
                },
                timeout: 10000
            });
            
            if (response.data && response.data.success) {
                console.log(`[GameServer-${this.config.serverId}] ✅ Succesvol geregistreerd bij master server`);
                console.log(`[GameServer-${this.config.serverId}] Server ID: ${response.data.serverId || this.config.serverId}`);
                
                // Start heartbeat naar master server
                this.startHeartbeat();
            } else {
                throw new Error('Registration response invalid');
            }
            
        } catch (error) {
            console.error(`[GameServer-${this.config.serverId}] ❌ Master server registratie mislukt:`, error.message);
            console.log(`[GameServer-${this.config.serverId}] Retrying in 30 seconds...`);
            
            // Retry after 30 seconds
            setTimeout(() => {
                this.registerWithMasterServer();
            }, 30000);
        }
    }

    /**
     * Start heartbeat naar master server (Minecraft-style keep-alive)
     */
    startHeartbeat() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
        }
        
        this.heartbeatInterval = setInterval(() => {
            this.reportToMasterServer();
        }, 30000); // Elke 30 seconden
        
        console.log(`[GameServer-${this.config.serverId}] Heartbeat started (30s interval)`);
    }

    /**
     * Rapporteer status naar master server (Minecraft-style heartbeat)
     */
    async reportToMasterServer() {
        try {
            const status = {
                serverId: this.config.serverId,
                currentPlayers: this.players.size,
                maxPlayers: this.config.maxPlayers,
                status: this.isRunning ? 'online' : 'offline',
                performance: {
                    uptime: Date.now() - this.stats.uptime,
                    packetsReceived: this.stats.packetsReceived,
                    packetsSent: this.stats.packetsSent,
                    tickRate: this.config.tickRate,
                    currentTick: this.tickCount,
                    memoryUsage: process.memoryUsage()
                }
            };

            const response = await axios.post(`${this.config.masterServerUrl}/api/v1/servers/heartbeat`, status, {
                headers: {
                    'Content-Type': 'application/json'
                },
                timeout: 5000
            });

            if (response.data && response.data.success) {
                console.log(`[GameServer-${this.config.serverId}] Heartbeat sent: ${status.currentPlayers}/${status.maxPlayers} spelers`);
            }
        } catch (error) {
            console.error(`[GameServer-${this.config.serverId}] Heartbeat failed:`, error.message);
        }
    }

    /**
     * Unregister van master server (cleanup bij shutdown)
     */
    async unregisterFromMasterServer() {
        try {
            console.log(`[GameServer-${this.config.serverId}] Unregistering from master server...`);
            
            await axios.delete(`${this.config.masterServerUrl}/api/v1/servers/unregister/${this.config.serverId}`, {
                timeout: 5000
            });
            
            console.log(`[GameServer-${this.config.serverId}] ✅ Successfully unregistered from master server`);
        } catch (error) {
            console.error(`[GameServer-${this.config.serverId}] Unregister failed:`, error.message);
        }
    }

    /**
     * Stop de game server
     */
    async stop() {
        console.log(`[GameServer-${this.config.serverId}] Server stoppen...`);
        
        this.isRunning = false;
        
        // Stop alle intervals
        if (this.gameLoopInterval) {
            clearInterval(this.gameLoopInterval);
        }
        
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
        }
        
        // Unregister van master server
        try {
            await this.unregisterFromMasterServer();
        } catch (error) {
            console.error(`[GameServer-${this.config.serverId}] Unregister failed:`, error.message);
        }
        
        if (this.socket) {
            this.socket.close();
        }
        
        console.log(`[GameServer-${this.config.serverId}] ✅ Server gestopt`);
    }
}

// Start server als dit bestand direct wordt uitgevoerd
if (require.main === module) {
    const gameServer = new SkaffaCityGameServer();
    
    // Graceful shutdown
    process.on('SIGTERM', async () => {
        await gameServer.stop();
        process.exit(0);
    });
    
    process.on('SIGINT', async () => {
        await gameServer.stop();
        process.exit(0);
    });
    
    // Start server
    gameServer.start().catch(error => {
        console.error('Game server start mislukt:', error.message);
        process.exit(1);
    });
}

module.exports = SkaffaCityGameServer;