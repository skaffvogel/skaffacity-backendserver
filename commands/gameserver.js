/**
 * Game Server Management Command
 * Handles UDP game server instances and Pterodactyl integration
 */

const fs = require('fs');
const path = require('path');

class GameServerCommand {
    constructor() {
        this.description = 'Manage UDP game server instances';
        this.usage = 'gameserver <list|start|stop|status|config>';
    }

    async execute(args) {
        const action = args[0];

        switch (action) {
            case 'list':
                await this.listServers();
                break;
            case 'start':
                await this.startServer(args[1]);
                break;
            case 'stop':
                await this.stopServer(args[1]);
                break;
            case 'status':
                await this.showStatus();
                break;
            case 'config':
                await this.showConfig();
                break;
            case 'pterodactyl':
                await this.pterodactylStatus();
                break;
            case 'create':
                await this.createServer();
                break;
            case 'scale':
                await this.scaleServers(args[1]);
                break;
            case 'createwith':
            case 'createwithegg':
                await this.createServerWithEgg(args[1]);
                break;
            case 'allocations':
            case 'createallocations':
                await this.createPortAllocations(args[1], args[2]);
                break;
            default:
                this.showHelp();
                break;
        }
    }

    async listServers() {
        console.log('[GAMESERVER] 🎮 Listing game server instances...');
        
        try {
            const config = global.configManager ? global.configManager.getConfig('gameserver') : this.loadConfig();
            
            if ((config.gameServer?.pterodactyl?.enabled) || (config.pterodactyl?.enabled)) {
                console.log('[GAMESERVER] 🦕 Using Pterodactyl integration');
                await this.listPterodactylServers();
            } else {
                console.log('[GAMESERVER] 🖥️  Local server management mode');
                await this.listLocalServers();
            }
            
        } catch (error) {
            console.error('[GAMESERVER] ❌ Failed to list servers:', error.message);
        }
    }

    async listPterodactylServers() {
        try {
            // Try to load GameServerManager if axios is available
            const GameServerManager = require('../managers/GameServerManager');
            const manager = new GameServerManager();
            
            const servers = await manager.listServers();
            
            console.log('\n╔══════════════════════════════════════════════════════════╗');
            console.log('║                 Pterodactyl Game Servers                 ║');
            console.log('╠══════════════════════════════════════════════════════════╣');
            
            if (servers.length === 0) {
                console.log('║  No game servers found                                  ║');
            } else {
                for (const server of servers) {
                    const status = server.attributes.status || 'unknown';
                    const statusEmoji = this.getStatusEmoji(status);
                    const name = server.attributes.name.substring(0, 25);
                    console.log(`║  ${statusEmoji} ${name.padEnd(25)} ${status.padEnd(15)} ║`);
                }
            }
            
            console.log('╚══════════════════════════════════════════════════════════╝\n');
            
        } catch (error) {
            console.log('[GAMESERVER] ❌ Pterodactyl integration error:', error.message);
            console.log('[GAMESERVER] 💡 Check your Pterodactyl configuration');
        }
    }

    async listLocalServers() {
        console.log('\n╔══════════════════════════════════════════════════════════╗');
        console.log('║                   Local Game Servers                     ║');
        console.log('╠══════════════════════════════════════════════════════════╣');
        console.log('║  Local server management not implemented                 ║');
        console.log('║  💡 Enable Pterodactyl integration for full features    ║');
        console.log('╚══════════════════════════════════════════════════════════╝\n');
    }

    async startServer(serverId) {
        console.log(`[GAMESERVER] 🚀 Starting game server ${serverId || 'new'}...`);
        
        try {
            const config = global.configManager ? global.configManager.getConfig('gameserver') : this.loadConfig();
            
            if ((config.gameServer?.pterodactyl?.enabled) || (config.pterodactyl?.enabled)) {
                const GameServerManager = require('../managers/GameServerManager');
                const manager = new GameServerManager();
                
                if (serverId) {
                    await manager.startServer(serverId);
                    console.log(`[GAMESERVER] ✅ Server ${serverId} started`);
                } else {
                    const newServer = await manager.createServer();
                    console.log(`[GAMESERVER] ✅ New server created: ${newServer.id}`);
                }
            } else {
                console.log('[GAMESERVER] ❌ Pterodactyl integration disabled');
                console.log('[GAMESERVER] 💡 Enable in config: config set gameServer.pterodactyl.enabled true');
            }
            
        } catch (error) {
            console.error('[GAMESERVER] ❌ Failed to start server:', error.message);
        }
    }

    async stopServer(serverId) {
        if (!serverId) {
            console.log('[GAMESERVER] ❌ Please specify a server ID');
            return;
        }
        
        console.log(`[GAMESERVER] 🛑 Stopping game server ${serverId}...`);
        
        try {
            const config = global.configManager ? global.configManager.getConfig('gameserver') : this.loadConfig();
            
            if ((config.gameServer?.pterodactyl?.enabled) || (config.pterodactyl?.enabled)) {
                const GameServerManager = require('../managers/GameServerManager');
                const manager = new GameServerManager();
                
                await manager.stopServer(serverId);
                console.log(`[GAMESERVER] ✅ Server ${serverId} stopped`);
            } else {
                console.log('[GAMESERVER] ❌ Pterodactyl integration disabled');
            }
            
        } catch (error) {
            console.error('[GAMESERVER] ❌ Failed to stop server:', error.message);
        }
    }

    async showStatus() {
        console.log('[GAMESERVER] 📊 Game server status overview...');
        
        const config = global.configManager ? global.configManager.getConfig('gameserver') : this.loadConfig();
        
        console.log('\n╔══════════════════════════════════════════════════════════╗');
        console.log('║                 Game Server Status                       ║');
        console.log('╠══════════════════════════════════════════════════════════╣');
        console.log(`║  Max Servers:     ${((config.gameServer?.maxServers) || (config.maxServers) || 'N/A').toString().padEnd(36)} ║`);
        console.log(`║  Auto Scale:      ${((config.gameServer?.autoScale) || (config.autoScale) || 'N/A').toString().padEnd(36)} ║`);
        console.log(`║  Pterodactyl:     ${((config.gameServer?.pterodactyl?.enabled) || (config.pterodactyl?.enabled) || false).toString().padEnd(36)} ║`);
        
        const pterodactylEnabled = (config.gameServer?.pterodactyl?.enabled) || (config.pterodactyl?.enabled);
        if (pterodactylEnabled) {
            const apiUrl = (config.gameServer?.pterodactyl?.apiUrl) || (config.pterodactyl?.apiUrl);
            const apiKey = (config.gameServer?.pterodactyl?.apiKey) || (config.pterodactyl?.apiKey);
            const apiConfigured = apiUrl && apiKey;
            console.log(`║  API Configured:  ${apiConfigured.toString().padEnd(36)} ║`);
        }
        
        console.log('╚══════════════════════════════════════════════════════════╝\n');
        
        if (pterodactylEnabled) {
            await this.listServers();
        }
    }

    async showConfig() {
        if (!global.configManager) {
            console.log('[GAMESERVER] ❌ ConfigManager not available');
            return;
        }
        
        const gameserverConfig = global.configManager.getConfig('gameserver');
        if (!gameserverConfig) {
            console.log('[GAMESERVER] ❌ GameServer configuration not found');
            return;
        }
        
        console.log('\n╔══════════════════════════════════════════════════════════╗');
        console.log('║               Game Server Configuration                  ║');
        console.log('╠══════════════════════════════════════════════════════════╣');
        console.log(`║  Max Servers:     ${gameserverConfig.maxServers.toString().padEnd(36)} ║`);
        console.log(`║  Auto Scale:      ${gameserverConfig.autoScale.toString().padEnd(36)} ║`);
        console.log('║                                                          ║');
        console.log('║  Pterodactyl Integration:                                ║');
        console.log(`║    Enabled:       ${gameserverConfig.pterodactyl.enabled.toString().padEnd(36)} ║`);
        
        const apiUrl = gameserverConfig.pterodactyl.apiUrl || 'Not configured';
        const apiKey = gameserverConfig.pterodactyl.apiKey ? 'Configured' : 'Not configured';
        const adminKey = gameserverConfig.pterodactyl.adminApiKey ? 'Configured' : 'Not configured';
        
        console.log(`║    API URL:       ${apiUrl.substring(0, 36).padEnd(36)} ║`);
        console.log(`║    API Key:       ${apiKey.padEnd(36)} ║`);
        console.log(`║    Admin Key:     ${adminKey.padEnd(36)} ║`);
        
        console.log('╚══════════════════════════════════════════════════════════╝\n');
    }

    async pterodactylStatus() {
        console.log('[GAMESERVER] 🦕 Checking Pterodactyl connection...');
        
        try {
            if (!global.configManager) {
                console.log('[GAMESERVER] ❌ ConfigManager not available');
                return;
            }
            
            const gameserverConfig = global.configManager.getConfig('gameserver');
            if (!gameserverConfig) {
                console.log('[GAMESERVER] ❌ GameServer configuration not found');
                return;
            }
            
            if (!gameserverConfig.pterodactyl.enabled) {
                console.log('[GAMESERVER] ❌ Pterodactyl integration is disabled');
                return;
            }
            
            const GameServerManager = require('../managers/GameServerManager');
            const manager = new GameServerManager();
            
            const status = await manager.checkPterodactylConnection();
            
            if (status.status === 'connected') {
                console.log('[GAMESERVER] ✅ Pterodactyl connection successful');
                console.log(`[GAMESERVER] 📊 Status: ${status.message}`);
            } else {
                console.log('[GAMESERVER] ❌ Pterodactyl connection failed');
                console.log(`[GAMESERVER] Error: ${status.message}`);
            }
            
        } catch (error) {
            console.error('[GAMESERVER] ❌ Pterodactyl check failed:', error.message);
        }
    }

    async scaleServers(count) {
        const targetCount = parseInt(count);
        
        if (isNaN(targetCount) || targetCount < 0 || targetCount > 10) {
            console.log('[GAMESERVER] ❌ Please specify a valid server count (0-10)');
            return;
        }
        
        console.log(`[GAMESERVER] ⚖️  Scaling to ${targetCount} servers...`);
        
        try {
            const config = global.configManager ? global.configManager.getConfig('gameserver') : this.loadConfig();
            
            if ((config.gameServer?.pterodactyl?.enabled) || (config.pterodactyl?.enabled)) {
                const GameServerManager = require('../managers/GameServerManager');
                const manager = new GameServerManager();
                
                await manager.scaleServers(targetCount);
                console.log(`[GAMESERVER] ✅ Scaled to ${targetCount} servers`);
            } else {
                console.log('[GAMESERVER] ❌ Pterodactyl integration required for scaling');
            }
            
        } catch (error) {
            console.error('[GAMESERVER] ❌ Failed to scale servers:', error.message);
        }
    }

    async createServer() {
        console.log('[GAMESERVER] 🏗️ Creating new game server...');
        
        try {
            const config = global.configManager ? global.configManager.getConfig('gameserver') : this.loadConfig();
            
            if ((config.gameServer?.pterodactyl?.enabled) || (config.pterodactyl?.enabled)) {
                const GameServerManager = require('../managers/GameServerManager');
                const manager = new GameServerManager();
                
                const newServer = await manager.createServer();
                console.log(`[GAMESERVER] ✅ New server created successfully`);
                console.log(`[GAMESERVER] 🆔 Server ID: ${newServer.id || newServer.uuid || 'Unknown'}`);
                
                if (newServer.name) {
                    console.log(`[GAMESERVER] 📛 Server Name: ${newServer.name}`);
                }
            } else {
                console.log('[GAMESERVER] ❌ Pterodactyl integration disabled');
                console.log('[GAMESERVER] 💡 Enable in config: config updateConfig gameserver pterodactyl.enabled true');
            }
            
        } catch (error) {
            console.error('[GAMESERVER] ❌ Failed to create server:', error.message);
        }
    }

    getStatusEmoji(status) {
        switch (status.toLowerCase()) {
            case 'running': return '🟢';
            case 'starting': return '🟡';
            case 'stopping': return '🟠';
            case 'stopped': return '🔴';
            case 'offline': return '⚫';
            default: return '⚪';
        }
    }

    async createServer() {
        console.log('[GAMESERVER] 🏗️ Creating new game server...');
        
        try {
            const config = global.configManager ? global.configManager.getConfig('gameserver') : this.loadConfig();
            
            if ((config.gameServer?.pterodactyl?.enabled) || (config.pterodactyl?.enabled)) {
                const GameServerManager = require('../managers/GameServerManager');
                const manager = new GameServerManager();
                
                const newServer = await manager.createServer();
                console.log(`[GAMESERVER] ✅ New server created successfully`);
                console.log(`[GAMESERVER] 🆔 Server ID: ${newServer.id || newServer.uuid || 'Unknown'}`);
                
                if (newServer.name) {
                    console.log(`[GAMESERVER] 📛 Server Name: ${newServer.name}`);
                }
                
                // Show server details
                await this.showServerDetails(newServer);
                
            } else {
                console.log('[GAMESERVER] ❌ Pterodactyl integration disabled');
                console.log('[GAMESERVER] 💡 Enable in config: config updateConfig gameserver pterodactyl.enabled true');
            }
            
        } catch (error) {
            console.error('[GAMESERVER] ❌ Failed to create server:', error.message);
        }
    }

    async createServerWithEgg(eggId) {
        const targetEggId = eggId || '20'; // Default to SkaffaCity Unity Server egg
        console.log(`[GAMESERVER] 🏗️ Creating new game server with egg ID ${targetEggId}...`);
        
        try {
            const config = global.configManager ? global.configManager.getConfig('gameserver') : this.loadConfig();
            
            if ((config.gameServer?.pterodactyl?.enabled) || (config.pterodactyl?.enabled)) {
                const GameServerManager = require('../managers/GameServerManager');
                const manager = new GameServerManager();
                
                // Override configuration for SkaffaCity Unity Server
                manager.pterodactylConfig.gameServerEggId = targetEggId;
                
                // Force Unity server template configuration
                manager.unityServerTemplate = {
                    egg: parseInt(targetEggId),
                    docker_image: 'ghcr.io/pterodactyl/yolks:ubuntu',
                    startup: './{{SERVER_JARFILE}} -batchmode -nographics -port {{SERVER_PORT}} -masterServer {{MASTER_SERVER_URL}} -serverName "{{SERVER_NAME}}" -maxPlayers {{MAX_PLAYERS}} -tickRate {{TICK_RATE}} -logFile logs/server.log -region {{REGION}} -gameMode {{GAME_MODE}} -autoUpdate {{AUTO_UPDATE}}',
                    description: 'SkaffaCity Unity Dedicated Server - Auto-updating from GitHub',
                    limits: {
                        memory: 2048, // 2GB for Unity server
                        swap: 0,
                        disk: 5120, // 5GB for Unity build
                        io: 500,
                        cpu: 200, // 200% CPU for Unity performance
                        threads: null
                    },
                    feature_limits: {
                        databases: 0,
                        allocations: 1,
                        backups: 1
                    }
                };
                
                console.log(`[GAMESERVER] 🥚 Using egg ID: ${targetEggId} (SkaffaCity Unity Server)`);
                console.log(`[GAMESERVER] 🐙 Creating with GitHub auto-update enabled`);
                console.log(`[GAMESERVER] 📦 Repository: skaffvogel/skaffacity-serverbuild`);
                console.log(`[GAMESERVER] 🔧 Unity optimized: 2GB RAM, 5GB Disk, 200% CPU`);
                
                const newServer = await manager.createServerWithTemplate(manager.unityServerTemplate);
                
                console.log(`[GAMESERVER] ✅ SkaffaCity Unity Server created successfully!`);
                console.log(`[GAMESERVER] 🆔 Server ID: ${newServer.id || newServer.uuid || 'Unknown'}`);
                
                if (newServer.name) {
                    console.log(`[GAMESERVER] 📛 Server Name: ${newServer.name}`);
                }
                
                // Show server connection info
                console.log(`[GAMESERVER] 🌐 Server IP: 207.180.235.41:${newServer.port || '7001'}`);
                console.log(`[GAMESERVER] 📊 Master Server: http://207.180.235.41:3000`);
                console.log(`[GAMESERVER] 🎮 Max Players: 50`);
                console.log(`[GAMESERVER] ⚡ Tick Rate: 30 Hz`);
                
            } else {
                console.log('[GAMESERVER] ❌ Pterodactyl integration disabled');
                console.log('[GAMESERVER] 💡 Enable in config: config updateConfig gameserver pterodactyl.enabled true');
            }
            
        } catch (error) {
            console.error('[GAMESERVER] ❌ Failed to create server:', error.message);
            console.log(`[GAMESERVER] 💡 Make sure egg ID ${targetEggId} exists in Pterodactyl Panel`);
            
            if (error.message.includes('allocation')) {
                console.log(`[GAMESERVER] 🔧 Allocation issue - check Pterodactyl node allocations`);
                console.log(`[GAMESERVER] 💡 Try: gameserver createallocations 7001 7020`);
            }
        }
    }

    async createPortAllocations(startPort, endPort) {
        const start = parseInt(startPort) || 7001;
        const end = parseInt(endPort) || start + 19; // Default range of 20 ports
        
        console.log(`[GAMESERVER] 🔧 Creating port allocations from ${start} to ${end}...`);
        
        try {
            const config = global.configManager ? global.configManager.getConfig('gameserver') : this.loadConfig();
            
            if ((config.gameServer?.pterodactyl?.enabled) || (config.pterodactyl?.enabled)) {
                const GameServerManager = require('../managers/GameServerManager');
                const manager = new GameServerManager();
                
                let created = 0;
                let skipped = 0;
                let failed = 0;
                
                for (let port = start; port <= end; port++) {
                    try {
                        console.log(`[GAMESERVER] 🔨 Creating allocation for port ${port}...`);
                        
                        // Check if allocation already exists
                        const existingAllocation = await manager.ensureAllocationExists(port);
                        
                        if (existingAllocation) {
                            if (existingAllocation.assigned) {
                                console.log(`[GAMESERVER] ⚠️ Port ${port} allocation already assigned`);
                                skipped++;
                            } else {
                                console.log(`[GAMESERVER] ✅ Port ${port} allocation already exists and available`);
                                skipped++;
                            }
                        } else {
                            created++;
                        }
                        
                    } catch (error) {
                        console.error(`[GAMESERVER] ❌ Failed to create allocation for port ${port}: ${error.message}`);
                        failed++;
                    }
                }
                
                console.log(`\n[GAMESERVER] 📊 Allocation Summary:`);
                console.log(`[GAMESERVER] ✅ Created: ${created}`);
                console.log(`[GAMESERVER] ⚠️ Skipped: ${skipped}`);
                console.log(`[GAMESERVER] ❌ Failed: ${failed}`);
                console.log(`[GAMESERVER] 📋 Total processed: ${end - start + 1}`);
                
            } else {
                console.log('[GAMESERVER] ❌ Pterodactyl integration disabled');
                console.log('[GAMESERVER] 💡 Enable in config: config updateConfig gameserver pterodactyl.enabled true');
            }
            
        } catch (error) {
            console.error('[GAMESERVER] ❌ Failed to create allocations:', error.message);
        }
    }

    async showServerDetails(server) {
        if (!server) return;
        
        try {
            console.log('\n╔══════════════════════════════════════════════════════════╗');
            console.log('║                   Server Details                         ║');
            console.log('╠══════════════════════════════════════════════════════════╣');
            
            if (server.attributes) {
                const attrs = server.attributes;
                console.log(`║  ID: ${(attrs.id || 'Unknown').toString().padEnd(50)} ║`);
                console.log(`║  UUID: ${(attrs.uuid || 'Unknown').substring(0, 50).padEnd(50)} ║`);
                console.log(`║  Name: ${(attrs.name || 'Unknown').substring(0, 48).padEnd(50)} ║`);
                console.log(`║  Status: ${this.getStatusEmoji(attrs.status)} ${(attrs.status || 'Unknown').padEnd(45)} ║`);
                
                if (attrs.relationships?.allocations?.data?.[0]?.attributes) {
                    const alloc = attrs.relationships.allocations.data[0].attributes;
                    console.log(`║  IP:Port: ${alloc.ip}:${alloc.port}${''.padEnd(50 - `${alloc.ip}:${alloc.port}`.length)} ║`);
                }
                
                console.log('║                                                          ║');
                console.log('║  🎮 SkaffaCity Unity Server Features:                   ║');
                console.log('║    • Auto-update from GitHub repository                 ║');
                console.log('║    • UDP networking with master server integration      ║');
                console.log('║    • Real-time multiplayer support                      ║');
                console.log('║    • Pterodactyl panel management                       ║');
            }
            
            console.log('╚══════════════════════════════════════════════════════════╝\n');
            
            if (server.attributes?.status === 'installing') {
                console.log('[GAMESERVER] ⏳ Server is installing, this may take a few minutes...');
                console.log('[GAMESERVER] 📋 The server will automatically download from GitHub');
                console.log('[GAMESERVER] 🔗 Repository: https://github.com/skaffvogel/skaffacity-serverbuild');
            }
            
        } catch (error) {
            console.error('[GAMESERVER] ❌ Failed to show server details:', error.message);
        }
    }

    showHelp() {
        console.log('\n╔══════════════════════════════════════════════════════════╗');
        console.log('║                Game Server Command Help                  ║');
        console.log('╠══════════════════════════════════════════════════════════╣');
        console.log('║  gameserver list            - List all game servers     ║');
        console.log('║  gameserver create          - Create new game server    ║');
        console.log('║  gameserver createwithegg   - Create SkaffaCity Unity   ║');
        console.log('║                               Server (Egg ID 20)        ║');
        console.log('║  gameserver start [id]      - Start server (or create)  ║');
        console.log('║  gameserver stop <id>       - Stop specific server      ║');
        console.log('║  gameserver status          - Show server status        ║');
        console.log('║  gameserver config          - Show configuration        ║');
        console.log('║  gameserver pterodactyl     - Test Pterodactyl API      ║');
        console.log('║  gameserver scale <count>   - Scale to specific count   ║');
        console.log('║  gameserver createallocations <start> <end>             ║');
        console.log('║                               - Create port allocations ║');
        console.log('║                                                          ║');
        console.log('║  🎮 SkaffaCity Unity Servers include:                   ║');
        console.log('║    • Auto-update from GitHub (skaffacity-serverbuild)   ║');
        console.log('║    • UDP networking with master server integration      ║');
        console.log('║    • Real-time multiplayer support (up to 50 players)   ║');
        console.log('║    • Pterodactyl panel management and monitoring        ║');
        console.log('╚══════════════════════════════════════════════════════════╝\n');
    }

    loadConfig() {
        const configPath = path.join(__dirname, '../config.json');
        try {
            const configData = fs.readFileSync(configPath, 'utf8');
            return JSON.parse(configData);
        } catch (error) {
            throw new Error(`Failed to load config: ${error.message}`);
        }
    }
}

module.exports = GameServerCommand;