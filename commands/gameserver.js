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
            case 'scale':
                await this.scaleServers(args[1]);
                break;
            default:
                this.showHelp();
                break;
        }
    }

    async listServers() {
        console.log('[GAMESERVER] 🎮 Listing game server instances...');
        
        try {
            const config = this.loadConfig();
            
            if (config.gameServer.pterodactyl.enabled) {
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
            console.log('[GAMESERVER] ❌ Pterodactyl integration not available');
            console.log('[GAMESERVER] 💡 Install axios dependency: npm install axios');
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
            const config = this.loadConfig();
            
            if (config.gameServer.pterodactyl.enabled) {
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
            const config = this.loadConfig();
            
            if (config.gameServer.pterodactyl.enabled) {
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
        
        const config = global.configManager ? global.configManager.getConfig() : this.loadConfig();
        
        console.log('\n╔══════════════════════════════════════════════════════════╗');
        console.log('║                 Game Server Status                       ║');
        console.log('╠══════════════════════════════════════════════════════════╣');
        console.log(`║  Max Servers:     ${config.gameServer.maxServers.toString().padEnd(36)} ║`);
        console.log(`║  Auto Scale:      ${config.gameServer.autoScale.toString().padEnd(36)} ║`);
        console.log(`║  Pterodactyl:     ${config.gameServer.pterodactyl.enabled.toString().padEnd(36)} ║`);
        
        if (config.gameServer.pterodactyl.enabled) {
            const apiConfigured = config.gameServer.pterodactyl.apiUrl && config.gameServer.pterodactyl.apiKey;
            console.log(`║  API Configured:  ${apiConfigured.toString().padEnd(36)} ║`);
        }
        
        console.log('╚══════════════════════════════════════════════════════════╝\n');
        
        if (config.gameServer.pterodactyl.enabled) {
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
            
            if (status.success) {
                console.log('[GAMESERVER] ✅ Pterodactyl connection successful');
                console.log(`[GAMESERVER] 📊 Panel version: ${status.version || 'Unknown'}`);
            } else {
                console.log('[GAMESERVER] ❌ Pterodactyl connection failed');
                console.log(`[GAMESERVER] Error: ${status.error}`);
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
            const config = this.loadConfig();
            
            if (config.gameServer.pterodactyl.enabled) {
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

    showHelp() {
        console.log('\n╔══════════════════════════════════════════════════════════╗');
        console.log('║                Game Server Command Help                  ║');
        console.log('╠══════════════════════════════════════════════════════════╣');
        console.log('║  gameserver list          - List all game servers       ║');
        console.log('║  gameserver start [id]    - Start server (or create new)║');
        console.log('║  gameserver stop <id>     - Stop specific server        ║');
        console.log('║  gameserver status        - Show server status overview ║');
        console.log('║  gameserver config        - Show configuration          ║');
        console.log('║  gameserver pterodactyl   - Test Pterodactyl connection ║');
        console.log('║  gameserver scale <count> - Scale to specific count     ║');
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