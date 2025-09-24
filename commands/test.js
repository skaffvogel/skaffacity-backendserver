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
            case 'modular':
                await this.testModularConfig();
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
        console.log('[TEST] 🏠 Testing modular host configuration...');
        
        console.log('\n[TEST] ConfigManager modular configuration:');
        if (global.configManager) {
            const serverConfig = global.configManager.getConfig('server');
            const databaseConfig = global.configManager.getConfig('database');
            
            console.log(`[TEST] Server config host: ${serverConfig?.host}`);
            console.log(`[TEST] Database config host: ${databaseConfig?.host}`);
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
        
        console.log('\n[TEST] Raw config files:');
        try {
            const fs = require('fs');
            const path = require('path');
            
            // Check server.json
            const serverPath = path.join(__dirname, '../config/server.json');
            if (fs.existsSync(serverPath)) {
                const serverConfig = JSON.parse(fs.readFileSync(serverPath, 'utf8'));
                console.log(`[TEST] server.json host: ${serverConfig.host}`);
            }
            
            // Check database.json
            const dbPath = path.join(__dirname, '../config/database.json');
            if (fs.existsSync(dbPath)) {
                const dbConfig = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
                console.log(`[TEST] database.json host: ${dbConfig.host}`);
            }
        } catch (error) {
            console.log(`[TEST] ❌ Error reading config files: ${error.message}`);
        }
        
        console.log('\n[TEST] 💡 Server host should be 0.0.0.0 for binding');
        console.log('[TEST] 💡 Database host (207.180.235.41) should be separate');
        console.log('[TEST] 🔄 Changes to config files are applied immediately with live reload');
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

    async testModularConfig() {
        console.log('[TEST] 🔧 Testing modular configuration system...');
        
        if (!global.configManager) {
            console.log('[TEST] ❌ ConfigManager not available');
            return;
        }
        
        console.log('\n[TEST] 📁 Available config files:');
        const allConfigs = global.configManager.getAllConfigs();
        for (const [type, config] of Object.entries(allConfigs)) {
            console.log(`[TEST] ✅ ${type}.json - ${Object.keys(config).length} properties`);
        }
        
        console.log('\n[TEST] 🔄 Testing live reload - making test changes...');
        
        // Test changing server port
        console.log('[TEST] Testing server.port change...');
        const originalPort = global.configManager.getConfig('server').port;
        const testPort = originalPort === 8000 ? 8001 : 8000;
        
        const success1 = global.configManager.updateConfig('server', 'port', testPort);
        console.log(`[TEST] ${success1 ? '✅' : '❌'} Changed server.port to ${testPort}`);
        
        // Wait a moment
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Change back
        const success2 = global.configManager.updateConfig('server', 'port', originalPort);
        console.log(`[TEST] ${success2 ? '✅' : '❌'} Restored server.port to ${originalPort}`);
        
        console.log('\n[TEST] 🌐 API endpoints test:');
        console.log('[TEST] curl http://localhost:8000/api/v1/config/status');
        console.log('[TEST] curl http://localhost:8000/api/v1/config/server');
        console.log('[TEST] curl http://localhost:8000/api/v1/config/all');
        
        console.log('\n[TEST] ✅ Modular configuration test completed');
    }

    showHelp() {
        console.log('\n╔══════════════════════════════════════════════════════════╗');
        console.log('║                    Test Command Help                     ║');
        console.log('╠══════════════════════════════════════════════════════════╣');
        console.log('║  test config          - Test live config updates        ║');
        console.log('║  test live            - Test live config functions      ║');
        console.log('║  test api             - Test config API endpoints       ║');
        console.log('║  test host            - Test host configuration         ║');
        console.log('║  test modular         - Test modular config system      ║');
        console.log('║                                                          ║');
        console.log('║  These tests verify that configuration changes are      ║');
        console.log('║  applied immediately without server restart             ║');
        console.log('╚══════════════════════════════════════════════════════════╝\n');
    }
}

module.exports = TestCommand;