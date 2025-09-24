/**
 * Configuration Manager
 * Handles dynamic configuration loading and reloading
 */

const fs = require('fs');
const path = require('path');

class ConfigManager {
    constructor() {
        this.configPath = path.join(__dirname, 'config.json');
        this.config = null;
        this.serverConfig = null;
        this.changeCallbacks = [];
        this.loadConfig();
        
        // Watch for config file changes
        this.setupFileWatcher();
    }

    /**
     * Laad configuratie uit bestand
     */
    loadConfig() {
        try {
            console.log('[CONFIG] Loading configuration...');
            
            // Controleer of config bestand bestaat
            if (!fs.existsSync(this.configPath)) {
                console.log('[CONFIG] ❌ Config file does not exist, creating default...');
                this.createDefaultConfig();
            }
            
            const rawData = fs.readFileSync(this.configPath, 'utf8');
            this.config = JSON.parse(rawData);
            
            // Valideer config structuur
            if (!this.config.server) {
                throw new Error('Missing server configuration section');
            }
            
            if (!this.config.ssl) {
                throw new Error('Missing SSL configuration section');
            }
            
            // Update server config met defaults voor ontbrekende velden
            this.serverConfig = {
                port: this.config.server.port || 8000,
                httpsPort: this.config.server.httpsPort || 8443,
                host: this.config.server.host || '0.0.0.0',
                apiPrefix: this.config.server.apiPrefix || '/api/v1',
                enableHTTPS: this.config.server.enableHTTPS || false,
                sslKeyPath: path.join(__dirname, this.config.ssl.keyPath || '../ssl/private-key.pem'),
                sslCertPath: path.join(__dirname, this.config.ssl.certPath || '../ssl/certificate.pem')
            };
            
            console.log('[CONFIG] ✅ Configuration loaded successfully');
            
            // Trigger change callbacks
            this.notifyChanges();
            
            return true;
        } catch (error) {
            console.error('[CONFIG] ❌ Failed to load configuration:', error.message);
            console.log('[CONFIG] 🔧 Attempting to create default configuration...');
            
            try {
                this.createDefaultConfig();
                return this.loadConfig(); // Probeer opnieuw na het maken van default config
            } catch (createError) {
                console.error('[CONFIG] ❌ Failed to create default config:', createError.message);
                return false;
            }
        }
    }

    /**
     * Maak default configuratie bestand
     */
    createDefaultConfig() {
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
                "autoScale": true,
                "serverTemplate": {
                    "name": "SkaffaCity-GameServer",
                    "egg": 5,
                    "docker_image": "ghcr.io/pterodactyl/yolks:nodejs_18",
                    "startup": "node gameserver.js"
                }
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
        
        fs.writeFileSync(this.configPath, JSON.stringify(defaultConfig, null, 2), 'utf8');
        console.log('[CONFIG] ✅ Default configuration file created');
    }

    /**
     * Herlaad configuratie
     */
    reloadConfig() {
        console.log('[CONFIG] 🔄 Reloading configuration...');
        const success = this.loadConfig();
        
        if (success) {
            console.log('[CONFIG] ✅ Configuration reloaded successfully');
            console.log('[CONFIG] Updated settings:', {
                port: this.serverConfig.port,
                httpsPort: this.serverConfig.httpsPort,
                host: this.serverConfig.host,
                enableHTTPS: this.serverConfig.enableHTTPS
            });
        } else {
            console.log('[CONFIG] ❌ Failed to reload configuration');
        }
        
        return success;
    }

    /**
     * Setup file watcher voor automatische reload
     */
    setupFileWatcher() {
        try {
            // Alleen file watcher opzetten als bestand bestaat
            if (fs.existsSync(this.configPath)) {
                fs.watchFile(this.configPath, { interval: 1000 }, (curr, prev) => {
                    if (curr.mtime > prev.mtime) {
                        console.log('\n🔄 [CONFIG] Configuration file changed, reloading...');
                        const success = this.reloadConfig();
                        if (success) {
                            console.log('✅ [CONFIG] Live configuration update applied!');
                            console.log('💡 [CONFIG] Some changes may require server restart\n');
                        } else {
                            console.log('❌ [CONFIG] Failed to reload configuration\n');
                        }
                    }
                });
                console.log('[CONFIG] 👀 File watcher active for automatic config reload');
            } else {
                console.log('[CONFIG] ⚠️ Config file not found, skipping file watcher setup');
            }
        } catch (error) {
            console.warn('[CONFIG] ⚠️ Could not setup file watcher:', error.message);
        }
    }

    /**
     * Get current configuration
     */
    getConfig() {
        if (!this.config) {
            console.warn('[CONFIG] ⚠️ Configuration not loaded, attempting to load...');
            this.loadConfig();
        }
        return this.config;
    }

    /**
     * Get server configuration
     */
    getServerConfig() {
        if (!this.serverConfig) {
            console.warn('[CONFIG] ⚠️ Server configuration not loaded, attempting to load...');
            this.loadConfig();
        }
        return this.serverConfig;
    }

    /**
     * Update configuration
     */
    updateConfig(newConfig) {
        try {
            fs.writeFileSync(this.configPath, JSON.stringify(newConfig, null, 2), 'utf8');
            console.log('[CONFIG] ✅ Configuration file updated');
            return this.reloadConfig();
        } catch (error) {
            console.error('[CONFIG] ❌ Failed to update configuration:', error.message);
            return false;
        }
    }

    /**
     * Get nested config value
     */
    get(path) {
        return path.split('.').reduce((current, key) => {
            return current && current[key] !== undefined ? current[key] : undefined;
        }, this.config);
    }

    /**
     * Set nested config value
     */
    set(path, value) {
        const keys = path.split('.');
        const lastKey = keys.pop();
        const target = keys.reduce((current, key) => {
            if (!current[key] || typeof current[key] !== 'object') {
                current[key] = {};
            }
            return current[key];
        }, this.config);
        
        if (target && lastKey) {
            target[lastKey] = value;
            return this.updateConfig(this.config);
        }
        return false;
    }

    /**
     * Validate configuration
     */
    validate() {
        const errors = [];
        
        // Validate required server settings
        if (!this.config.server) {
            errors.push('Missing server configuration');
        } else {
            if (!this.config.server.port || typeof this.config.server.port !== 'number') {
                errors.push('Invalid server port');
            }
            if (!this.config.server.host || typeof this.config.server.host !== 'string') {
                errors.push('Invalid server host');
            }
        }
        
        // Validate database settings
        if (!this.config.database) {
            errors.push('Missing database configuration');
        }
        
        return {
            valid: errors.length === 0,
            errors: errors
        };
    }

    /**
     * Register callback voor configuratie wijzigingen
     */
    onChange(callback) {
        this.changeCallbacks.push(callback);
    }

    /**
     * Notify all registered callbacks
     */
    notifyChanges() {
        for (const callback of this.changeCallbacks) {
            try {
                callback(this.config, this.serverConfig);
            } catch (error) {
                console.error('[CONFIG] ❌ Error in change callback:', error.message);
            }
        }
    }

    /**
     * Get live server configuration (always current)
     */
    getLiveServerConfig() {
        // Always return the most current server config
        return this.getServerConfig();
    }
}

// Export singleton instance
module.exports = new ConfigManager();