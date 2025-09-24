/**
 * Modular Configuration Management Command
 * Manages separate config files in ./config directory
 */

class ConfigCommand {
    constructor() {
        this.description = 'Manage modular server configuration files';
        this.usage = 'config <show|set|reload|help> [configType.key] [value]';
    }

    async execute(args) {
        const action = args[0];

        switch (action) {
            case 'show':
            case 'list':
                await this.show();
                break;
            case 'set':
                await this.set(args[1], args.slice(2).join(' '));
                break;
            case 'reload':
                await this.reload();
                break;
            case 'help':
            default:
                await this.help();
                break;
        }
    }

    async show() {
        console.log('[CONFIG] 📋 Current Configuration:');
        
        if (global.configManager) {
            const allConfigs = global.configManager.getAllConfigs();
            console.log('[CONFIG] 🗂️ All config files:');
            for (const [type, config] of Object.entries(allConfigs)) {
                console.log(`\n[CONFIG] 📄 ${type}.json:`);
                console.log(JSON.stringify(config, null, 2));
            }
        } else {
            console.log('[CONFIG] ❌ ConfigManager not available');
        }
    }

    async set(key, value) {
        if (!key || value === undefined) {
            console.log('[CONFIG] ❌ Usage: config set <configType>.<key> <value>');
            console.log('[CONFIG] 💡 Example: config set server.port 8080');
            console.log('[CONFIG] 💡 Available configs: server, database, ssl, gameserver');
            return;
        }

        // Parse key to determine config type and property path
        const keyParts = key.split('.');
        if (keyParts.length < 2) {
            console.log('[CONFIG] ❌ Key must include config type (e.g., server.port)');
            return;
        }

        const configType = keyParts[0];
        const propertyPath = keyParts.slice(1).join('.');

        // Convert string values to appropriate types
        let parsedValue = value;
        if (value === 'true') parsedValue = true;
        else if (value === 'false') parsedValue = false;
        else if (!isNaN(value) && !isNaN(parseFloat(value))) parsedValue = parseFloat(value);

        if (global.configManager) {
            const success = global.configManager.updateConfig(configType, propertyPath, parsedValue);
            if (success) {
                console.log(`[CONFIG] ✅ Set ${configType}.${propertyPath} = ${parsedValue}`);
                console.log(`[CONFIG] 💾 Saved to config/${configType}.json`);
                console.log(`[CONFIG] 🔄 Change will be applied immediately (live reload)`);
            } else {
                console.log(`[CONFIG] ❌ Failed to set ${configType}.${propertyPath}`);
            }
        } else {
            console.log('[CONFIG] ❌ ConfigManager not available');
        }
    }

    async reload() {
        console.log('[CONFIG] 🔄 Reloading all configurations...');
        
        if (global.configManager) {
            global.configManager.reloadAllConfigs();
            console.log('[CONFIG] ✅ All configurations reloaded from files');
        } else {
            console.log('[CONFIG] ❌ ConfigManager not available');
        }
    }

    async help() {
        console.log('[CONFIG] 📚 Configuration Commands:');
        console.log('[CONFIG] config show                         - Show all configuration files');
        console.log('[CONFIG] config set <type>.<key> <value>     - Update configuration value');
        console.log('[CONFIG] config reload                       - Reload all configurations from files');
        console.log('[CONFIG] config help                         - Show this help');
        console.log('');
        console.log('[CONFIG] 💡 Available config types: server, database, ssl, gameserver');
        console.log('[CONFIG] 💡 Examples:');
        console.log('[CONFIG] config set server.port 8080');
        console.log('[CONFIG] config set server.enableHTTPS true');
        console.log('[CONFIG] config set ssl.keyPath ../ssl/new-key.pem');
        console.log('[CONFIG] config set gameserver.maxServers 10');
        console.log('[CONFIG] config set database.host 127.0.0.1');
        console.log('');
        console.log('[CONFIG] 🔄 All changes are applied immediately with live reload');
        console.log('[CONFIG] 📁 Config files are stored in ./config/ directory');
    }
}

module.exports = ConfigCommand;