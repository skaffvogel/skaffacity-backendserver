/**
 * Player Model - Sequelize MySQL Model
 */

const { DataTypes } = require('sequelize');

// Export factory function for sequelize instance
module.exports = (sequelize) => {
    if (!sequelize) {
        throw new Error('Sequelize instance is required');
    }
    
    const Player = sequelize.define('Player', {
        id: {
            type: DataTypes.STRING(36),
            primaryKey: true
        },
        user_id: {
            type: DataTypes.STRING(36),
            allowNull: false,
            references: { model: 'users', key: 'id' }
        },
        username: { type: DataTypes.STRING(50), allowNull: false },
        faction_id: { type: DataTypes.INTEGER, allowNull: true },
        health: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 100 },
        max_health: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 100 },
        position_x: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 },
        position_y: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 },
        position_z: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 },
        rotation_x: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 },
        rotation_y: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 },
        rotation_z: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 },
        created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
        updated_at: { type: DataTypes.DATE, allowNull: true }
    }, {
        tableName: 'players',
        timestamps: false
    });

    return Player;
};