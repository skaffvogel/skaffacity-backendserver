/**
 * Models Index - Exporteert alle Sequelize models (PURE SEQUELIZE MODE - Option B)
 * Deze module verzorgt de definitieve initialisatie van de kern User/Player modellen
 * en biedt helpers voor readiness checks.
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

let _sequelize = null;
let _User = null;
let _Player = null;
let _initialized = false;
let _initializing = false;
let _lastError = null;

async function _internalInit() {
    if (_initialized) return true;
    if (_initializing) {
        // wacht tot huidig init proces klaar is
        while (_initializing) {
            await new Promise(r => setTimeout(r, 50));
        }
        return _initialized;
    }
    _initializing = true;
    try {
        if (!db.sequelize) throw new Error('Sequelize instance ontbreekt (db init mislukt)');
        _sequelize = db.sequelize;
        const UserFactory = require('./user.sequelize');
        const PlayerFactory = require('./player.sequelize');
        _User = UserFactory(_sequelize);
        _Player = PlayerFactory(_sequelize);
        _User.hasOne(_Player, { foreignKey: 'user_id', as: 'player' });
        _Player.belongsTo(_User, { foreignKey: 'user_id', as: 'user' });
        _initialized = true;
        _lastError = null;
        console.log('[MODELS] ✅ Sequelize models initialized (blocking)');
    } catch (e) {
        _lastError = e;
        console.error('[MODELS] ❌ Init error:', e.message);
    } finally {
        _initializing = false;
    }
    return _initialized;
}

async function ensureInitialized(opts = {}) {
    const { retries = 1, backoffMs = 0 } = opts;
    for (let attempt = 1; attempt <= retries; attempt++) {
        if (await _internalInit()) return true;
        if (attempt < retries) {
            const delay = backoffMs * attempt;
            if (delay) await new Promise(r => setTimeout(r, delay));
        }
    }
    return _initialized;
}

function isInitialized() { return _initialized; }
function getLastInitError() { return _lastError; }

// Legacy exports verwijderd in Option B; alleen pure Sequelize
// Indien andere modules nog legacy verwachten kan een no-op object aangeboden worden.
const FactionLegacy = undefined;
const TransactionLegacy = undefined;

// Synchronisatie functie voor development
const syncModels = async () => {
    if (!_sequelize) return;
    try {
        if (process.env.NODE_ENV === 'development') {
            console.log('[MODELS] Synchroniseren (alter:true)...');
            await _sequelize.sync({ alter: true });
            console.log('[MODELS] Synchronisatie klaar');
        }
    } catch (error) {
        console.error('[MODELS] Synchronisatie fout:', error.message);
    }
};

// Dynamic export object with getters so previously cached requires still see updated models
const exported = {
    get sequelize() { return _sequelize; },
    get User() { return _User; },
    get Player() { return _Player; },
    ensureInitialized,
    isInitialized,
    getLastInitError,
    syncModels
};

module.exports = exported;