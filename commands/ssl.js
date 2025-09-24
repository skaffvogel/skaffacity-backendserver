/**
 * SSL Certificate Management Command
 * Handles SSL certificate generation and HTTPS toggle
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class SSLCommand {
    constructor() {
        this.description = 'Manage SSL certificates and HTTPS settings';
        this.usage = 'ssl <generate|toggle|status>';
        this.sslDir = path.join(__dirname, '../ssl');
    }

    async execute(args) {
        const action = args[0];

        switch (action) {
            case 'generate':
                await this.generateCertificates();
                break;
            case 'toggle':
                await this.toggleHTTPS();
                break;
            case 'status':
                await this.showStatus();
                break;
            case 'enable':
                await this.enableHTTPS();
                break;
            case 'disable':
                await this.disableHTTPS();
                break;
            default:
                this.showHelp();
                break;
        }
    }

    async generateCertificates() {
        console.log('[SSL] 🔐 Generating SSL certificates...');
        
        try {
            // Create SSL directory if it doesn't exist
            if (!fs.existsSync(this.sslDir)) {
                fs.mkdirSync(this.sslDir, { recursive: true });
                console.log('[SSL] ✅ Created SSL directory');
            }

            const keyPath = path.join(this.sslDir, 'private-key.pem');
            const certPath = path.join(this.sslDir, 'certificate.pem');

            // Generate private key
            console.log('[SSL] Generating private key...');
            execSync(`openssl genrsa -out "${keyPath}" 2048`, { stdio: 'inherit' });

            // Generate certificate
            console.log('[SSL] Generating certificate...');
            execSync(`openssl req -new -x509 -key "${keyPath}" -out "${certPath}" -days 365 -subj "/C=NL/ST=Netherlands/L=Amsterdam/O=SkaffaCity/OU=GameServer/CN=localhost"`, { stdio: 'inherit' });

            console.log('[SSL] ✅ SSL certificates generated successfully!');
            console.log(`[SSL] 📄 Private key: ${keyPath}`);
            console.log(`[SSL] 📄 Certificate: ${certPath}`);
            console.log('[SSL] 💡 Use "ssl enable" to activate HTTPS');

        } catch (error) {
            console.error('[SSL] ❌ Failed to generate certificates:', error.message);
            console.log('[SSL] 💡 Make sure OpenSSL is installed and available in PATH');
            console.log('[SSL] 💡 Alternative: Use "ssl enable" with existing certificates');
        }
    }

    async toggleHTTPS() {
        if (!global.configManager) {
            console.log('[SSL] ❌ ConfigManager not available');
            return;
        }
        
        const serverConfig = global.configManager.getConfig('server');
        if (!serverConfig) {
            console.log('[SSL] ❌ Server configuration not found');
            return;
        }
        
        const currentStatus = serverConfig.enableHTTPS;
        const newStatus = !currentStatus;
        
        const success = global.configManager.updateConfig('server', 'enableHTTPS', newStatus);
        if (success) {
            const status = newStatus ? 'enabled' : 'disabled';
            const emoji = newStatus ? '🔐' : '🔓';
            
            console.log(`[SSL] ${emoji} HTTPS ${status}`);
            console.log('[SSL] 🔄 Changes applied immediately with live reload');
        } else {
            console.log('[SSL] ❌ Failed to toggle HTTPS');
        }
        
        this.showStatus();
    }

    async enableHTTPS() {
        if (global.configManager) {
            global.configManager.set('server.enableHTTPS', true);
        } else {
            const config = this.loadConfig();
            config.server.enableHTTPS = true;
            this.saveConfig(config);
        }
        
        console.log('[SSL] 🔐 HTTPS enabled');
        console.log('[SSL] 🔄 Restart server to apply changes');
        
        this.showStatus();
    }

    async disableHTTPS() {
        if (global.configManager) {
            global.configManager.set('server.enableHTTPS', false);
        } else {
            const config = this.loadConfig();
            config.server.enableHTTPS = false;
            this.saveConfig(config);
        }
        
        console.log('[SSL] 🔓 HTTPS disabled');
        console.log('[SSL] 🔄 Restart server to apply changes');
        
        this.showStatus();
    }

    async showStatus() {
        console.log('\n╔══════════════════════════════════════════════════════════╗');
        console.log('║                      SSL Status                          ║');
        console.log('╠══════════════════════════════════════════════════════════╣');
        
        if (!global.configManager) {
            console.log('║  ❌ ConfigManager not available                        ║');
            console.log('╚══════════════════════════════════════════════════════════╝');
            return;
        }
        
        const sslConfig = global.configManager.getConfig('ssl');
        const serverConfig = global.configManager.getConfig('server');
        
        if (!sslConfig || !serverConfig) {
            console.log('║  ❌ SSL or Server configuration not found             ║');
            console.log('╚══════════════════════════════════════════════════════════╝');
            return;
        }
        
        const httpsEnabled = serverConfig.enableHTTPS;
        const httpsEmoji = httpsEnabled ? '🔐' : '🔓';
        const httpsStatus = httpsEnabled ? 'ENABLED' : 'DISABLED';
        
        console.log(`║  HTTPS Status: ${httpsEmoji} ${httpsStatus.padEnd(36)} ║`);
        console.log(`║  HTTP Port:    ${serverConfig.port.toString().padEnd(40)} ║`);
        console.log(`║  HTTPS Port:   ${serverConfig.httpsPort.toString().padEnd(40)} ║`);
        
        // Check certificate files using SSL config paths
        const keyPath = path.resolve(__dirname, '..', sslConfig.keyPath);
        const certPath = path.resolve(__dirname, '..', sslConfig.certPath);
        
        const keyExists = fs.existsSync(keyPath);
        const certExists = fs.existsSync(certPath);
        
        const keyEmoji = keyExists ? '✅' : '❌';
        const certEmoji = certExists ? '✅' : '❌';
        
        console.log(`║  Private Key:  ${keyEmoji} ${(keyExists ? 'Found' : 'Missing').padEnd(36)} ║`);
        console.log(`║  Certificate:  ${certEmoji} ${(certExists ? 'Found' : 'Missing').padEnd(36)} ║`);
        
        if (httpsEnabled && (!keyExists || !certExists)) {
            console.log('║                                                          ║');
            console.log('║  ⚠️  HTTPS enabled but certificates missing!            ║');
            console.log('║  💡 Run "ssl generate" to create certificates          ║');
        }
        
        console.log('╚══════════════════════════════════════════════════════════╝\n');
    }

    showHelp() {
        console.log('\n╔══════════════════════════════════════════════════════════╗');
        console.log('║                    SSL Command Help                      ║');
        console.log('╠══════════════════════════════════════════════════════════╣');
        console.log('║  ssl generate     - Generate new SSL certificates       ║');
        console.log('║  ssl enable       - Enable HTTPS mode                   ║');
        console.log('║  ssl disable      - Disable HTTPS mode                  ║');
        console.log('║  ssl toggle       - Toggle HTTPS on/off                 ║');
        console.log('║  ssl status       - Show current SSL status             ║');
        console.log('╚══════════════════════════════════════════════════════════╝\n');
    }

    loadConfig() {
        try {
            const configData = fs.readFileSync(this.configPath, 'utf8');
            return JSON.parse(configData);
        } catch (error) {
            console.error('[SSL] ❌ Failed to load config:', error.message);
            process.exit(1);
        }
    }

    saveConfig(config) {
        try {
            fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2), 'utf8');
            console.log('[SSL] ✅ Configuration updated');
        } catch (error) {
            console.error('[SSL] ❌ Failed to save config:', error.message);
        }
    }
}

module.exports = SSLCommand;