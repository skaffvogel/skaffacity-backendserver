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
            const rawData = fs.readFileSync(this.configPath, 'utf8');
            this.config = JSON.parse(rawData);
            
            // Update server config
            this.serverConfig = {
                port: this.config.server.port,
                httpsPort: this.config.server.httpsPort,
                host: this.config.server.host,
                apiPrefix: this.config.server.apiPrefix,
                enableHTTPS: this.config.server.enableHTTPS,
                sslKeyPath: path.join(__dirname, this.config.ssl.keyPath),
                sslCertPath: path.join(__dirname, this.config.ssl.certPath)
            };
            
            console.log('[CONFIG] ✅ Configuration loaded successfully');
            return true;
        } catch (error) {
            console.error('[CONFIG] ❌ Failed to load configuration:', error.message);
            return false;
        }
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
            fs.watchFile(this.configPath, { interval: 1000 }, (curr, prev) => {
                if (curr.mtime > prev.mtime) {
                    console.log('\n🔄 [CONFIG] Configuration file changed, reloading...');
                    const success = this.reloadConfig();
                    if (success) {
                        console.log('✅ [CONFIG] Live configuration update applied!');
                        console.log('💡 [CONFIG] Some changes may require server restart\n');
                    }
                }
            });
            console.log('[CONFIG] 👀 File watcher active for automatic config reload');
        } catch (error) {
            console.warn('[CONFIG] ⚠️ Could not setup file watcher:', error.message);
        }
    }

    /**
     * Get current configuration
     */
    getConfig() {
        return this.config;
    }

    /**
     * Get server configuration
     */
    getServerConfig() {
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
}

// Export singleton instance
module.exports = new ConfigManager();