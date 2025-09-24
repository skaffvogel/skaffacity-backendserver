/**
 * Logs Management Command
 * View and manage server logs
 */

const fs = require('fs');
const path = require('path');

class LogsCommand {
    constructor() {
        this.description = 'View and manage server logs';
        this.usage = 'logs <view|tail|clear|list> [lines]';
        this.logsDir = path.join(__dirname, '../logs');
    }

    async execute(args) {
        const action = args[0];
        const linesCount = parseInt(args[1]) || 50;

        switch (action) {
            case 'view':
            case 'show':
                await this.viewLogs(linesCount);
                break;
            case 'tail':
                await this.tailLogs(linesCount);
                break;
            case 'clear':
                await this.clearLogs();
                break;
            case 'list':
                await this.listLogFiles();
                break;
            case 'access':
                await this.viewAccessLogs(linesCount);
                break;
            case 'error':
                await this.viewErrorLogs(linesCount);
                break;
            default:
                this.showHelp();
                break;
        }
    }

    async viewLogs(lines) {
        console.log(`[LOGS] 📋 Showing last ${lines} log entries...`);
        
        try {
            // Check if logs directory exists
            if (!fs.existsSync(this.logsDir)) {
                console.log('[LOGS] ❌ Logs directory does not exist');
                console.log('[LOGS] 💡 Start the server first to generate logs');
                return;
            }

            const logFiles = fs.readdirSync(this.logsDir)
                .filter(file => file.endsWith('.log'))
                .sort();

            if (logFiles.length === 0) {
                console.log('[LOGS] ❌ No log files found');
                return;
            }

            // Show the most recent log file
            const latestLog = logFiles[logFiles.length - 1];
            const logPath = path.join(this.logsDir, latestLog);
            
            console.log(`[LOGS] Reading from: ${latestLog}`);
            console.log('╔══════════════════════════════════════════════════════════╗');
            console.log('║                        Server Logs                       ║');
            console.log('╠══════════════════════════════════════════════════════════╣');
            
            const content = fs.readFileSync(logPath, 'utf8');
            const logLines = content.split('\n').filter(line => line.trim());
            const recentLines = logLines.slice(-lines);
            
            for (const line of recentLines) {
                // Truncate long lines for display
                const displayLine = line.length > 56 ? line.substring(0, 53) + '...' : line;
                console.log(`║ ${displayLine.padEnd(56)} ║`);
            }
            
            console.log('╚══════════════════════════════════════════════════════════╝');
            console.log(`[LOGS] Showing ${recentLines.length} of ${logLines.length} total lines`);
            
        } catch (error) {
            console.error('[LOGS] ❌ Failed to read logs:', error.message);
        }
    }

    async tailLogs(lines) {
        console.log(`[LOGS] 👁️  Tailing logs (${lines} lines)...`);
        console.log('[LOGS] 💡 This is a one-time view. Use logs view for static viewing');
        
        await this.viewLogs(lines);
    }

    async viewAccessLogs(lines) {
        console.log(`[LOGS] 🌐 Showing last ${lines} access log entries...`);
        
        try {
            const accessLogPath = path.join(this.logsDir, 'access.log');
            
            if (!fs.existsSync(accessLogPath)) {
                console.log('[LOGS] ❌ Access log file not found');
                return;
            }
            
            const content = fs.readFileSync(accessLogPath, 'utf8');
            const logLines = content.split('\n').filter(line => line.trim());
            const recentLines = logLines.slice(-lines);
            
            console.log('╔══════════════════════════════════════════════════════════╗');
            console.log('║                      Access Logs                         ║');
            console.log('╠══════════════════════════════════════════════════════════╣');
            
            for (const line of recentLines) {
                const displayLine = line.length > 56 ? line.substring(0, 53) + '...' : line;
                console.log(`║ ${displayLine.padEnd(56)} ║`);
            }
            
            console.log('╚══════════════════════════════════════════════════════════╝');
            
        } catch (error) {
            console.error('[LOGS] ❌ Failed to read access logs:', error.message);
        }
    }

    async viewErrorLogs(lines) {
        console.log(`[LOGS] 🚨 Showing last ${lines} error log entries...`);
        
        try {
            const errorLogPath = path.join(this.logsDir, 'error.log');
            
            if (!fs.existsSync(errorLogPath)) {
                console.log('[LOGS] ✅ No error log file found (that\'s good!)');
                return;
            }
            
            const content = fs.readFileSync(errorLogPath, 'utf8');
            const logLines = content.split('\n').filter(line => line.trim());
            
            if (logLines.length === 0) {
                console.log('[LOGS] ✅ No errors found in log file');
                return;
            }
            
            const recentLines = logLines.slice(-lines);
            
            console.log('╔══════════════════════════════════════════════════════════╗');
            console.log('║                       Error Logs                         ║');
            console.log('╠══════════════════════════════════════════════════════════╣');
            
            for (const line of recentLines) {
                const displayLine = line.length > 56 ? line.substring(0, 53) + '...' : line;
                console.log(`║ ${displayLine.padEnd(56)} ║`);
            }
            
            console.log('╚══════════════════════════════════════════════════════════╝');
            
        } catch (error) {
            console.error('[LOGS] ❌ Failed to read error logs:', error.message);
        }
    }

    async clearLogs() {
        console.log('[LOGS] 🗑️  Clearing log files...');
        
        try {
            if (!fs.existsSync(this.logsDir)) {
                console.log('[LOGS] ❌ Logs directory does not exist');
                return;
            }

            const logFiles = fs.readdirSync(this.logsDir)
                .filter(file => file.endsWith('.log'));

            if (logFiles.length === 0) {
                console.log('[LOGS] ✅ No log files to clear');
                return;
            }

            for (const file of logFiles) {
                const filePath = path.join(this.logsDir, file);
                fs.writeFileSync(filePath, '', 'utf8');
                console.log(`[LOGS] ✅ Cleared ${file}`);
            }
            
            console.log(`[LOGS] ✅ Cleared ${logFiles.length} log files`);
            
        } catch (error) {
            console.error('[LOGS] ❌ Failed to clear logs:', error.message);
        }
    }

    async listLogFiles() {
        console.log('[LOGS] 📁 Listing log files...');
        
        try {
            if (!fs.existsSync(this.logsDir)) {
                console.log('[LOGS] ❌ Logs directory does not exist');
                return;
            }

            const files = fs.readdirSync(this.logsDir);
            const logFiles = files.filter(file => file.endsWith('.log'));
            
            console.log('\n╔══════════════════════════════════════════════════════════╗');
            console.log('║                        Log Files                         ║');
            console.log('╠══════════════════════════════════════════════════════════╣');
            
            if (logFiles.length === 0) {
                console.log('║  No log files found                                     ║');
            } else {
                for (const file of logFiles) {
                    const filePath = path.join(this.logsDir, file);
                    const stats = fs.statSync(filePath);
                    const size = this.formatFileSize(stats.size);
                    const modified = stats.mtime.toLocaleDateString();
                    
                    console.log(`║  📄 ${file.padEnd(20)} ${size.padEnd(10)} ${modified.padEnd(12)} ║`);
                }
            }
            
            console.log('╚══════════════════════════════════════════════════════════╝\n');
            
        } catch (error) {
            console.error('[LOGS] ❌ Failed to list log files:', error.message);
        }
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }

    showHelp() {
        console.log('\n╔══════════════════════════════════════════════════════════╗');
        console.log('║                   Logs Command Help                      ║');
        console.log('╠══════════════════════════════════════════════════════════╣');
        console.log('║  logs view [lines]    - View recent log entries (50)    ║');
        console.log('║  logs tail [lines]    - Tail log file (50)              ║');
        console.log('║  logs access [lines]  - View access logs                ║');
        console.log('║  logs error [lines]   - View error logs                 ║');
        console.log('║  logs list            - List all log files              ║');
        console.log('║  logs clear           - Clear all log files             ║');
        console.log('║                                                          ║');
        console.log('║  Examples:                                               ║');
        console.log('║  logs view 100        - View last 100 log entries       ║');
        console.log('║  logs access 25       - View last 25 access entries     ║');
        console.log('╚══════════════════════════════════════════════════════════╝\n');
    }
}

module.exports = LogsCommand;