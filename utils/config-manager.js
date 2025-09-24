/**
 * Configuration Manager - New Modular System
 * Handles separate config files in ./config directory with live reloading
 */

const fs = require('fs');
const path = require('path');
const EventEmitter = require('events');

class ConfigManager extends EventEmitter {
    constructor() {
        super();
        this.configDir = path.join(__dirname, '../config');
        this.configs = new Map();
        this.watchers = new Map();
        this.configFiles = {
            server: 'server.json',
            database: 'database.json',
            ssl: 'ssl.json',
            gameserver: 'gameserver.json'
        };
        
        this.ensureConfigDirectory();
        this.loadAllConfigs();
        this.watchAllConfigs();
    }

    ensureConfigDirectory() {
        if (!fs.existsSync(this.configDir)) {
            console.log('[ConfigManager] Creating config directory...');
            fs.mkdirSync(this.configDir, { recursive: true });
        }
    }

    loadAllConfigs() {
        console.log(`[ConfigManager] Loading configs from: ${this.configDir}`);
        
        for (const [configType, fileName] of Object.entries(this.configFiles)) {
            this.loadConfig(configType, fileName);
        }
        
        // Host validation after all configs are loaded
        this.validateServerHost();
        
        console.log(`[ConfigManager] ✅ All configs loaded successfully`);
        this.emit('configLoaded', this.getAllConfigs());
    }

    loadConfig(configType, fileName) {
        const configPath = path.join(this.configDir, fileName);
        
        try {
            if (!fs.existsSync(configPath)) {
                console.log(`[ConfigManager] ${configType}.json not found, creating default...`);
                this.createDefaultConfig(configType, configPath);
            }
            
            const configData = fs.readFileSync(configPath, 'utf8');
            const config = JSON.parse(configData);
            
            this.configs.set(configType, config);
            console.log(`[ConfigManager] ✅ Loaded ${configType} config`);
            
            this.emit('configChanged', { type: configType, config });
        } catch (error) {
            console.error(`[ConfigManager] ❌ Error loading ${configType} config: ${error.message}`);
            this.createDefaultConfig(configType, configPath);
        }
    }

    validateServerHost() {
        const serverConfig = this.configs.get('server');
        const databaseConfig = this.configs.get('database');
        
        if (serverConfig && databaseConfig && serverConfig.host === databaseConfig.host) {
            console.log('[ConfigManager] ⚠️  WARNING: Server host matches database host, correcting to 0.0.0.0');
            serverConfig.host = '0.0.0.0';
            this.saveConfig('server', serverConfig);
        }
        
        if (serverConfig) {
            console.log(`[ConfigManager] Server will bind to: ${serverConfig.host}:${serverConfig.port}`);
        }
        
        // Validate password fields
        this.validatePasswordFields();
    }

    validatePasswordFields() {
        const warnings = [];
        
        // Check database password
        const dbConfig = this.configs.get('database');
        if (dbConfig && (!dbConfig.password || dbConfig.password === '')) {
            warnings.push('Database password is empty');
        }
        
        // Check JWT secret
        const serverConfig = this.configs.get('server');
        if (serverConfig && (!serverConfig.jwtSecret || serverConfig.jwtSecret === '')) {
            warnings.push('JWT secret is empty');
        }
        
        // Check Pterodactyl API keys
        const gameserverConfig = this.configs.get('gameserver');
        if (gameserverConfig?.pterodactyl?.enabled) {
            if (!gameserverConfig.pterodactyl.apiKey || gameserverConfig.pterodactyl.apiKey === '') {
                warnings.push('Pterodactyl API key is empty');
            }
        }
        
        if (warnings.length > 0) {
            console.log('[ConfigManager] 🔐 Security warnings:');
            warnings.forEach(warning => {
                console.log(`[ConfigManager] ⚠️  ${warning}`);
            });
            console.log('[ConfigManager] 💡 Use commands to set passwords: config set database.password <password>');
        }
    }

    createDefaultConfig(configType, configPath) {
        let defaultConfig = {};
        
        switch (configType) {
            case 'server':
                defaultConfig = {
                    port: 8000,
                    httpsPort: 8443,
                    host: '0.0.0.0',
                    apiPrefix: '/api/v1',
                    enableHTTPS: false,
                    jwtSecret: '',  // Leeg JWT secret - moet handmatig ingevuld worden
                    adminPassword: ''  // Leeg admin password voor server management
                };
                break;
            case 'database':
                defaultConfig = {
                    host: '207.180.235.41',
                    port: 3306,
                    database: 's14_skaffacity',
                    username: 'u14_Sz62GJBI8E',
                    password: ''  // Leeg password field - moet handmatig ingevuld worden
                };
                break;
            case 'ssl':
                defaultConfig = {
                    keyPath: '../ssl/private-key.pem',
                    certPath: '../ssl/certificate.pem',
                    keyPassword: '',  // Leeg password voor private key (indien geencrypteerd)
                    caPath: ''  // Certificate Authority path (optioneel)
                };
                break;
            case 'gameserver':
                defaultConfig = {
                    pterodactyl: {
                        enabled: false,
                        apiUrl: '',
                        apiKey: '',  // Leeg API key - moet handmatig ingevuld worden
                        serverId: '',
                        adminApiKey: '',  // Leeg admin API key voor server management
                        clientApiKey: ''  // Leeg client API key voor beperkte acties
                    },
                    maxServers: 5,
                    autoScale: true,
                    serverTemplate: {
                        name: 'SkaffaCity-GameServer',
                        egg: 5,
                        docker_image: 'ghcr.io/pterodactyl/yolks:nodejs_18',
                        startup: 'node gameserver.js',
                        environment: {
                            STARTUP: 'node gameserver.js',
                            P_SERVER_LOCATION: 'primary',
                            P_SERVER_UUID: '{{uuid}}'
                        },
                        limits: {
                            memory: 512,
                            swap: 0,
                            disk: 1024,
                            io: 500,
                            cpu: 100
                        },
                        feature_limits: {
                            databases: 0,
                            allocations: 1,
                            backups: 0
                        }
                    }
                };
                break;
        }
        
        try {
            fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2), 'utf8');
            console.log(`[ConfigManager] ✅ Created default ${configType} config`);
            this.configs.set(configType, defaultConfig);
        } catch (error) {
            console.error(`[ConfigManager] ❌ Error creating default ${configType} config: ${error.message}`);
        }
    }

    watchAllConfigs() {
        for (const [configType, fileName] of Object.entries(this.configFiles)) {
            this.watchConfig(configType, fileName);
        }
    }

    watchConfig(configType, fileName) {
        const configPath = path.join(this.configDir, fileName);
        
        if (this.watchers.has(configType)) {
            this.watchers.get(configType).close();
        }
        
        try {
            const watcher = fs.watch(configPath, (eventType) => {
                if (eventType === 'change') {
                    console.log(`[ConfigManager] 📁 ${configType} config changed, reloading...`);
                    setTimeout(() => {
                        this.loadConfig(configType, fileName);
                    }, 100); // Small delay to ensure file write is complete
                }
            });
            
            this.watchers.set(configType, watcher);
            console.log(`[ConfigManager] 👀 Watching ${configType} config for changes`);
        } catch (error) {
            console.error(`[ConfigManager] ❌ Error watching ${configType} config: ${error.message}`);
        }
    }

    // Get specific config with environment variable overrides
    getConfig(configType) {
        if (!configType) {
            return this.getAllConfigs();
        }
        
        let config = { ...this.configs.get(configType) };
        
        // Apply environment variable overrides for sensitive data
        if (configType === 'database') {
            if (process.env.DB_PASSWORD) config.password = process.env.DB_PASSWORD;
            if (process.env.DB_HOST) config.host = process.env.DB_HOST;
            if (process.env.DB_PORT) config.port = parseInt(process.env.DB_PORT);
            if (process.env.DB_NAME) config.database = process.env.DB_NAME;
            if (process.env.DB_USER) config.username = process.env.DB_USER;
        } else if (configType === 'server') {
            if (process.env.JWT_SECRET) config.jwtSecret = process.env.JWT_SECRET;
            if (process.env.ADMIN_PASSWORD) config.adminPassword = process.env.ADMIN_PASSWORD;
            if (process.env.SERVER_PORT) config.port = parseInt(process.env.SERVER_PORT);
        } else if (configType === 'gameserver') {
            if (process.env.PTERODACTYL_API_KEY) {
                config.pterodactyl = config.pterodactyl || {};
                config.pterodactyl.apiKey = process.env.PTERODACTYL_API_KEY;
            }
            if (process.env.PTERODACTYL_URL) {
                config.pterodactyl = config.pterodactyl || {};
                config.pterodactyl.apiUrl = process.env.PTERODACTYL_URL;
            }
        }
        
        return config;
    }

    // Get all configs as combined object (for backward compatibility)
    getAllConfigs() {
        const combined = {};
        for (const [type, config] of this.configs) {
            combined[type] = config;
        }
        return combined;
    }

    // Get server config (most used)
    getServerConfig() {
        return this.configs.get('server');
    }

    // Get database config
    getDatabaseConfig() {
        return this.configs.get('database');
    }

    // Get SSL config
    getSSLConfig() {
        return this.configs.get('ssl');
    }

    // Get gameserver config
    getGameServerConfig() {
        return this.configs.get('gameserver');
    }

    // Save specific config
    saveConfig(configType, newConfig) {
        const configPath = path.join(this.configDir, this.configFiles[configType]);
        
        try {
            // Update in memory
            this.configs.set(configType, newConfig);
            
            // Save to file
            fs.writeFileSync(configPath, JSON.stringify(newConfig, null, 2), 'utf8');
            
            console.log(`[ConfigManager] ✅ Saved ${configType} config`);
            this.emit('configSaved', { type: configType, config: newConfig });
            
            return true;
        } catch (error) {
            console.error(`[ConfigManager] ❌ Error saving ${configType} config: ${error.message}`);
            return false;
        }
    }

    // Update specific config property
    updateConfig(configType, path, value) {
        const config = this.configs.get(configType);
        if (!config) {
            console.error(`[ConfigManager] ❌ Config type '${configType}' not found`);
            return false;
        }

        // Handle nested path like "server.port" or "pterodactyl.enabled"
        const pathParts = path.split('.');
        let current = config;
        
        for (let i = 0; i < pathParts.length - 1; i++) {
            if (!current[pathParts[i]]) {
                current[pathParts[i]] = {};
            }
            current = current[pathParts[i]];
        }
        
        current[pathParts[pathParts.length - 1]] = value;
        
        return this.saveConfig(configType, config);
    }

    // Reload all configs from disk
    reloadAllConfigs() {
        console.log('[ConfigManager] 🔄 Reloading all configs...');
        this.loadAllConfigs();
    }

    // Cleanup
    cleanup() {
        console.log('[ConfigManager] 🧹 Cleaning up watchers...');
        for (const watcher of this.watchers.values()) {
            watcher.close();
        }
        this.watchers.clear();
    }
}

module.exports = ConfigManager;