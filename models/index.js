/**
 * Models Index - Exporteert alle Sequelize models
 */

const { sequelize } = require('../config/database');

// Sequelize models
const User = require('./user.sequelize');
const Player = require('./player.sequelize');

// Legacy models (fallback)
const FactionLegacy = require('./faction.mysql');
const TransactionLegacy = require('./transaction.mysql');

// Define associations
User.hasOne(Player, { foreignKey: 'user_id', as: 'player' });
Player.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

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