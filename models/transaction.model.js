/**
 * Economie transactie model voor SKAFF currency
 */

const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
    // Transactie details
    type: {
        type: String,
        enum: ['transfer', 'reward', 'penalty', 'kill_reward', 'shop_purchase', 'oven_reward'],
        required: true
    },
    amount: {
        type: Number,
        required: true
    },
    
    // Betrokken gebruikers
    fromUserId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    toUserId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    
    // Metadata
    description: {
        type: String
    },
    timestamp: {
        type: Date,
        default: Date.now
    },
    
    // Voor moderatie
    processedByAdmin: {
        type: Boolean,
        default: false
    },
    adminId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    
    // Systeem data
    coordinates: {
        x: { type: Number },
        y: { type: Number },
        z: { type: Number }
    }
});

// Index voor efficiënte query's
transactionSchema.index({ toUserId: 1, timestamp: -1 });
transactionSchema.index({ fromUserId: 1, timestamp: -1 });
transactionSchema.index({ timestamp: -1 });

const Transaction = mongoose.model('Transaction', transactionSchema);
module.exports = Transaction;