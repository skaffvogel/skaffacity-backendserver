/**
 * User Model - Sequelize MySQL Model
 */

const { DataTypes } = require('sequelize');

// Get sequelize instance from models/index.js to avoid circular dependency
function getSequelize() {
    const db = require('../utils/db');
    return db.sequelize;
}

// We'll export a factory function instead
module.exports = (sequelize) => {

    if (!sequelize) {
        throw new Error('Sequelize instance is required');
    }
    
    const User = sequelize.define('User', {
        id: {
            type: DataTypes.STRING(36),
            primaryKey: true
        },
        username: {
            type: DataTypes.STRING(50),
            allowNull: false,
            unique: true
        },
        password: { // match existing migration column name
            type: DataTypes.STRING(255),
            allowNull: false
        },
        email: {
            type: DataTypes.STRING(100),
            allowNull: true,
            unique: true
        },
        display_name: {
            type: DataTypes.STRING(100),
            allowNull: true
        },
        skaff: {
            type: DataTypes.BIGINT,
            allowNull: false,
            defaultValue: 0
        },
        role: {
            type: DataTypes.ENUM('player','admin','moderator'),
            allowNull: false,
            defaultValue: 'player'
        },
        is_active: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: true
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
        tableName: 'users',
        timestamps: false
    });

    return User;
};