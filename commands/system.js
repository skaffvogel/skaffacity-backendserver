/**
 * System Information Command
 * Display server and system information
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

class SystemCommand {
    constructor() {
        this.description = 'Display system and server information';
        this.usage = 'system <info|health|performance|restart>';
    }

    async execute(args) {
        const action = args[0];

        switch (action) {
            case 'info':
                await this.showSystemInfo();
                break;
            case 'health':
                await this.showHealthCheck();
                break;
            case 'performance':
            case 'perf':
                await this.showPerformance();
                break;
            case 'restart':
                await this.restartServer();
                break;
            case 'shutdown':
                await this.shutdownServer();
                break;
            case 'version':
                await this.showVersion();
                break;
            default:
                this.showHelp();
                break;
        }
    }

    async showSystemInfo() {
        console.log('[SYSTEM] 🖥️  Gathering system information...');
        
        const config = global.configManager ? global.configManager.getConfig('server') : this.loadConfig();
        
        console.log('\n╔══════════════════════════════════════════════════════════╗');
        console.log('║                   System Information                     ║');
        console.log('╠══════════════════════════════════════════════════════════╣');
        console.log(`║  Platform:        ${os.platform().padEnd(36)} ║`);
        console.log(`║  Architecture:    ${os.arch().padEnd(36)} ║`);
        console.log(`║  Node Version:    ${process.version.padEnd(36)} ║`);
        console.log(`║  CPU Cores:       ${os.cpus().length.toString().padEnd(36)} ║`);
        console.log(`║  Total Memory:    ${this.formatBytes(os.totalmem()).padEnd(36)} ║`);
        console.log(`║  Free Memory:     ${this.formatBytes(os.freemem()).padEnd(36)} ║`);
        console.log(`║  Uptime:          ${this.formatUptime(os.uptime()).padEnd(36)} ║`);
        console.log('║                                                          ║');
        console.log('║  SkaffaCity Server:                                      ║');
        console.log(`║    HTTP Port:     ${config.server.port.toString().padEnd(36)} ║`);
        console.log(`║    HTTPS Port:    ${config.server.httpsPort.toString().padEnd(36)} ║`);
        console.log(`║    HTTPS Enabled: ${config.server.enableHTTPS.toString().padEnd(36)} ║`);
        console.log(`║    Process PID:   ${process.pid.toString().padEnd(36)} ║`);
        console.log(`║    Working Dir:   ${process.cwd().substring(0, 36).padEnd(36)} ║`);
        console.log('╚══════════════════════════════════════════════════════════╝\n');
    }

    async showHealthCheck() {
        console.log('[SYSTEM] 🏥 Running health check...');
        
        const startTime = Date.now();
        const health = {
            status: 'healthy',
            checks: {}
        };

        // Check memory usage
        const memUsage = process.memoryUsage();
        const totalMem = os.totalmem();
        const memUsagePercent = ((totalMem - os.freemem()) / totalMem) * 100;
        
        health.checks.memory = {
            status: memUsagePercent < 80 ? 'ok' : 'warning',
            usage: `${memUsagePercent.toFixed(1)}%`,
            details: `${this.formatBytes(memUsage.rss)} RSS`
        };

        // Check disk space (if possible)
        try {
            const stats = fs.statSync(process.cwd());
            health.checks.disk = {
                status: 'ok',
                details: 'Accessible'
            };
        } catch (error) {
            health.checks.disk = {
                status: 'error',
                details: error.message
            };
            health.status = 'unhealthy';
        }

        // Check config file
        try {
            if (global.configManager) {
                global.configManager.getConfig('server');
            } else {
                this.loadConfig();
            }
            health.checks.config = {
                status: 'ok',
                details: 'Valid JSON'
            };
        } catch (error) {
            health.checks.config = {
                status: 'error',
                details: 'Invalid or missing'
            };
            health.status = 'unhealthy';
        }

        // Check database connection
        try {
            const db = require('../utils/db');
            await db.query('SELECT 1');
            health.checks.database = {
                status: 'ok',
                details: 'Connected'
            };
        } catch (error) {
            health.checks.database = {
                status: 'error',
                details: 'Connection failed'
            };
            health.status = 'unhealthy';
        }

        const responseTime = Date.now() - startTime;
        
        console.log('\n╔══════════════════════════════════════════════════════════╗');
        console.log('║                     Health Check                         ║');
        console.log('╠══════════════════════════════════════════════════════════╣');
        
        const statusEmoji = health.status === 'healthy' ? '✅' : '❌';
        console.log(`║  Overall Status:  ${statusEmoji} ${health.status.toUpperCase().padEnd(33)} ║`);
        console.log(`║  Response Time:   ${responseTime}ms                              ║`);
        console.log('║                                                          ║');
        
        for (const [check, result] of Object.entries(health.checks)) {
            const emoji = result.status === 'ok' ? '✅' : result.status === 'warning' ? '⚠️' : '❌';
            const checkName = check.charAt(0).toUpperCase() + check.slice(1);
            console.log(`║  ${checkName.padEnd(12)}: ${emoji} ${result.details.padEnd(32)} ║`);
        }
        
        console.log('╚══════════════════════════════════════════════════════════╝\n');
    }

    async showPerformance() {
        console.log('[SYSTEM] 📊 Gathering performance metrics...');
        
        const memUsage = process.memoryUsage();
        const cpuUsage = process.cpuUsage();
        
        console.log('\n╔══════════════════════════════════════════════════════════╗');
        console.log('║                   Performance Metrics                   ║');
        console.log('╠══════════════════════════════════════════════════════════╣');
        console.log('║  Memory Usage:                                           ║');
        console.log(`║    RSS (Resident):    ${this.formatBytes(memUsage.rss).padEnd(26)} ║`);
        console.log(`║    Heap Used:         ${this.formatBytes(memUsage.heapUsed).padEnd(26)} ║`);
        console.log(`║    Heap Total:        ${this.formatBytes(memUsage.heapTotal).padEnd(26)} ║`);
        console.log(`║    External:          ${this.formatBytes(memUsage.external).padEnd(26)} ║`);
        console.log('║                                                          ║');
        console.log('║  System Memory:                                          ║');
        console.log(`║    Total:             ${this.formatBytes(os.totalmem()).padEnd(26)} ║`);
        console.log(`║    Free:              ${this.formatBytes(os.freemem()).padEnd(26)} ║`);
        
        const memUsagePercent = ((os.totalmem() - os.freemem()) / os.totalmem()) * 100;
        console.log(`║    Usage:             ${memUsagePercent.toFixed(1)}%                      ║`);
        
        console.log('║                                                          ║');
        console.log('║  Process:                                                ║');
        console.log(`║    Process ID:        ${process.pid.toString().padEnd(26)} ║`);
        console.log(`║    Uptime:            ${this.formatUptime(process.uptime()).padEnd(26)} ║`);
        console.log(`║    Node Version:      ${process.version.padEnd(26)} ║`);
        console.log('╚══════════════════════════════════════════════════════════╝\n');
    }

    async restartServer() {
        console.log('[SYSTEM] 🔄 Initiating server restart...');
        console.log('[SYSTEM] ⚠️  This will terminate the current process');
        console.log('[SYSTEM] 💡 Pterodactyl will automatically restart the server');
        
        // Graceful shutdown
        setTimeout(() => {
            console.log('[SYSTEM] 👋 Goodbye!');
            process.exit(0);
        }, 1000);
    }

    async shutdownServer() {
        console.log('[SYSTEM] 🛑 Initiating server shutdown...');
        console.log('[SYSTEM] ⚠️  This will stop the server completely');
        
        // Graceful shutdown
        setTimeout(() => {
            console.log('[SYSTEM] 👋 Server stopped');
            process.exit(0);
        }, 1000);
    }

    async showVersion() {
        const packagePath = path.join(__dirname, '../package.json');
        
        try {
            const packageData = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
            
            console.log('\n╔══════════════════════════════════════════════════════════╗');
            console.log('║                    Version Information                   ║');
            console.log('╠══════════════════════════════════════════════════════════╣');
            console.log(`║  Server Name:     ${packageData.name.padEnd(36)} ║`);
            console.log(`║  Version:         ${packageData.version.padEnd(36)} ║`);
            console.log(`║  Description:     ${(packageData.description || 'N/A').substring(0, 36).padEnd(36)} ║`);
            console.log(`║  Node.js:         ${process.version.padEnd(36)} ║`);
            console.log(`║  Platform:        ${os.platform()} ${os.arch()}                      ║`);
            console.log('╚══════════════════════════════════════════════════════════╝\n');
            
        } catch (error) {
            console.error('[SYSTEM] ❌ Failed to read version info:', error.message);
        }
    }

    formatBytes(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }

    formatUptime(seconds) {
        const days = Math.floor(seconds / 86400);
        const hours = Math.floor((seconds % 86400) / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        
        if (days > 0) {
            return `${days}d ${hours}h ${minutes}m`;
        } else if (hours > 0) {
            return `${hours}h ${minutes}m`;
        } else {
            return `${minutes}m`;
        }
    }

    showHelp() {
        console.log('\n╔══════════════════════════════════════════════════════════╗');
        console.log('║                  System Command Help                     ║');
        console.log('╠══════════════════════════════════════════════════════════╣');
        console.log('║  system info          - Show system information         ║');
        console.log('║  system health        - Run health check                ║');
        console.log('║  system performance   - Show performance metrics        ║');
        console.log('║  system version       - Show version information        ║');
        console.log('║  system restart       - Restart the server              ║');
        console.log('║  system shutdown      - Shutdown the server             ║');
        console.log('╚══════════════════════════════════════════════════════════╝\n');
    }

    loadConfig() {
        const configPath = path.join(__dirname, '../config.json');
        try {
            const configData = fs.readFileSync(configPath, 'utf8');
            return JSON.parse(configData);
        } catch (error) {
            throw new Error(`Failed to load config: ${error.message}`);
        }
    }
}

module.exports = SystemCommand;