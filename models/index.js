/**
 * Models Index - Exporteert alle Sequelize models
 */

// Get database config from new modular system
function getDatabaseConfig() {
    if (global.configManager && global.configManager.getConfig) {
        return global.configManager.getConfig('database');
    }
    
    // Fallback to old system if available
    try {
        return require('../config/database');
    } catch (error) {
        console.warn('[MODELS] No database config available, using defaults');
        return {
            host: '207.180.235.41',
            port: 3306,
            database: 's14_skaffacity',
            username: 'u14_Sz62GJBI8E'
        };
    }
}

// Import database connection
const db = require('../utils/db');
const sequelize = db.sequelize || null;

let User = null;
let Player = null;

// Initialize Sequelize models only if sequelize is available
if (sequelize) {
    try {
        // Sequelize models (using factory functions)
        const UserFactory = require('./user.sequelize');
        const PlayerFactory = require('./player.sequelize');
        
        User = UserFactory(sequelize);
        Player = PlayerFactory(sequelize);
        
        // Define associations
        User.hasOne(Player, { foreignKey: 'user_id', as: 'player' });
        Player.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
        
        console.log('[MODELS] ✅ Sequelize models initialized');
    } catch (error) {
        console.error('[MODELS] ❌ Error initializing Sequelize models:', error.message);
        User = null;
        Player = null;
    }
} else {
    console.warn('[MODELS] ⚠️ Sequelize not available, using legacy models only');
}

// Legacy models (fallback - always available)
const FactionLegacy = require('./faction.mysql');
const TransactionLegacy = require('./transaction.mysql');

// Synchronisatie functie voor development
const syncModels = async () => {
    try {
        if (process.env.NODE_ENV === 'development') {
            console.log('[Models] Synchroniseren van Sequelize models...');
            await sequelize.sync({ alter: true }); // alter: true voor veilige schema updates
            console.log('[Models] Sequelize models gesynchroniseerd!');
        }
    } catch (error) {
        console.error('[Models] Synchronisatie fout:', error.message);
    }
};

module.exports = {
    sequelize,
    User,
    Player,
    syncModels,
    // Legacy models
    Faction: FactionLegacy,
    Transaction: TransactionLegacy
};