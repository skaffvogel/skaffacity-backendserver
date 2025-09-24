/**
 * Player Model - Sequelize MySQL Model
 */

const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Player = sequelize.define('Player', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    user_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'users',
            key: 'id'
        }
    },
    username: {
        type: DataTypes.STRING(50),
        allowNull: false
    },
    level: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1
    },
    xp: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
    },
    skaff: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1000
    },
    health: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 100
    },
    max_health: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 100
    },
    faction_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
    },
    last_seen: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
    },
    created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
    },
    updated_at: {
        type: DataTypes.DATE,
        allowNull: true
    }
}, {
    tableName: 'players',
    timestamps: false // We handle timestamps manually
});

module.exports = Player;