/**
 * Database Management Command
 * Handles database operations and monitoring
 */

const fs = require('fs');
const path = require('path');

class DatabaseCommand {
    constructor() {
        this.description = 'Manage database connection and operations';
        this.usage = 'database <status|test|migrate|reset|users|stats>';
    }

    async execute(args) {
        const action = args[0];

        switch (action) {
            case 'status':
                await this.showStatus();
                break;
            case 'test':
                await this.testConnection();
                break;
            case 'migrate':
                await this.runMigrations();
                break;
            case 'reset':
                await this.resetDatabase();
                break;
            case 'users':
                await this.showUsers();
                break;
            case 'stats':
                await this.showStats();
                break;
            case 'backup':
                await this.createBackup();
                break;
            default:
                this.showHelp();
                break;
        }
    }

    async showStatus() {
        console.log('\n╔══════════════════════════════════════════════════════════╗');
        console.log('║                    Database Status                       ║');
        console.log('╠══════════════════════════════════════════════════════════╣');
        
        try {
            const config = this.loadConfig();
            const dbConfig = config.database;
            
            console.log(`║  Host:        ${dbConfig.host.padEnd(40)} ║`);
            console.log(`║  Port:        ${dbConfig.port.toString().padEnd(40)} ║`);
            console.log(`║  Database:    ${dbConfig.database.padEnd(40)} ║`);
            console.log(`║  Username:    ${dbConfig.username.padEnd(40)} ║`);
            console.log('║                                                          ║');
            
            // Test connection
            const db = require('../utils/db');
            const connectionResult = await this.testDatabaseConnection();
            
            if (connectionResult.success) {
                console.log('║  Status:      ✅ Connected                               ║');
                console.log(`║  Response:    ${connectionResult.time}ms                         ║`);
            } else {
                console.log('║  Status:      ❌ Connection Failed                       ║');
                console.log(`║  Error:       ${connectionResult.error.substring(0, 35).padEnd(35)} ║`);
            }
            
        } catch (error) {
            console.log('║  Status:      ❌ Configuration Error                     ║');
            console.log(`║  Error:       ${error.message.substring(0, 35).padEnd(35)} ║`);
        }
        
        console.log('╚══════════════════════════════════════════════════════════╝\n');
    }

    async testConnection() {
        console.log('[DATABASE] 🔍 Testing database connection...');
        
        const result = await this.testDatabaseConnection();
        
        if (result.success) {
            console.log(`[DATABASE] ✅ Connection successful (${result.time}ms)`);
            console.log('[DATABASE] 📊 Database is reachable and responding');
        } else {
            console.log('[DATABASE] ❌ Connection failed');
            console.log(`[DATABASE] Error: ${result.error}`);
            console.log('[DATABASE] 💡 Check your database configuration');
        }
    }

    async testDatabaseConnection() {
        const startTime = Date.now();
        try {
            const db = require('../utils/db');
            // Simple query to test connection
            await db.query('SELECT 1 as test');
            const endTime = Date.now();
            
            return {
                success: true,
                time: endTime - startTime
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    async runMigrations() {
        console.log('[DATABASE] 🔄 Running database migrations...');
        
        try {
            const db = require('../utils/db');
            
            // Run basic table creation queries
            console.log('[DATABASE] Creating users table...');
            await db.query(`
                CREATE TABLE IF NOT EXISTS users (
                    id INT PRIMARY KEY AUTO_INCREMENT,
                    username VARCHAR(255) UNIQUE NOT NULL,
                    email VARCHAR(255) UNIQUE NOT NULL,
                    password VARCHAR(255) NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
                )
            `);
            
            console.log('[DATABASE] Creating players table...');
            await db.query(`
                CREATE TABLE IF NOT EXISTS players (
                    id INT PRIMARY KEY AUTO_INCREMENT,
                    user_id INT NOT NULL,
                    level INT DEFAULT 1,
                    experience INT DEFAULT 0,
                    coins INT DEFAULT 1000,
                    faction VARCHAR(50) DEFAULT NULL,
                    position_x FLOAT DEFAULT 0,
                    position_y FLOAT DEFAULT 0,
                    position_z FLOAT DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                )
            `);
            
            console.log('[DATABASE] Creating transactions table...');
            await db.query(`
                CREATE TABLE IF NOT EXISTS transactions (
                    id INT PRIMARY KEY AUTO_INCREMENT,
                    user_id INT NOT NULL,
                    type VARCHAR(50) NOT NULL,
                    amount INT NOT NULL,
                    description TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                )
            `);
            
            console.log('[DATABASE] ✅ Migrations completed successfully');
            
        } catch (error) {
            console.error('[DATABASE] ❌ Migration failed:', error.message);
        }
    }

    async resetDatabase() {
        console.log('[DATABASE] ⚠️  WARNING: This will delete all data!');
        console.log('[DATABASE] 🔄 Resetting database...');
        
        try {
            const db = require('../utils/db');
            
            console.log('[DATABASE] Dropping existing tables...');
            await db.query('DROP TABLE IF EXISTS transactions');
            await db.query('DROP TABLE IF EXISTS players');
            await db.query('DROP TABLE IF EXISTS users');
            
            console.log('[DATABASE] Recreating tables...');
            await this.runMigrations();
            
            console.log('[DATABASE] ✅ Database reset completed');
            
        } catch (error) {
            console.error('[DATABASE] ❌ Reset failed:', error.message);
        }
    }

    async showUsers() {
        console.log('[DATABASE] 👥 Fetching user statistics...');
        
        try {
            const db = require('../utils/db');
            
            const userCount = await db.query('SELECT COUNT(*) as count FROM users');
            const playerCount = await db.query('SELECT COUNT(*) as count FROM players');
            const recentUsers = await db.query(`
                SELECT username, created_at 
                FROM users 
                ORDER BY created_at DESC 
                LIMIT 5
            `);
            
            console.log('\n╔══════════════════════════════════════════════════════════╗');
            console.log('║                    User Statistics                       ║');
            console.log('╠══════════════════════════════════════════════════════════╣');
            console.log(`║  Total Users:     ${userCount[0].count.toString().padEnd(36)} ║`);
            console.log(`║  Total Players:   ${playerCount[0].count.toString().padEnd(36)} ║`);
            console.log('║                                                          ║');
            console.log('║  Recent Users:                                           ║');
            
            for (const user of recentUsers) {
                const date = new Date(user.created_at).toLocaleDateString();
                console.log(`║    ${user.username.padEnd(20)} ${date.padEnd(20)} ║`);
            }
            
            console.log('╚══════════════════════════════════════════════════════════╝\n');
            
        } catch (error) {
            console.error('[DATABASE] ❌ Failed to fetch user data:', error.message);
        }
    }

    async showStats() {
        console.log('[DATABASE] 📊 Gathering database statistics...');
        
        try {
            const db = require('../utils/db');
            
            // Get table sizes and row counts
            const tables = ['users', 'players', 'transactions'];
            const stats = {};
            
            for (const table of tables) {
                try {
                    const count = await db.query(`SELECT COUNT(*) as count FROM ${table}`);
                    stats[table] = count[0].count;
                } catch (error) {
                    stats[table] = 'N/A';
                }
            }
            
            console.log('\n╔══════════════════════════════════════════════════════════╗');
            console.log('║                 Database Statistics                      ║');
            console.log('╠══════════════════════════════════════════════════════════╣');
            
            for (const [table, count] of Object.entries(stats)) {
                console.log(`║  ${table.padEnd(15)}: ${count.toString().padEnd(35)} ║`);
            }
            
            console.log('╚══════════════════════════════════════════════════════════╝\n');
            
        } catch (error) {
            console.error('[DATABASE] ❌ Failed to gather statistics:', error.message);
        }
    }

    async createBackup() {
        console.log('[DATABASE] 💾 Creating database backup...');
        console.log('[DATABASE] 💡 This feature requires mysqldump to be installed');
        
        // This is a placeholder - actual implementation would depend on the environment
        console.log('[DATABASE] ⚠️  Backup feature not implemented in Pterodactyl environment');
        console.log('[DATABASE] 💡 Use your hosting provider\'s backup tools instead');
    }

    showHelp() {
        console.log('\n╔══════════════════════════════════════════════════════════╗');
        console.log('║                 Database Command Help                    ║');
        console.log('╠══════════════════════════════════════════════════════════╣');
        console.log('║  database status      - Show database connection info   ║');
        console.log('║  database test        - Test database connection        ║');
        console.log('║  database migrate     - Run database migrations         ║');
        console.log('║  database reset       - Reset all tables (DANGEROUS!)  ║');
        console.log('║  database users       - Show user statistics            ║');
        console.log('║  database stats       - Show database statistics        ║');
        console.log('║  database backup      - Create database backup          ║');
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

module.exports = DatabaseCommand;