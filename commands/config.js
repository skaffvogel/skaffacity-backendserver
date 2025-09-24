/**
 * Server Configuration Management Command
 * Allows viewing and modifying server settings
 */

const fs = require('fs');
const path = require('path');

class ConfigCommand {
    constructor() {
        this.description = 'Manage server configuration settings';
        this.usage = 'config <get|set|show|reset> [key] [value]';
        this.configPath = path.join(__dirname, '../config.json');
    }

    async execute(args) {
        const action = args[0];

        switch (action) {
            case 'show':
            case 'list':
                await this.showConfig();
                break;
            case 'get':
                await this.getConfig(args[1]);
                break;
            case 'set':
                await this.setConfig(args[1], args.slice(2).join(' '));
                break;
            case 'reset':
                await this.resetConfig();
                break;
            case 'reload':
                await this.reloadConfig();
                break;
            case 'watch':
                await this.toggleWatch();
                break;
            default:
                this.showHelp();
                break;
        }
    }

    async showConfig() {
        const config = global.configManager ? global.configManager.getConfig() : this.loadConfig();
        
        console.log('\n╔══════════════════════════════════════════════════════════╗');
        console.log('║                  Server Configuration                    ║');
        console.log('╠══════════════════════════════════════════════════════════╣');
        
        // Server settings
        console.log('║  🌐 Server Settings:                                    ║');
        console.log(`║     port: ${config.server.port.toString().padEnd(44)} ║`);
        console.log(`║     httpsPort: ${config.server.httpsPort.toString().padEnd(39)} ║`);
        console.log(`║     host: ${config.server.host.padEnd(44)} ║`);
        console.log(`║     enableHTTPS: ${config.server.enableHTTPS.toString().padEnd(35)} ║`);
        
        console.log('║                                                          ║');
        
        // Database settings
        console.log('║  🗄️  Database Settings:                                 ║');
        console.log(`║     host: ${config.database.host.padEnd(44)} ║`);
        console.log(`║     port: ${config.database.port.toString().padEnd(44)} ║`);
        console.log(`║     database: ${config.database.database.padEnd(36)} ║`);
        
        console.log('║                                                          ║');
        
        // Game server settings
        console.log('║  🎮 Game Server Settings:                               ║');
        console.log(`║     maxServers: ${config.gameServer.maxServers.toString().padEnd(36)} ║`);
        console.log(`║     autoScale: ${config.gameServer.autoScale.toString().padEnd(37)} ║`);
        console.log(`║     pterodactyl enabled: ${config.gameServer.pterodactyl.enabled.toString().padEnd(25)} ║`);
        
        console.log('╚══════════════════════════════════════════════════════════╝\n');
    }

    async getConfig(key) {
        if (!key) {
            console.log('[CONFIG] ❌ Please specify a config key');
            console.log('[CONFIG] 💡 Example: config get server.port');
            return;
        }

        const value = global.configManager ? global.configManager.get(key) : this.getNestedValue(this.loadConfig(), key);
        
        if (value !== undefined) {
            console.log(`[CONFIG] ${key} = ${JSON.stringify(value)}`);
        } else {
            console.log(`[CONFIG] ❌ Config key not found: ${key}`);
        }
    }

    async setConfig(key, value) {
        if (!key || value === undefined || value === '') {
            console.log('[CONFIG] ❌ Please specify both key and value');
            console.log('[CONFIG] 💡 Example: config set server.port 8080');
            return;
        }
        
        // Try to parse value as JSON first, then as string
        let parsedValue = value;
        try {
            parsedValue = JSON.parse(value);
        } catch {
            // Keep as string if JSON parsing fails
        }
        
        if (global.configManager) {
            // Use config manager for live updates
            if (global.configManager.set(key, parsedValue)) {
                console.log(`[CONFIG] ✅ Updated ${key} = ${JSON.stringify(parsedValue)}`);
                console.log('[CONFIG] 🔄 Configuration reloaded automatically');
                console.log('[CONFIG] 💡 Server restart may be needed for some changes');
            } else {
                console.log(`[CONFIG] ❌ Failed to set ${key}`);
            }
        } else {
            // Fallback to manual method
            const config = this.loadConfig();
            if (this.setNestedValue(config, key, parsedValue)) {
                this.saveConfig(config);
                console.log(`[CONFIG] ✅ Updated ${key} = ${JSON.stringify(parsedValue)}`);
                console.log('[CONFIG] 🔄 Restart server to apply changes');
            } else {
                console.log(`[CONFIG] ❌ Failed to set ${key}`);
            }
        }
    }

    async resetConfig() {
        console.log('[CONFIG] 🔄 Resetting configuration to defaults...');
        
        const defaultConfig = {
            "server": {
                "port": 8000,
                "httpsPort": 8443,
                "host": "0.0.0.0",
                "apiPrefix": "/api/v1",
                "enableHTTPS": false
            },
            "ssl": {
                "keyPath": "../ssl/private-key.pem",
                "certPath": "../ssl/certificate.pem"
            },
            "database": {
                "host": "207.180.235.41",
                "port": 3306,
                "database": "s14_skaffacity",
                "username": "u14_Sz62GJBI8E"
            },
            "gameServer": {
                "pterodactyl": {
                    "enabled": false,
                    "apiUrl": "",
                    "apiKey": "",
                    "serverId": ""
                },
                "maxServers": 5,
                "autoScale": true
            },
            "security": {
                "jwtSecret": "your-jwt-secret-key",
                "bcryptRounds": 10,
                "rateLimitWindowMs": 900000,
                "rateLimitMax": 100
            },
            "logging": {
                "level": "info",
                "enableConsole": true,
                "enableFile": true,
                "logDirectory": "./logs"
            }
        };
        
        this.saveConfig(defaultConfig);
        console.log('[CONFIG] ✅ Configuration reset to defaults');
        console.log('[CONFIG] 🔄 Restart server to apply changes');
    }

    async reloadConfig() {
        if (global.configManager) {
            // Use config manager for live reload
            if (global.configManager.reloadConfig()) {
                console.log('[CONFIG] ✅ Configuration reloaded successfully');
                console.log('[CONFIG] 🔄 Some changes may require server restart');
            } else {
                console.log('[CONFIG] ❌ Failed to reload configuration');
            }
        } else {
            // Fallback to validation only
            try {
                this.loadConfig();
                console.log('[CONFIG] ✅ Configuration file is valid');
                console.log('[CONFIG] 🔄 Restart server to reload configuration');
            } catch (error) {
                console.error('[CONFIG] ❌ Configuration file is invalid:', error.message);
            }
        }
    }

    async toggleWatch() {
        console.log('[CONFIG] 👀 File watching is automatically enabled');
        console.log('[CONFIG] 💡 Configuration changes are detected automatically');
        console.log('[CONFIG] 📁 Edit config.json and changes will be applied instantly');
    }

    getNestedValue(obj, path) {
        return path.split('.').reduce((current, key) => {
            return current && current[key] !== undefined ? current[key] : undefined;
        }, obj);
    }

    setNestedValue(obj, path, value) {
        const keys = path.split('.');
        const lastKey = keys.pop();
        const target = keys.reduce((current, key) => {
            if (!current[key] || typeof current[key] !== 'object') {
                current[key] = {};
            }
            return current[key];
        }, obj);
        
        if (target && lastKey) {
            target[lastKey] = value;
            return true;
        }
        return false;
    }

    showHelp() {
        console.log('\n╔══════════════════════════════════════════════════════════╗');
        console.log('║                   Config Command Help                    ║');
        console.log('╠══════════════════════════════════════════════════════════╣');
        console.log('║  config show          - Display all configuration       ║');
        console.log('║  config get <key>     - Get specific config value       ║');
        console.log('║  config set <key> <v> - Set config value                ║');
        console.log('║  config reset         - Reset to default config         ║');
        console.log('║  config reload        - Reload configuration            ║');
        console.log('║  config watch         - Show file watching info         ║');
        console.log('║                                                          ║');
        console.log('║  Examples:                                               ║');
        console.log('║  config get server.port                                  ║');
        console.log('║  config set server.port 9000                            ║');
        console.log('║  config set server.enableHTTPS true                     ║');
        console.log('╚══════════════════════════════════════════════════════════╝\n');
    }

    loadConfig() {
        try {
            const configData = fs.readFileSync(this.configPath, 'utf8');
            return JSON.parse(configData);
        } catch (error) {
            console.error('[CONFIG] ❌ Failed to load config:', error.message);
            throw error;
        }
    }

    saveConfig(config) {
        try {
            fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2), 'utf8');
            console.log('[CONFIG] ✅ Configuration saved');
        } catch (error) {
            console.error('[CONFIG] ❌ Failed to save config:', error.message);
            throw error;
        }
    }
}

module.exports = ConfigCommand;