/**
 * Model Validator - Test of alle models correct laden
 */

async function validateModels() {
    try {
        console.log('[VALIDATOR] Testing model imports...');
        
        // Test Sequelize import
        const { Op } = require('sequelize');
        console.log('[VALIDATOR] ✅ Sequelize Op imported successfully');
        
        // Test models import
        const { User, Player, sequelize } = require('../models');
        console.log('[VALIDATOR] ✅ Models imported successfully');
        
        // Test database connection
        await sequelize.authenticate();
        console.log('[VALIDATOR] ✅ Database connection successful');
        
        // Test model definitions
        if (User && Player) {
            console.log('[VALIDATOR] ✅ User and Player models defined');
        } else {
            throw new Error('User or Player model not defined');
        }
        
        console.log('[VALIDATOR] 🎉 All validations passed!');
        return true;
        
    } catch (error) {
        console.error('[VALIDATOR] ❌ Validation failed:', error.message);
        console.error('[VALIDATOR] Stack:', error.stack);
        return false;
    }
}

module.exports = { validateModels };