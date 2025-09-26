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

// Import database connection (can become available later)
const db = require('../utils/db');

let _sequelize = db.sequelize || null;
let _User = null;
let _Player = null;
let _initTried = false;

function tryInitSequelizeModels() {
    // Refresh reference in case db.sequelize became available after module load
    if (!_sequelize && db.sequelize) {
        _sequelize = db.sequelize;
    }
    if (!_sequelize) {
        if (!_initTried) {
            console.warn('[MODELS] ⚠️ Sequelize not yet available (lazy init will retry on access)');
            _initTried = true;
        }
        return;
    }
    if (_User && _Player) return; // already initialized
    try {
        const UserFactory = require('./user.sequelize');
        const PlayerFactory = require('./player.sequelize');
        _User = UserFactory(_sequelize);
        _Player = PlayerFactory(_sequelize);
        _User.hasOne(_Player, { foreignKey: 'user_id', as: 'player' });
        _Player.belongsTo(_User, { foreignKey: 'user_id', as: 'user' });
        console.log('[MODELS] ✅ Sequelize models initialized (lazy)');
    } catch (e) {
        console.error('[MODELS] ❌ Sequelize init error (lazy):', e.message);
    }
}

// Attempt immediate init (non-fatal if it fails)
tryInitSequelizeModels();

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

// Dynamic export object with getters so previously cached requires still see updated models
const exported = { 
    get sequelize() { 
        if (!_sequelize && db.sequelize) _sequelize = db.sequelize; 
        return _sequelize; 
    },
    get User() { 
        if (!_User) tryInitSequelizeModels(); 
        return _User; 
    },
    get Player() { 
        if (!_Player) tryInitSequelizeModels(); 
        return _Player; 
    },
    syncModels,
    reinitialize: () => { _User = null; _Player = null; tryInitSequelizeModels(); },
    // Legacy models always available
    Faction: FactionLegacy,
    Transaction: TransactionLegacy
};

module.exports = exported;