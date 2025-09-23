/**
 * User model voor account beheer en authenticatie
 */

const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const userSchema = new mongoose.Schema({
    // Authenticatie velden
    username: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        minlength: 3
    },
    email: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true
    },
    password: {
        type: String,
        required: true,
        minlength: 8
    },
    
    // Profiel informatie
    displayName: {
        type: String,
        trim: true
    },
    avatarUrl: {
        type: String
    },
    
    // Economie
    skaff: {
        type: Number,
        default: 0
    },
    
    // Ovens en cosmetics
    ovenSpins: {
        type: Number,
        default: 1
    },
    lastOvenReset: {
        type: Date,
        default: Date.now
    },
    cosmetics: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Cosmetic'
    }],
    equippedCosmetics: {
        head: { type: mongoose.Schema.Types.ObjectId, ref: 'Cosmetic' },
        body: { type: mongoose.Schema.Types.ObjectId, ref: 'Cosmetic' },
        legs: { type: mongoose.Schema.Types.ObjectId, ref: 'Cosmetic' },
        nickname: { type: mongoose.Schema.Types.ObjectId, ref: 'Cosmetic' }
    },
    
    // Stemmen
    hasVoted: {
        type: Boolean,
        default: false
    },
    lastVoteReset: {
        type: Date,
        default: Date.now
    },
    
    // Account status
    isActive: {
        type: Boolean,
        default: true
    },
    role: {
        type: String,
        enum: ['player', 'moderator', 'admin'],
        default: 'player'
    },
    
    // Token voor wachtwoord reset
    resetPasswordToken: {
        type: String
    },
    resetPasswordExpires: {
        type: Date
    }
}, { timestamps: true });

// Hash het wachtwoord voor opslaan
userSchema.pre('save', async function(next) {
    if (!this.isModified('password')) return next();
    
    try {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (error) {
        next(error);
    }
});

// Controleer wachtwoord
userSchema.methods.comparePassword = async function(candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

// Reset dagelijkse oven spins
userSchema.methods.resetDailyOvenSpins = function() {
    const now = new Date();
    const lastReset = new Date(this.lastOvenReset);
    
    // Reset alleen als het een nieuwe dag is
    if (
        now.getDate() !== lastReset.getDate() ||
        now.getMonth() !== lastReset.getMonth() ||
        now.getFullYear() !== lastReset.getFullYear()
    ) {
        this.ovenSpins = 1; // 1 gratis spin per dag
        this.lastOvenReset = now;
    }
    
    return this;
};

// Helper voor SKAFF transacties
userSchema.methods.addSkaff = function(amount) {
    this.skaff += amount;
    return this.save();
};

userSchema.methods.subtractSkaff = function(amount) {
    if (this.skaff >= amount) {
        this.skaff -= amount;
        return this.save();
    }
    return Promise.reject(new Error('Niet genoeg SKAFF'));
};

const User = mongoose.model('User', userSchema);
module.exports = User;