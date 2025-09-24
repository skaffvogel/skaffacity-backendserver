/**
 * Configuration API Routes
 * Endpoints voor live configuratie management
 */

const express = require('express');
const router = express.Router();

// GET /api/v1/config/current - Huidige configuratie
router.get('/current', (req, res) => {
    try {
        const config = global.configManager ? global.configManager.getConfig() : null;
        const serverConfig = global.getCurrentServerConfig ? global.getCurrentServerConfig() : null;
        
        if (!config || !serverConfig) {
            return res.status(500).json({
                success: false,
                message: 'Configuration not available'
            });
        }

        res.json({
            success: true,
            config: {
                server: {
                    port: serverConfig.port,
                    httpsPort: serverConfig.httpsPort,
                    host: serverConfig.host,
                    apiPrefix: serverConfig.apiPrefix,
                    enableHTTPS: serverConfig.enableHTTPS
                },
                database: config.database,
                gameServer: config.gameServer
            },
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to get configuration',
            error: error.message
        });
    }
});

// POST /api/v1/config/reload - Herlaad configuratie
router.post('/reload', (req, res) => {
    try {
        if (!global.configManager) {
            return res.status(500).json({
                success: false,
                message: 'Configuration manager not available'
            });
        }

        const success = global.configManager.reloadConfig();
        
        if (success) {
            const serverConfig = global.configManager.getServerConfig();
            res.json({
                success: true,
                message: 'Configuration reloaded successfully',
                config: {
                    port: serverConfig.port,
                    httpsPort: serverConfig.httpsPort,
                    host: serverConfig.host,
                    enableHTTPS: serverConfig.enableHTTPS
                },
                timestamp: new Date().toISOString()
            });
        } else {
            res.status(500).json({
                success: false,
                message: 'Failed to reload configuration'
            });
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error reloading configuration',
            error: error.message
        });
    }
});

// PUT /api/v1/config/setting - Update specifieke setting
router.put('/setting', (req, res) => {
    try {
        const { key, value } = req.body;
        
        if (!key || value === undefined) {
            return res.status(400).json({
                success: false,
                message: 'Key and value are required'
            });
        }

        if (!global.configManager) {
            return res.status(500).json({
                success: false,
                message: 'Configuration manager not available'
            });
        }

        const success = global.configManager.set(key, value);
        
        if (success) {
            res.json({
                success: true,
                message: `Setting ${key} updated successfully`,
                key: key,
                value: value,
                timestamp: new Date().toISOString()
            });
        } else {
            res.status(500).json({
                success: false,
                message: `Failed to update setting ${key}`
            });
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error updating configuration',
            error: error.message
        });
    }
});

// GET /api/v1/config/status - Configuratie status
router.get('/status', (req, res) => {
    try {
        const hasConfigManager = !!global.configManager;
        const hasGetCurrentConfig = !!global.getCurrentServerConfig;
        
        let configValid = false;
        let serverConfigValid = false;
        
        if (hasConfigManager) {
            try {
                const config = global.configManager.getConfig();
                const serverConfig = global.configManager.getServerConfig();
                configValid = !!config;
                serverConfigValid = !!serverConfig;
            } catch (error) {
                // Configs are invalid
            }
        }

        res.json({
            success: true,
            status: {
                configManagerAvailable: hasConfigManager,
                getCurrentConfigAvailable: hasGetCurrentConfig,
                configValid: configValid,
                serverConfigValid: serverConfigValid,
                liveReloadSupported: hasConfigManager && configValid,
                fileWatcherActive: hasConfigManager
            },
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error checking configuration status',
            error: error.message
        });
    }
});

module.exports = router;