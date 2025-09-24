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
        
        // Test database connection (alleen als sequelize beschikbaar is)
        if (sequelize) {
            await sequelize.authenticate();
            console.log('[VALIDATOR] ✅ Database connection successful');
        } else {
            console.log('[VALIDATOR] ⚠️  Sequelize not available, skipping database test');
        }
        
        // Test model definitions
        if (User && Player) {
            console.log('[VALIDATOR] ✅ User and Player models defined');
        } else if (!sequelize) {
            console.log('[VALIDATOR] ⚠️  Sequelize models not available, using legacy models');
        } else {
            throw new Error('User or Player model not defined');
        }
        
        if (sequelize) {
            console.log('[VALIDATOR] 🎉 All validations passed!');
        } else {
            console.log('[VALIDATOR] ⚠️  Validation completed (legacy mode)');
        }
        return true;
        
    } catch (error) {
        console.error('[VALIDATOR] ❌ Validation failed:', error.message);
        console.error('[VALIDATOR] Stack:', error.stack);
        return false;
    }
}

module.exports = { validateModels };