/**
 * Game Server Manager
 * Beheert UDP game server instances via Pterodactyl Panel
 */

const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

class GameServerManager {
    constructor() {
        this.servers = new Map(); // serverId -> serverInfo
        this.playerQueue = new Map(); // playerId -> queueInfo
        
        // Load configuration from ConfigManager or fallback to environment variables
        const gameserverConfig = global.configManager ? global.configManager.getConfig('gameserver') : null;
        
        // Pterodactyl Panel Configuration - try modular config first, then env vars
        this.pterodactylConfig = {
            apiUrl: gameserverConfig?.pterodactyl?.apiUrl || process.env.PTERODACTYL_API_URL || 'https://panel.yourdomain.com/api',
            apiKey: gameserverConfig?.pterodactyl?.apiKey || process.env.PTERODACTYL_API_KEY || '',
            adminApiKey: gameserverConfig?.pterodactyl?.adminApiKey || process.env.PTERODACTYL_ADMIN_API_KEY || '',
            clientApiKey: gameserverConfig?.pterodactyl?.clientApiKey || process.env.PTERODACTYL_CLIENT_API_KEY || '',
            gameServerNestId: gameserverConfig?.pterodactyl?.nestId || process.env.GAME_SERVER_NEST_ID || '1',
            gameServerEggId: gameserverConfig?.pterodactyl?.eggId || process.env.GAME_SERVER_EGG_ID || '1'
        };
        
        this.serverConfig = {
            maxPlayersPerServer: gameserverConfig?.maxPlayersPerServer || parseInt(process.env.MAX_PLAYERS_PER_SERVER) || 50,
            serverStartPort: gameserverConfig?.serverStartPort || parseInt(process.env.SERVER_START_PORT) || 7001,
            autoScaleEnabled: gameserverConfig?.autoScale || (process.env.AUTO_SCALE_ENABLED === 'true') || true,
            minIdleServers: gameserverConfig?.minIdleServers || parseInt(process.env.MIN_IDLE_SERVERS) || 1,
            maxTotalServers: gameserverConfig?.maxServers || parseInt(process.env.MAX_TOTAL_SERVERS) || 10
        };
        
        console.log('[GameServerManager] Geïnitialiseerd met configuratie:', this.serverConfig);
        
        // Check if we have valid configuration
        if (!this.pterodactylConfig.apiKey && !this.pterodactylConfig.adminApiKey) {
            console.warn('[GameServerManager] ⚠️ Geen API keys geconfigureerd - Pterodactyl functionaliteit niet beschikbaar');
        }
    }

    /**
     * Initialize game server management
     */
    async initialize() {
        console.log('[GameServerManager] Initialisatie starten...');
        
        try {
            // Test Pterodactyl API verbinding
            await this.testPterodactylConnection();
            
            // Laad bestaande servers van Pterodactyl
            await this.discoverExistingServers();
            
            // Start monitoring loop
            this.startMonitoring();
            
            // Zorg voor minimaal aantal idle servers
            await this.ensureMinimumIdleServers();
            
            console.log('[GameServerManager] ✅ Initialisatie voltooid!');
            return true;
        } catch (error) {
            console.error('[GameServerManager] ❌ Initialisatie mislukt:', error.message);
            return false;
        }
    }

    /**
     * Test verbinding met Pterodactyl Panel
     */
    async testPterodactylConnection() {
        const apiKey = this.pterodactylConfig.adminApiKey || this.pterodactylConfig.apiKey;
        if (!apiKey) {
            throw new Error('Geen Pterodactyl API key geconfigureerd (adminApiKey of apiKey vereist)');
        }

        console.log('[GameServerManager] Pterodactyl verbinding testen...');
        
        const response = await axios.get(`${this.pterodactylConfig.apiUrl}/application/users`, {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            }
        });

        if (response.status === 200) {
            console.log('[GameServerManager] ✅ Pterodactyl API verbinding succesvol');
            return true;
        } else {
            throw new Error(`Pterodactyl API fout: ${response.status}`);
        }
    }

    /**
     * Ontdek bestaande game servers in Pterodactyl
     */
    async discoverExistingServers() {
        console.log('[GameServerManager] Bestaande servers ontdekken...');
        
        try {
            const response = await axios.get(`${this.pterodactylConfig.apiUrl}/application/servers`, {
                headers: {
                    'Authorization': `Bearer ${this.pterodactylConfig.apiKey}`,
                    'Content-Type': 'application/json'
                }
            });

            const pterodactylServers = response.data.data || [];
            let gameServerCount = 0;

            for (const server of pterodactylServers) {
                // Filter alleen SkaffaCity game servers (gebaseerd op naam/tags)
                if (server.attributes.name.startsWith('SkaffaCity-GameServer-')) {
                    const serverInfo = {
                        pterodactylId: server.attributes.id,
                        uuid: server.attributes.uuid,
                        name: server.attributes.name,
                        status: 'unknown',
                        playerCount: 0,
                        maxPlayers: this.serverConfig.maxPlayersPerServer,
                        port: this.extractPortFromServer(server),
                        lastUpdate: Date.now()
                    };

                    this.servers.set(server.attributes.uuid, serverInfo);
                    gameServerCount++;
                }
            }

            console.log(`[GameServerManager] ✅ ${gameServerCount} bestaande game servers gevonden`);
        } catch (error) {
            console.error('[GameServerManager] Fout bij ontdekken servers:', error.message);
        }
    }

    /**
     * Extraheer poort nummer van Pterodactyl server configuratie
     */
    extractPortFromServer(server) {
        try {
            // Parse allocations voor poort info
            const allocations = server.attributes.relationships?.allocations?.data || [];
            if (allocations.length > 0) {
                return allocations[0].attributes.port;
            }
            return this.serverConfig.serverStartPort;
        } catch (error) {
            return this.serverConfig.serverStartPort;
        }
    }

    /**
     * Maak nieuwe game server aan via Pterodactyl
     */
    async createGameServer() {
        console.log('[GameServerManager] Nieuwe game server aanmaken...');

        if (this.servers.size >= this.serverConfig.maxTotalServers) {
            throw new Error('Maximum aantal servers bereikt');
        }

        const serverId = uuidv4();
        const serverName = `SkaffaCity-GameServer-${Date.now()}`;
        const serverPort = this.serverConfig.serverStartPort + this.servers.size;

        try {
            // Get configuration from modular config
            const gameserverConfig = global.configManager ? global.configManager.getConfig('gameserver') : null;
            const serverTemplate = gameserverConfig?.serverTemplate || {};
            
            // Pterodactyl server creation request with proper structure
            const createRequest = {
                name: serverName,
                description: serverTemplate.description || 'SkaffaCity UDP Game Server Instance',
                user: 1, // Admin user ID - you may need to change this
                egg: parseInt(serverTemplate.egg) || parseInt(this.pterodactylConfig.gameServerEggId) || 5,
                docker_image: serverTemplate.docker_image || 'ghcr.io/pterodactyl/yolks:nodejs_18',
                startup: serverTemplate.startup || 'node gameserver.js',
                limits: serverTemplate.limits || {
                    memory: 512,
                    swap: 0,
                    disk: 1024,
                    io: 500,
                    cpu: 100
                },
                feature_limits: serverTemplate.feature_limits || {
                    databases: 0,
                    allocations: 1,
                    backups: 0
                },
                allocation: {
                    default: serverPort
                },
                environment: {
                    ...(serverTemplate.environment || {}),
                    GAME_SERVER_ID: serverId,
                    GAME_SERVER_PORT: serverPort.toString(),
                    MASTER_SERVER_URL: process.env.MASTER_SERVER_URL || 'https://localhost:8443',
                    MAX_PLAYERS: this.serverConfig.maxPlayersPerServer.toString()
                }
            };
            
            console.log('[GameServerManager] 📋 Creating server with config:', JSON.stringify(createRequest, null, 2));

            const response = await axios.post(
                `${this.pterodactylConfig.apiUrl}/application/servers`,
                createRequest,
                {
                    headers: {
                        'Authorization': `Bearer ${this.pterodactylConfig.apiKey}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            if (response.status === 201) {
                const serverInfo = {
                    pterodactylId: response.data.attributes.id,
                    uuid: response.data.attributes.uuid,
                    name: serverName,
                    status: 'starting',
                    playerCount: 0,
                    maxPlayers: this.serverConfig.maxPlayersPerServer,
                    port: serverPort,
                    lastUpdate: Date.now()
                };

                this.servers.set(serverId, serverInfo);
                
                console.log(`[GameServerManager] ✅ Game server aangemaakt: ${serverName} (Poort: ${serverPort})`);
                
                // Start de server
                await this.startServer(serverId);
                
                return serverInfo;
            }
        } catch (error) {
            console.error('[GameServerManager] ❌ Fout bij aanmaken server:', error.message);
            
            // Log more detailed error information
            if (error.response) {
                console.error('[GameServerManager] 📊 API Response Status:', error.response.status);
                console.error('[GameServerManager] 📋 API Response Data:', JSON.stringify(error.response.data, null, 2));
                
                if (error.response.data && error.response.data.errors) {
                    console.error('[GameServerManager] 🔍 Validation Errors:');
                    error.response.data.errors.forEach((err, index) => {
                        console.error(`  ${index + 1}. ${err.detail} (Field: ${err.meta?.source_field || 'unknown'})`);
                    });
                }
            }
            
            throw error;
        }
    }

    /**
     * Start een game server via Pterodactyl
     */
    async startServer(serverId) {
        const server = this.servers.get(serverId);
        if (!server) {
            throw new Error(`Server ${serverId} niet gevonden`);
        }

        try {
            await axios.post(
                `${this.pterodactylConfig.apiUrl}/client/servers/${server.uuid}/power`,
                { signal: 'start' },
                {
                    headers: {
                        'Authorization': `Bearer ${this.pterodactylConfig.apiKey}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            server.status = 'starting';
            server.lastUpdate = Date.now();

            console.log(`[GameServerManager] Server ${server.name} wordt gestart...`);
        } catch (error) {
            console.error(`[GameServerManager] Fout bij starten server ${serverId}:`, error.message);
            throw error;
        }
    }

    /**
     * Stop een game server via Pterodactyl
     */
    async stopServer(serverId) {
        const server = this.servers.get(serverId);
        if (!server) {
            throw new Error(`Server ${serverId} niet gevonden`);
        }

        try {
            await axios.post(
                `${this.pterodactylConfig.apiUrl}/client/servers/${server.uuid}/power`,
                { signal: 'stop' },
                {
                    headers: {
                        'Authorization': `Bearer ${this.pterodactylConfig.apiKey}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            server.status = 'stopping';
            server.lastUpdate = Date.now();

            console.log(`[GameServerManager] Server ${server.name} wordt gestopt...`);
        } catch (error) {
            console.error(`[GameServerManager] Fout bij stoppen server ${serverId}:`, error.message);
            throw error;
        }
    }

    /**
     * Verwijder een game server via Pterodactyl
     */
    async deleteServer(serverId) {
        const server = this.servers.get(serverId);
        if (!server) {
            throw new Error(`Server ${serverId} niet gevonden`);
        }

        try {
            // Stop eerst de server
            await this.stopServer(serverId);
            
            // Wacht kort voor deletion
            setTimeout(async () => {
                await axios.delete(
                    `${this.pterodactylConfig.apiUrl}/application/servers/${server.pterodactylId}`,
                    {
                        headers: {
                            'Authorization': `Bearer ${this.pterodactylConfig.apiKey}`,
                            'Content-Type': 'application/json'
                        }
                    }
                );

                this.servers.delete(serverId);
                console.log(`[GameServerManager] ✅ Server ${server.name} verwijderd`);
            }, 5000);

        } catch (error) {
            console.error(`[GameServerManager] Fout bij verwijderen server ${serverId}:`, error.message);
            throw error;
        }
    }

    /**
     * Zoek beste beschikbare server voor speler
     */
    findBestServer() {
        let bestServer = null;
        let lowestPlayerCount = this.serverConfig.maxPlayersPerServer;

        for (const [serverId, server] of this.servers) {
            if (server.status === 'running' && server.playerCount < server.maxPlayers) {
                if (server.playerCount < lowestPlayerCount) {
                    lowestPlayerCount = server.playerCount;
                    bestServer = server;
                }
            }
        }

        return bestServer;
    }

    /**
     * Zorg voor minimaal aantal idle servers
     */
    async ensureMinimumIdleServers() {
        const idleServers = Array.from(this.servers.values()).filter(
            server => server.status === 'running' && server.playerCount === 0
        );

        const neededServers = this.serverConfig.minIdleServers - idleServers.length;

        if (neededServers > 0 && this.servers.size < this.serverConfig.maxTotalServers) {
            console.log(`[GameServerManager] ${neededServers} extra idle servers aanmaken...`);
            
            for (let i = 0; i < neededServers; i++) {
                try {
                    await this.createGameServer();
                } catch (error) {
                    console.error('[GameServerManager] Fout bij aanmaken idle server:', error.message);
                    break;
                }
            }
        }
    }

    /**
     * Start monitoring loop voor server health
     */
    startMonitoring() {
        setInterval(async () => {
            await this.updateServerStatus();
            await this.ensureMinimumIdleServers();
        }, 30000); // Elke 30 seconden

        console.log('[GameServerManager] ✅ Server monitoring gestart');
    }

    /**
     * Update status van alle servers
     */
    async updateServerStatus() {
        for (const [serverId, server] of this.servers) {
            try {
                // Ping server voor status update
                // Dit zou via UDP ping of health check endpoint kunnen
                // Voor nu simuleren we status updates
                
                if (server.status === 'starting' && Date.now() - server.lastUpdate > 60000) {
                    server.status = 'running';
                }
                
            } catch (error) {
                console.error(`[GameServerManager] Status update fout voor ${serverId}:`, error.message);
            }
        }
    }

    /**
     * Krijg alle server informatie
     */
    getAllServers() {
        return Array.from(this.servers.values()).map(server => ({
            id: server.uuid,
            name: server.name,
            status: server.status,
            playerCount: server.playerCount,
            maxPlayers: server.maxPlayers,
            port: server.port,
            address: process.env.GAME_SERVER_HOST || 'localhost'
        }));
    }

    /**
     * Voeg speler toe aan server queue
     */
    async joinServerQueue(playerId, preferredServerId = null) {
        console.log(`[GameServerManager] Speler ${playerId} toegevoegd aan server queue`);

        let targetServer = null;

        if (preferredServerId) {
            targetServer = this.servers.get(preferredServerId);
        }

        if (!targetServer || targetServer.playerCount >= targetServer.maxPlayers) {
            targetServer = this.findBestServer();
        }

        if (!targetServer) {
            // Geen beschikbare servers, maak nieuwe aan
            if (this.servers.size < this.serverConfig.maxTotalServers) {
                targetServer = await this.createGameServer();
            } else {
                throw new Error('Alle servers zijn vol, probeer later opnieuw');
            }
        }

        // Voeg speler toe aan queue
        this.playerQueue.set(playerId, {
            serverId: targetServer.uuid,
            queueTime: Date.now(),
            status: 'queued'
        });

        return {
            serverId: targetServer.uuid,
            serverAddress: process.env.GAME_SERVER_HOST || 'localhost',
            serverPort: targetServer.port,
            queuePosition: 1, // Implementeer echte queue logica indien nodig
            estimatedWaitTime: 0
        };
    }

    /**
     * List all game servers
     */
    async listServers() {
        console.log('[GameServerManager] Servers ophalen van Pterodactyl...');
        
        const apiKey = this.pterodactylConfig.adminApiKey || this.pterodactylConfig.apiKey;
        if (!apiKey) {
            throw new Error('Geen API key geconfigureerd voor server listing');
        }

        try {
            const response = await axios.get(`${this.pterodactylConfig.apiUrl}/application/servers`, {
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.status === 200) {
                return response.data.data || [];
            } else {
                throw new Error(`Pterodactyl API error: ${response.status}`);
            }
        } catch (error) {
            console.error('[GameServerManager] ❌ Error listing servers:', error.message);
            throw error;
        }
    }

    /**
     * Create a new server (alias for createGameServer)
     */
    async createServer() {
        return await this.createGameServer();
    }

    /**
     * Check Pterodactyl connection (alias for testPterodactylConnection)
     */
    async checkPterodactylConnection() {
        try {
            await this.testPterodactylConnection();
            return { status: 'connected', message: 'Pterodactyl API connection successful' };
        } catch (error) {
            return { status: 'error', message: error.message };
        }
    }

    /**
     * Scale servers to target count
     */
    async scaleServers(targetCount) {
        console.log(`[GameServerManager] Scaling to ${targetCount} servers...`);
        
        const currentServers = await this.listServers();
        const currentCount = currentServers.length;
        
        if (targetCount > currentCount) {
            // Scale up - create new servers
            const serversToCreate = targetCount - currentCount;
            console.log(`[GameServerManager] Creating ${serversToCreate} new servers...`);
            
            for (let i = 0; i < serversToCreate; i++) {
                try {
                    await this.createGameServer();
                    console.log(`[GameServerManager] ✅ Server ${i + 1}/${serversToCreate} created`);
                } catch (error) {
                    console.error(`[GameServerManager] ❌ Failed to create server ${i + 1}: ${error.message}`);
                }
            }
        } else if (targetCount < currentCount) {
            // Scale down - stop excess servers
            const serversToStop = currentCount - targetCount;
            console.log(`[GameServerManager] Stopping ${serversToStop} servers...`);
            
            for (let i = 0; i < serversToStop && i < currentServers.length; i++) {
                try {
                    await this.stopServer(currentServers[i].attributes.id);
                    console.log(`[GameServerManager] ✅ Server ${i + 1}/${serversToStop} stopped`);
                } catch (error) {
                    console.error(`[GameServerManager] ❌ Failed to stop server: ${error.message}`);
                }
            }
        } else {
            console.log(`[GameServerManager] Already at target count: ${targetCount}`);
        }
        
        return { targetCount, currentCount, action: targetCount > currentCount ? 'scaled_up' : targetCount < currentCount ? 'scaled_down' : 'no_change' };
    }

    /**
     * Get server info from local servers map
     */
    getLocalServers() {
        return Array.from(this.servers.values());
    }
}

module.exports = GameServerManager;