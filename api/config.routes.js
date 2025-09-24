/**
 * Modular Configuration API Routes
 * Endpoints voor modulaire configuratie management
 */

const express = require('express');
const router = express.Router();

// GET /api/v1/config/all - Alle configuraties
router.get('/all', (req, res) => {
    try {
        if (!global.configManager) {
            return res.status(503).json({
                success: false,
                message: 'ConfigManager not available'
            });
        }

        const allConfigs = global.configManager.getAllConfigs();
        
        res.json({
            success: true,
            configs: allConfigs,
            type: 'modular',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to get configurations',
            error: error.message
        });
    }
});

// GET /api/v1/config/status - Status van configuratie systeem
router.get('/status', (req, res) => {
    try {
        const currentServerConfig = global.getCurrentServerConfig ? global.getCurrentServerConfig() : null;
        const allConfigs = global.configManager ? global.configManager.getAllConfigs() : null;
        
        res.json({
            success: true,
            system: {
                type: 'modular',
                configManager: !!global.configManager,
                liveReload: true,
                configFiles: ['server.json', 'database.json', 'ssl.json', 'gameserver.json']
            },
            server: {
                host: currentServerConfig?.host,
                port: currentServerConfig?.port,
                httpsPort: currentServerConfig?.httpsPort,
                enableHTTPS: currentServerConfig?.enableHTTPS
            },
            configs: allConfigs,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// GET /api/v1/config/:type - Specifieke configuratie ophalen
router.get('/:type', (req, res) => {
    try {
        const configType = req.params.type;
        
        if (!global.configManager) {
            return res.status(503).json({
                success: false,
                message: 'ConfigManager not available'
            });
        }
        
        const config = global.configManager.getConfig(configType);
        if (!config) {
            return res.status(404).json({
                success: false,
                message: `Config type '${configType}' not found`,
                availableTypes: ['server', 'database', 'ssl', 'gameserver']
            });
        }
        
        res.json({
            success: true,
            type: configType,
            config: config,
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

// POST /api/v1/config/:type - Configuratie updaten
router.post('/:type', (req, res) => {
    try {
        const configType = req.params.type;
        const { key, value } = req.body;
        
        if (!global.configManager) {
            return res.status(503).json({
                success: false,
                message: 'ConfigManager not available'
            });
        }
        
        if (!key || value === undefined) {
            return res.status(400).json({
                success: false,
                message: 'Key and value are required',
                example: {
                    key: 'port',
                    value: 8080
                }
            });
        }
        
        // Convert string values to appropriate types
        let parsedValue = value;
        if (value === 'true') parsedValue = true;
        else if (value === 'false') parsedValue = false;
        else if (!isNaN(value) && !isNaN(parseFloat(value))) parsedValue = parseFloat(value);
        
        const success = global.configManager.updateConfig(configType, key, parsedValue);
        if (success) {
            const updatedConfig = global.configManager.getConfig(configType);
            res.json({
                success: true,
                message: `Updated ${configType}.${key}`,
                change: {
                    type: configType,
                    key: key,
                    value: parsedValue
                },
                config: updatedConfig,
                timestamp: new Date().toISOString()
            });
        } else {
            res.status(500).json({
                success: false,
                message: 'Failed to update configuration'
            });
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to update configuration',
            error: error.message
        });
    }
});

// POST /api/v1/config/reload - Alle configuraties herladen
router.post('/reload', (req, res) => {
    try {
        if (!global.configManager) {
            return res.status(503).json({
                success: false,
                message: 'ConfigManager not available'
            });
        }
        
        global.configManager.reloadAllConfigs();
        
        res.json({
            success: true,
            message: 'All configurations reloaded from files',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to reload configurations',
            error: error.message
        });
    }
});

module.exports = router;