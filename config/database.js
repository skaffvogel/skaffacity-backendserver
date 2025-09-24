/**
 * Sequelize Database Configuration
 * Gebruikt dezelfde configuratie als het bestaande db systeem
 */

const { Sequelize } = require('sequelize');

// Database configuratie (matcht met utils/db.js)
const sequelize = new Sequelize({
    dialect: 'mysql',
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    database: process.env.DB_NAME || 'skaffacity',
    username: process.env.DB_USER || 'skaffa',
    password: process.env.DB_PASSWORD || '',
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
    pool: {
        max: 10,
        min: 0,
        acquire: 30000,
        idle: 10000
    },
    // Aanvullende opties voor compatibiliteit
    define: {
        timestamps: false,
        freezeTableName: true
    }
});

// Test connectie functie
const testConnection = async () => {
    try {
        await sequelize.authenticate();
        console.log('[Sequelize] Database connectie succesvol getest.');
        return true;
    } catch (error) {
        console.error('[Sequelize] Database connectie mislukt:', error.message);
        return false;
    }
};

module.exports = { sequelize, testConnection };