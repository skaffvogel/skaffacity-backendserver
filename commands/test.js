/**
 * Test Command voor Live Configuration
 * Test live configuration updates
 */

class TestCommand {
    constructor() {
        this.description = 'Test live configuration functionality';
        this.usage = 'test <config|live|api>';
    }

    async execute(args) {
        const action = args[0];

        switch (action) {
            case 'config':
                await this.testConfigUpdates();
                break;
            case 'live':
                await this.testLiveUpdates();
                break;
            case 'api':
                await this.testConfigAPI();
                break;
            case 'host':
                await this.testHostConfig();
                break;
            default:
                this.showHelp();
                break;
        }
    }

    async testConfigUpdates() {
        console.log('[TEST] 🧪 Testing live configuration updates...');
        
        if (!global.configManager) {
            console.log('[TEST] ❌ ConfigManager not available');
            return;
        }

        console.log('\n[TEST] Step 1: Get current config...');
        const currentConfig = global.configManager.getConfig();
        const currentServerConfig = global.configManager.getServerConfig();
        
        if (!currentConfig || !currentServerConfig) {
            console.log('[TEST] ❌ Configuration not loaded');
            return;
        }
        
        console.log(`[TEST] Current port: ${currentServerConfig.port}`);
        console.log(`[TEST] Current HTTPS: ${currentServerConfig.enableHTTPS}`);
        
        console.log('\n[TEST] Step 2: Update port via ConfigManager...');
        const newPort = currentServerConfig.port === 8000 ? 8001 : 8000;
        const success = global.configManager.set('server.port', newPort);
        
        if (success) {
            console.log(`[TEST] ✅ Port updated to: ${newPort}`);
            
            // Verify update
            const updatedConfig = global.configManager.getServerConfig();
            if (updatedConfig && updatedConfig.port === newPort) {
                console.log('[TEST] ✅ Configuration update verified');
                
                // Restore original port
                global.configManager.set('server.port', currentServerConfig.port);
                console.log('[TEST] ✅ Port restored to original value');
            } else {
                console.log('[TEST] ❌ Configuration update failed verification');
            }
        } else {
            console.log('[TEST] ❌ Failed to update configuration');
        }
        
        console.log('\n[TEST] 🎉 Live configuration test completed');
    }

    async testLiveUpdates() {
        console.log('[TEST] 🔄 Testing live update system...');
        
        if (!global.getCurrentServerConfig) {
            console.log('[TEST] ❌ getCurrentServerConfig function not available');
            return;
        }
        
        console.log('\n[TEST] Getting live configuration...');
        const liveConfig = global.getCurrentServerConfig();
        
        if (liveConfig) {
            console.log('[TEST] ✅ Live configuration accessible');
            console.log(`[TEST] Live port: ${liveConfig.port}`);
            console.log(`[TEST] Live HTTPS: ${liveConfig.enableHTTPS}`);
            console.log(`[TEST] Live host: ${liveConfig.host}`);
        } else {
            console.log('[TEST] ❌ Live configuration not available');
        }
        
        // Test config manager availability
        if (global.configManager) {
            console.log('[TEST] ✅ ConfigManager available globally');
            const validation = global.configManager.validate();
            console.log(`[TEST] Configuration valid: ${validation.valid}`);
            if (!validation.valid) {
                console.log(`[TEST] Validation errors: ${validation.errors.join(', ')}`);
            }
        } else {
            console.log('[TEST] ❌ ConfigManager not available globally');
        }
    }

    async testConfigAPI() {
        console.log('[TEST] 🌐 Testing configuration API endpoints...');
        
        try {
            const http = require('http');
            const config = global.getCurrentServerConfig();
            
            if (!config) {
                console.log('[TEST] ❌ Cannot get server configuration');
                return;
            }
            
            const testEndpoints = [
                `/api/v1/config/current`,
                `/api/v1/config/status`
            ];
            
            console.log(`[TEST] Testing on ${config.host}:${config.port}`);
            
            for (const endpoint of testEndpoints) {
                console.log(`\n[TEST] Testing ${endpoint}...`);
                
                try {
                    const options = {
                        hostname: config.host === '0.0.0.0' ? 'localhost' : config.host,
                        port: config.port,
                        path: endpoint,
                        method: 'GET',
                        timeout: 5000
                    };
                    
                    const result = await this.makeHttpRequest(options);
                    console.log(`[TEST] ✅ ${endpoint} - Status: ${result.status}`);
                    
                    if (result.data) {
                        const data = JSON.parse(result.data);
                        console.log(`[TEST] Response success: ${data.success}`);
                    }
                } catch (error) {
                    console.log(`[TEST] ❌ ${endpoint} - Error: ${error.message}`);
                }
            }
            
        } catch (error) {
            console.log(`[TEST] ❌ API test failed: ${error.message}`);
        }
        
        console.log('\n[TEST] 💡 You can also test manually:');
        console.log('[TEST] curl http://localhost:8000/api/v1/config/current');
        console.log('[TEST] curl http://localhost:8000/api/v1/config/status');
    }

    async testHostConfig() {
        console.log('[TEST] 🏠 Testing host configuration...');
        
        console.log('\n[TEST] ConfigManager configuration:');
        if (global.configManager) {
            const config = global.configManager.getConfig();
            const serverConfig = global.configManager.getServerConfig();
            
            console.log(`[TEST] Raw config.server.host: ${config?.server?.host}`);
            console.log(`[TEST] ServerConfig.host: ${serverConfig?.host}`);
        } else {
            console.log('[TEST] ❌ ConfigManager not available');
        }
        
        console.log('\n[TEST] getCurrentServerConfig():');
        if (global.getCurrentServerConfig) {
            const currentConfig = global.getCurrentServerConfig();
            console.log(`[TEST] Current host: ${currentConfig?.host}`);
            console.log(`[TEST] Current port: ${currentConfig?.port}`);
            console.log(`[TEST] Current HTTPS: ${currentConfig?.enableHTTPS}`);
        } else {
            console.log('[TEST] ❌ getCurrentServerConfig not available');
        }
        
        console.log('\n[TEST] Raw config.json file:');
        try {
            const fs = require('fs');
            const path = require('path');
            const configPath = path.join(__dirname, '../config.json');
            const rawConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            console.log(`[TEST] File server.host: ${rawConfig.server?.host}`);
            console.log(`[TEST] File database.host: ${rawConfig.database?.host}`);
        } catch (error) {
            console.log(`[TEST] ❌ Error reading config.json: ${error.message}`);
        }
        
        console.log('\n[TEST] 💡 Host should be 0.0.0.0 for server binding');
        console.log('[TEST] 💡 Database host (207.180.235.41) should be separate');
    }

    makeHttpRequest(options) {
        const http = require('http');
        
        return new Promise((resolve, reject) => {
            const req = http.request(options, (res) => {
                let data = '';
                
                res.on('data', (chunk) => {
                    data += chunk;
                });
                
                res.on('end', () => {
                    resolve({
                        status: res.statusCode,
                        headers: res.headers,
                        data: data
                    });
                });
            });
            
            req.on('error', (error) => {
                reject(error);
            });
            
            req.on('timeout', () => {
                req.destroy();
                reject(new Error('Request timeout'));
            });
            
            req.end();
        });
    }

    showHelp() {
        console.log('\n╔══════════════════════════════════════════════════════════╗');
        console.log('║                    Test Command Help                     ║');
        console.log('╠══════════════════════════════════════════════════════════╣');
        console.log('║  test config          - Test live config updates        ║');
        console.log('║  test live            - Test live config functions      ║');
        console.log('║  test api             - Test config API endpoints       ║');
        console.log('║                                                          ║');
        console.log('║  These tests verify that configuration changes are      ║');
        console.log('║  applied immediately without server restart             ║');
        console.log('╚══════════════════════════════════════════════════════════╝\n');
    }
}

module.exports = TestCommand;