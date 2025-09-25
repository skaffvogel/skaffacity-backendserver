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
            apiUrl: gameserverConfig?.pterodactyl?.apiUrl || process.env.PTERODACTYL_API_URL || 'https://panel.lvlagency.nl/api',
            apiKey: gameserverConfig?.pterodactyl?.apiKey || process.env.PTERODACTYL_API_KEY || '',
            adminApiKey: gameserverConfig?.pterodactyl?.adminApiKey || process.env.PTERODACTYL_ADMIN_API_KEY || '',
            clientApiKey: gameserverConfig?.pterodactyl?.clientApiKey || process.env.PTERODACTYL_CLIENT_API_KEY || '',
            gameServerNestId: gameserverConfig?.pterodactyl?.nestId || process.env.GAME_SERVER_NEST_ID || '5',
            gameServerEggId: gameserverConfig?.pterodactyl?.eggId || process.env.GAME_SERVER_EGG_ID || '20'
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
    async createGameServer(templateOverride = null) {
        console.log('[GameServerManager] Nieuwe game server aanmaken...');

        if (this.servers.size >= this.serverConfig.maxTotalServers) {
            throw new Error('Maximum aantal servers bereikt');
        }

        const serverId = uuidv4();
        const serverName = `SkaffaCity-GameServer-${Date.now()}`;

        try {
            // Find next available port based on existing servers
            console.log('[GameServerManager] 🔍 Finding next available port...');
            const nextPort = await this.getNextAvailablePort();
            
            // Get allocation for the selected port
            console.log(`[GameServerManager] 🔍 Getting allocation for port ${nextPort}...`);
            let allocation = await this.ensureAllocationExists(nextPort);
            
            // If the port allocation is already assigned, the getNextAvailablePort should have found a different one
            if (allocation.assigned) {
                console.log(`[GameServerManager] ⚠️ Port ${nextPort} allocation is already assigned, this shouldn't happen`);
                console.log(`[GameServerManager] 🔄 Finding any available allocation as fallback...`);
                allocation = await this.findAvailableAllocation();
            }
            
            console.log(`[GameServerManager] ✅ Using allocation ID: ${allocation.id} (${allocation.ip}:${allocation.port})`);
            
            // Double-check allocation is really available
            if (allocation.assigned) {
                throw new Error(`Allocation ${allocation.id} is already assigned - no available allocations found`);
            }

            // Get configuration from modular config or use override
            const gameserverConfig = global.configManager ? global.configManager.getConfig('gameserver') : null;
            const serverTemplate = templateOverride || gameserverConfig?.serverTemplate || {};
            
            // Use admin API key for server creation
            const apiKey = this.pterodactylConfig.adminApiKey || this.pterodactylConfig.apiKey;
            if (!apiKey) {
                throw new Error('Admin API key vereist voor server creation');
            }
            
            // Complete Pterodactyl server creation request with ALL required fields
            const createRequest = {
                name: serverName,
                description: serverTemplate.description || 'SkaffaCity UDP Game Server Instance',
                user: parseInt(serverTemplate.user) || 1, // Admin user ID
                egg: parseInt(serverTemplate.egg) || parseInt(this.pterodactylConfig.gameServerEggId) || 20,
                docker_image: serverTemplate.docker_image || 'ghcr.io/pterodactyl/yolks:ubuntu',
                startup: serverTemplate.startup || './{{SERVER_JARFILE}} -batchmode -nographics -port {{SERVER_PORT}} -masterServer {{MASTER_SERVER_URL}} -serverName "{{SERVER_NAME}}" -maxPlayers {{MAX_PLAYERS}} -tickRate {{TICK_RATE}} -logFile logs/server.log -region {{REGION}} -gameMode {{GAME_MODE}} -autoUpdate {{AUTO_UPDATE}}',
                oom_disabled: serverTemplate.oom_disabled || false,
                limits: {
                    memory: parseInt(serverTemplate.limits?.memory) || 512,
                    swap: parseInt(serverTemplate.limits?.swap) || 0,
                    disk: parseInt(serverTemplate.limits?.disk) || 1024,
                    io: parseInt(serverTemplate.limits?.io) || 500,
                    cpu: parseInt(serverTemplate.limits?.cpu) || 100,
                    threads: serverTemplate.limits?.threads || null
                },
                feature_limits: {
                    databases: parseInt(serverTemplate.feature_limits?.databases) || 0,
                    allocations: parseInt(serverTemplate.feature_limits?.allocations) || 1,
                    backups: parseInt(serverTemplate.feature_limits?.backups) || 0
                },
                allocation: {
                    default: parseInt(allocation.id)
                },
                environment: {
                    // SkaffaCity Unity Server Egg Variables
                    SERVER_JARFILE: serverTemplate.environment?.SERVER_JARFILE || 'auto-detect',
                    MASTER_SERVER_URL: serverTemplate.environment?.MASTER_SERVER_URL || process.env.MASTER_SERVER_URL || 'http://localhost:8000',
                    SERVER_NAME: serverTemplate.environment?.SERVER_NAME || `SkaffaCity Server #${allocation.port}`,
                    MAX_PLAYERS: serverTemplate.environment?.MAX_PLAYERS || this.serverConfig.maxPlayersPerServer.toString(),
                    TICK_RATE: serverTemplate.environment?.TICK_RATE || '30',
                    REGION: serverTemplate.environment?.REGION || 'EU-West',
                    GAME_MODE: serverTemplate.environment?.GAME_MODE || 'standard',
                    
                    // Git Repository Integration (New Method)
                    GIT_REPOSITORY: serverTemplate.environment?.GIT_REPOSITORY || 'https://github.com/skaffvogel/skaffacity-serverbuild.git',
                    GIT_BRANCH: serverTemplate.environment?.GIT_BRANCH || 'main',
                    GIT_ACCESS_TOKEN: serverTemplate.environment?.GIT_ACCESS_TOKEN || '',
                    
                    // GitHub Integration for Auto Updates (Legacy Support)
                    GITHUB_REPO: serverTemplate.environment?.GITHUB_REPO || 'skaffvogel/skaffacity-serverbuild',
                    GITHUB_BRANCH: serverTemplate.environment?.GITHUB_BRANCH || 'main',
                    AUTO_UPDATE: serverTemplate.environment?.AUTO_UPDATE || '1',
                    
                    // Fallback download URL (only used if GitHub fails or is disabled)
                    DOWNLOAD_URL: serverTemplate.environment?.DOWNLOAD_URL || '',
                    
                    // Server Management
                    AUTO_RESTART: serverTemplate.environment?.AUTO_RESTART || '1',
                    DEBUG_MODE: serverTemplate.environment?.DEBUG_MODE || '0',
                    
                    // Internal tracking
                    SKAFFA_SERVER_ID: serverId,
                    SKAFFA_CREATED_BY: 'GameServerManager',
                    SKAFFA_CREATED_AT: new Date().toISOString(),
                    
                    // Essential environment variables only (configuration comes from API)
                    SERVER_PORT: allocation.port.toString(),
                    
                    // Spread any additional environment variables from template
                    ...(serverTemplate.environment || {})
                }
            };
            
            console.log('[GameServerManager] 📋 Creating server with config:', JSON.stringify(createRequest, null, 2));

            const response = await axios.post(
                `${this.pterodactylConfig.apiUrl}/application/servers`,
                createRequest,
                {
                    headers: {
                        'Authorization': `Bearer ${apiKey}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            if (response.status === 201) {
                const serverData = response.data.attributes;
                const serverInfo = {
                    pterodactylId: serverData.id,
                    uuid: serverData.uuid,
                    name: serverName,
                    status: 'created',
                    playerCount: 0,
                    maxPlayers: this.serverConfig.maxPlayersPerServer,
                    port: allocation.port,
                    ip: allocation.ip,
                    lastUpdate: Date.now()
                };

                this.servers.set(serverId, serverInfo);
                
                console.log(`[GameServerManager] ✅ Game server aangemaakt: ${serverName} (Poort: ${allocation.port})`);
                console.log(`[GameServerManager] 🆔 Server UUID: ${serverData.uuid}`);
                console.log(`[GameServerManager] 🌐 Server toegankelijk op: ${allocation.ip}:${allocation.port}`);
                
                return {
                    id: serverData.id,
                    uuid: serverData.uuid,
                    name: serverName,
                    port: allocation.port,
                    ip: allocation.ip,
                    ...serverInfo
                };
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
     * Create a new server with specific template override
     */
    async createServerWithTemplate(templateOverride) {
        return await this.createGameServer(templateOverride);
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
     * Verify allocation is available for assignment
     */
    async verifyAllocationAvailable(allocationId) {
        const apiKey = this.pterodactylConfig.adminApiKey || this.pterodactylConfig.apiKey;
        
        try {
            console.log(`[GameServerManager] 🔍 Verifying allocation ${allocationId} is available...`);
            
            // Get all allocations to check availability
            const allocationsResponse = await axios.get(`${this.pterodactylConfig.apiUrl}/application/nodes/1/allocations`, {
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (allocationsResponse.data && allocationsResponse.data.data) {
                const allocation = allocationsResponse.data.data.find(alloc => 
                    alloc.attributes && alloc.attributes.id === parseInt(allocationId)
                );
                
                if (!allocation) {
                    throw new Error(`Allocation ${allocationId} not found`);
                }
                
                if (allocation.attributes.assigned) {
                    console.log(`[GameServerManager] ⚠️ Allocation ${allocationId} is already assigned to server ${allocation.attributes.server}`);
                    throw new Error(`Allocation ${allocationId} is already assigned`);
                }
                
                console.log(`[GameServerManager] ✅ Allocation ${allocationId} is available for assignment`);
                return allocation.attributes;
            }
            
            throw new Error('Could not retrieve allocations');
            
        } catch (error) {
            console.error(`[GameServerManager] ❌ Error verifying allocation: ${error.message}`);
            throw error;
        }
    }

    /**
     * Find any available (unassigned) allocation
     */
    async findAvailableAllocation() {
        const apiKey = this.pterodactylConfig.adminApiKey || this.pterodactylConfig.apiKey;
        
        try {
            console.log(`[GameServerManager] 🔍 Finding available allocation...`);
            
            const allocationsResponse = await axios.get(`${this.pterodactylConfig.apiUrl}/application/nodes/1/allocations`, {
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (allocationsResponse.data && allocationsResponse.data.data) {
                // Find first unassigned allocation
                const availableAllocation = allocationsResponse.data.data.find(alloc => 
                    alloc.attributes && !alloc.attributes.assigned
                );
                
                if (availableAllocation) {
                    console.log(`[GameServerManager] ✅ Found available allocation: ${availableAllocation.attributes.id} (port ${availableAllocation.attributes.port})`);
                    return {
                        id: availableAllocation.attributes.id,
                        port: availableAllocation.attributes.port,
                        ip: availableAllocation.attributes.ip
                    };
                }
            }
            
            throw new Error('No available allocations found - create more allocations in Pterodactyl Panel');
            
        } catch (error) {
            console.error(`[GameServerManager] ❌ Error finding allocation: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get next available port starting from serverStartPort
     */
    async getNextAvailablePort() {
        try {
            console.log(`[GameServerManager] 🔍 Looking for available port starting from ${this.serverConfig.serverStartPort}...`);
            
            // Get all allocations to see which ports are assigned
            const apiKey = this.pterodactylConfig.adminApiKey || this.pterodactylConfig.apiKey;
            const allocationsResponse = await axios.get(`${this.pterodactylConfig.apiUrl}/application/nodes/1/allocations`, {
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                }
            });
            
            const assignedPorts = new Set();
            const availablePorts = new Map(); // port -> allocation info
            
            if (allocationsResponse.data && allocationsResponse.data.data) {
                for (const alloc of allocationsResponse.data.data) {
                    const port = alloc.attributes.port;
                    
                    if (alloc.attributes.assigned) {
                        assignedPorts.add(port);
                    } else {
                        // Store available allocation info
                        availablePorts.set(port, {
                            id: alloc.attributes.id,
                            port: port,
                            ip: alloc.attributes.ip
                        });
                    }
                }
            }
            
            console.log(`[GameServerManager] 📊 Assigned ports: [${Array.from(assignedPorts).sort().join(', ') || 'none'}]`);
            console.log(`[GameServerManager] 📊 Available ports: [${Array.from(availablePorts.keys()).sort().join(', ') || 'none'}]`);
            
            // Find next available port in our preferred range (7001+)
            let targetPort = this.serverConfig.serverStartPort;
            const maxSearchRange = 100; // Search up to 100 ports ahead
            
            for (let i = 0; i < maxSearchRange; i++) {
                const candidatePort = targetPort + i;
                
                // Check if this port has an available allocation
                if (availablePorts.has(candidatePort)) {
                    console.log(`[GameServerManager] 🎯 Found preferred port in range: ${candidatePort}`);
                    return candidatePort;
                }
            }
            
            // If no port in preferred range, use any available port
            const anyAvailablePort = Array.from(availablePorts.keys()).sort((a, b) => a - b)[0];
            if (anyAvailablePort) {
                console.log(`[GameServerManager] 🎯 Using any available port: ${anyAvailablePort}`);
                return anyAvailablePort;
            }
            
            // No available allocations found
            throw new Error(`No available allocations found. Create more port allocations in Pterodactyl Panel (range ${this.serverConfig.serverStartPort}-${this.serverConfig.serverStartPort + maxSearchRange})`);
            
        } catch (error) {
            console.warn(`[GameServerManager] ⚠️ Error finding available port: ${error.message}`);
            // Fallback: use server start port (may fail if allocation doesn't exist)
            return this.serverConfig.serverStartPort;
        }
    }

    /**
     * Ensure allocation exists for the given port, create if it doesn't exist
     */
    async ensureAllocationExists(port) {
        const apiKey = this.pterodactylConfig.adminApiKey || this.pterodactylConfig.apiKey;
        
        try {
            // First, get all allocations to see if this port exists
            console.log(`[GameServerManager] 🔍 Ensuring allocation exists for port ${port}...`);
            
            const allocationsResponse = await axios.get(`${this.pterodactylConfig.apiUrl}/application/nodes/1/allocations`, {
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                }
            });
            
            // Check if allocation for this port already exists
            if (allocationsResponse.data && allocationsResponse.data.data) {
                const existingAllocation = allocationsResponse.data.data.find(alloc => 
                    alloc.attributes && alloc.attributes.port === port
                );
                
                if (existingAllocation) {
                    const allocationStatus = existingAllocation.attributes.assigned ? 'assigned' : 'available';
                    console.log(`[GameServerManager] ✅ Allocation exists for port ${port} (${allocationStatus})`);
                    return {
                        id: existingAllocation.attributes.id,
                        port: existingAllocation.attributes.port,
                        ip: existingAllocation.attributes.ip,
                        assigned: existingAllocation.attributes.assigned
                    };
                }
            }
            
            // Allocation doesn't exist, create it
            console.log(`[GameServerManager] 🔨 Creating new allocation for port ${port}...`);
            
            // Get IP and alias from existing allocations to match the pattern
            let nodeIP = '0.0.0.0';
            let nodeAlias = null;
            
            if (allocationsResponse.data && allocationsResponse.data.data && allocationsResponse.data.data.length > 0) {
                const firstAllocation = allocationsResponse.data.data[0].attributes;
                nodeIP = firstAllocation.ip;
                nodeAlias = firstAllocation.alias || firstAllocation.ip_alias; // Try both property names
                console.log(`[GameServerManager] 📡 Using existing node IP: ${nodeIP}${nodeAlias ? ` (alias: ${nodeAlias})` : ''}`);
                console.log('[GameServerManager] 🔍 First allocation details:', JSON.stringify(firstAllocation, null, 2));
            }
            
            const createAllocationRequest = {
                ip: nodeIP,
                ports: [port.toString()], // Pterodactyl expects an array of port strings
                assigned: false
            };
            
            // Add alias if it exists on other allocations (try both property names)
            if (nodeAlias) {
                createAllocationRequest.alias = nodeAlias;
            }
            
            console.log('[GameServerManager] 📋 Create allocation request:', JSON.stringify(createAllocationRequest, null, 2));
            
            const createResponse = await axios.post(
                `${this.pterodactylConfig.apiUrl}/application/nodes/1/allocations`,
                createAllocationRequest,
                {
                    headers: {
                        'Authorization': `Bearer ${apiKey}`,
                        'Content-Type': 'application/json'
                    }
                }
            );
            
            if (createResponse.status === 201 || createResponse.status === 200) {
                console.log(`[GameServerManager] ✅ Created new allocation for port ${port}`);
                console.log('[GameServerManager] 📋 Allocation response:', JSON.stringify(createResponse.data, null, 2));
                
                // Handle different response structures
                const allocationData = createResponse.data;
                if (allocationData.data && Array.isArray(allocationData.data)) {
                    // Multiple allocations created, get the first one
                    const allocation = allocationData.data[0];
                    return {
                        id: allocation.attributes.id,
                        port: allocation.attributes.port,
                        ip: allocation.attributes.ip
                    };
                } else if (allocationData.attributes) {
                    // Single allocation response
                    return {
                        id: allocationData.attributes.id,
                        port: allocationData.attributes.port,
                        ip: allocationData.attributes.ip
                    };
                } else {
                    console.error('[GameServerManager] ❌ Unexpected allocation response structure');
                    throw new Error('Unexpected allocation response structure');
                }
            }
            
        } catch (error) {
            console.error(`[GameServerManager] ❌ Error managing allocation for port ${port}:`, error.message);
            console.error('[GameServerManager] 📊 Error stack:', error.stack);
            
            if (error.response) {
                console.error('[GameServerManager] 📋 Allocation API Error:', JSON.stringify(error.response.data, null, 2));
            }
            
            throw new Error(`Failed to ensure allocation exists for port ${port}: ${error.message}`);
        }
    }

    /**
     * Get server info from local servers map
     */
    getLocalServers() {
        return Array.from(this.servers.values());
    }
}

module.exports = GameServerManager;