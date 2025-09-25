/**
 * Game Server Management Command
 * Beheert Pterodactyl game servers via hoofdserver command interface
 */

const GameServerManager = require('../managers/GameServerManager');

class GameServerCommand {
    constructor() {
        this.description = 'Manage Pterodactyl game servers for SkaffaCity';
        this.usage = 'gameserver <create|start|stop|restart|delete|list|status|info>';
        this.gameServerManager = new GameServerManager();
    }

    async execute(args) {
        const action = args[0];

        switch (action) {
            case 'create':
                await this.createServer();
                break;
            case 'start':
                await this.startServer(args[1]);
                break;
            case 'stop':
                await this.stopServer(args[1]);
                break;
            case 'restart':
                await this.restartServer(args[1]);
                break;
            case 'delete':
                await this.deleteServer(args[1]);
                break;
            case 'list':
                await this.listServers();
                break;
            case 'status':
                await this.showStatus(args[1]);
                break;
            case 'info':
                await this.showServerInfo(args[1]);
                break;
            case 'init':
                await this.initialize();
                break;
            default:
                this.showHelp();
                break;
        }
    }

    async createServer() {
        try {
            console.log('[GAMESERVER] � Creating new SkaffaCity game server via Pterodactyl...');
            
            const newServer = await this.gameServerManager.createGameServer();
            
            console.log('[GAMESERVER] ✅ Game server created successfully!');
            console.log('[GAMESERVER] 📋 Server Details:');
            console.log(`  - Server ID: ${newServer.id}`);
            console.log(`  - Name: ${newServer.name}`);
            console.log(`  - Status: ${newServer.status}`);
            
        } catch (error) {
            console.error('[GAMESERVER] ❌ Failed to create game server:', error.message);
        }
    }

    async startServer(serverId) {
        try {
            if (!serverId) {
                console.error('[GAMESERVER] ❌ Server ID is required');
                console.log('Usage: gameserver start <server-id>');
                return;
            }

            console.log(`[GAMESERVER] � Starting game server ${serverId}...`);
            
            await this.gameServerManager.startServer(serverId);
            
            console.log('[GAMESERVER] ✅ Server start command sent successfully!');
            console.log('[GAMESERVER] ⏳ Server is starting up, use "gameserver status" to check progress');
            
        } catch (error) {
            console.error('[GAMESERVER] ❌ Failed to start server:', error.message);
        }
    }

    async stopServer(serverId) {
        try {
            if (!serverId) {
                console.error('[GAMESERVER] ❌ Server ID is required');
                console.log('Usage: gameserver stop <server-id>');
                return;
            }

            console.log(`[GAMESERVER] 🛑 Stopping game server ${serverId}...`);
            
            await this.gameServerManager.stopServer(serverId);
            
            console.log('[GAMESERVER] ✅ Server stop command sent successfully!');
            
        } catch (error) {
            console.error('[GAMESERVER] ❌ Failed to stop server:', error.message);
        }
    }

    async restartServer(serverId) {
        try {
            if (!serverId) {
                console.error('[GAMESERVER] ❌ Server ID is required');
                console.log('Usage: gameserver restart <server-id>');
                return;
            }

            console.log(`[GAMESERVER] 🔄 Restarting game server ${serverId}...`);
            
            await this.gameServerManager.restartServer(serverId);
            
            console.log('[GAMESERVER] ✅ Server restart command sent successfully!');
            
        } catch (error) {
            console.error('[GAMESERVER] ❌ Failed to restart server:', error.message);
        }
    }

    async deleteServer(serverId) {
        try {
            if (!serverId) {
                console.error('[GAMESERVER] ❌ Server ID is required');
                console.log('Usage: gameserver delete <server-id>');
                return;
            }

            console.log(`[GAMESERVER] 🗑️ Deleting game server ${serverId}...`);
            console.log('[GAMESERVER] ⚠️ This action cannot be undone!');
            
            await this.gameServerManager.deleteServer(serverId);
            
            console.log('[GAMESERVER] ✅ Server deleted successfully!');
            
        } catch (error) {
            console.error('[GAMESERVER] ❌ Failed to delete server:', error.message);
        }
    }

    async showStatus(serverId) {
        try {
            if (serverId) {
                // Show specific server status
                console.log(`[GAMESERVER] 📊 Checking status for server ${serverId}...`);
                const servers = this.gameServerManager.getAllServers();
                const server = servers.find(s => s.id === serverId || s.name.includes(serverId));
                
                if (server) {
                    console.log('╔══════════════════════════════════════════════════════════╗');
                    console.log('║                  🎮 SERVER STATUS                       ║');
                    console.log('╠══════════════════════════════════════════════════════════╣');
                    console.log(`║ Server ID      : ${server.id.padEnd(35)} ║`);
                    console.log(`║ Name           : ${server.name.padEnd(35)} ║`);
                    console.log(`║ Status         : ${server.status.padEnd(35)} ║`);
                    console.log(`║ Players        : ${server.playerCount.toString().padEnd(35)} ║`);
                    console.log(`║ Max Players    : ${server.maxPlayers.toString().padEnd(35)} ║`);
                    console.log('╚══════════════════════════════════════════════════════════╝');
                } else {
                    console.log(`[GAMESERVER] ❌ Server ${serverId} not found`);
                }
            } else {
                // Show all servers status
                await this.listServers();
            }
        } catch (error) {
            console.error('[GAMESERVER] ❌ Failed to get server status:', error.message);
        }
    }



    async listServers() {
        try {
            console.log('[GAMESERVER] 📋 Fetching servers from Pterodactyl...');
            
            const servers = this.gameServerManager.getAllServers();
            
            console.log('╔══════════════════════════════════════════════════════════╗');
            console.log('║                � PTERODACTYL GAME SERVERS               ║');
            console.log('╠══════════════════════════════════════════════════════════╣');
            
            if (servers.length === 0) {
                console.log('║ No servers found                                         ║');
            } else {
                console.log('║ ID                   Name                      Status    ║');
                console.log('╠══════════════════════════════════════════════════════════╣');
                servers.forEach((server) => {
                    const id = server.id.toString().padEnd(18);
                    const name = (server.name || 'Unknown').padEnd(25);
                    const status = (server.status || 'unknown').padEnd(8);
                    console.log(`║ ${id} ${name} ${status} ║`);
                });
            }
            
            console.log(`║ Total Servers  : ${servers.length.toString().padEnd(35)} ║`);
            console.log(`║ Timestamp      : ${new Date().toISOString().padEnd(35)} ║`);
            console.log('╚══════════════════════════════════════════════════════════╝');
            
        } catch (error) {
            console.error('[GAMESERVER] ❌ Failed to fetch server list:', error.message);
        }
    }

    async showServerInfo(serverId) {
        try {
            if (!serverId) {
                console.error('[GAMESERVER] ❌ Server ID is required');
                console.log('Usage: gameserver info <server-id>');
                return;
            }

            console.log(`[GAMESERVER] 📋 Fetching detailed info for server ${serverId}...`);
            
            const servers = this.gameServerManager.getAllServers();
            const server = servers.find(s => s.id === serverId || s.name.includes(serverId));
            
            if (server) {
                console.log('╔══════════════════════════════════════════════════════════╗');
                console.log('║               🔍 DETAILED SERVER INFO                   ║');
                console.log('╠══════════════════════════════════════════════════════════╣');
                console.log(`║ ID             : ${server.id.padEnd(35)} ║`);
                console.log(`║ Name           : ${server.name.padEnd(35)} ║`);
                console.log(`║ Status         : ${server.status.padEnd(35)} ║`);
                console.log(`║ Players        : ${server.playerCount}/${server.maxPlayers}`.padEnd(49) + ' ║');
                console.log(`║ Map Name       : ${(server.mapName || 'N/A').padEnd(35)} ║`);
                console.log(`║ Game Mode      : ${(server.gameMode || 'N/A').padEnd(35)} ║`);
                console.log('╚══════════════════════════════════════════════════════════╝');
            } else {
                console.log(`[GAMESERVER] ❌ Server ${serverId} not found`);
            }
            
        } catch (error) {
            console.error('[GAMESERVER] ❌ Failed to get server info:', error.message);
        }
    }

    async initialize() {
        try {
            console.log('[GAMESERVER] � Initializing GameServerManager...');
            
            const success = await this.gameServerManager.initialize();
            
            if (success) {
                console.log('[GAMESERVER] ✅ GameServerManager initialized successfully!');
                console.log('[GAMESERVER] 🎮 Ready to manage Pterodactyl game servers');
            } else {
                console.log('[GAMESERVER] ⚠️ GameServerManager initialization completed with warnings');
            }
            
        } catch (error) {
            console.error('[GAMESERVER] ❌ Failed to initialize GameServerManager:', error.message);
        }
    }

    showHelp() {
        console.log('╔══════════════════════════════════════════════════════════╗');
        console.log('║            🎮 PTERODACTYL GAMESERVER COMMANDS            ║');
        console.log('╠══════════════════════════════════════════════════════════╣');
        console.log('║ create <name> <type>  - Create new Pterodactyl server   ║');
        console.log('║ start <id/name>       - Start a Pterodactyl server      ║');
        console.log('║ stop <id/name>        - Stop a Pterodactyl server       ║');
        console.log('║ restart <id/name>     - Restart a Pterodactyl server    ║');
        console.log('║ delete <id/name>      - Delete a Pterodactyl server     ║');
        console.log('║ list                  - List all Pterodactyl servers    ║');
        console.log('║ status [id/name]      - Show server(s) status           ║');
        console.log('║ info <id/name>        - Show detailed server info       ║');
        console.log('║ init                  - Initialize Pterodactyl manager  ║');
        console.log('║ help                  - Show this help menu             ║');
        console.log('╠══════════════════════════════════════════════════════════╣');
        console.log('║ 🔧 Server Types: skaffa-city, survival, creative, arena ║');
        console.log('║ 📡 Managed via Pterodactyl Panel API                    ║');
        console.log('╚══════════════════════════════════════════════════════════╝');
    }
}

module.exports = GameServerCommand;