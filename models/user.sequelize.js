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
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    username: {
        type: DataTypes.STRING(50),
        allowNull: false,
        unique: true
    },
    email: {
        type: DataTypes.STRING(100),
        allowNull: false,
        unique: true,
        validate: {
            isEmail: true
        }
    },
    password_hash: {
        type: DataTypes.STRING(255),
        allowNull: false
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
        timestamps: false // We handle timestamps manually
    });

    return User;
};