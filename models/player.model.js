/**
 * Speler model voor database opslag
 */

const mongoose = require('mongoose');

const positionSchema = new mongoose.Schema({
    x: { type: Number, required: true },
    y: { type: Number, required: true },
    z: { type: Number, required: true }
});

const rotationSchema = new mongoose.Schema({
    x: { type: Number, required: true },
    y: { type: Number, required: true },
    z: { type: Number, required: true }
});

const playerSchema = new mongoose.Schema({
    // Player identificatie
    playerId: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    username: {
        type: String,
        required: true
    },
    
    // Speler positie en rotatie
    position: {
        type: positionSchema,
        required: true
    },
    rotation: {
        type: rotationSchema,
        required: true
    },
    
    // Speler status
    health: {
        type: Number,
        default: 100
    },
    maxHealth: {
        type: Number,
        default: 100
    },
    isAlive: {
        type: Boolean,
        default: true
    },
    
    // Factie informatie
    factionId: {
        type: Number,
        default: 0 // 0 = geen factie
    },
    
    // Status van speler
    isOnline: {
        type: Boolean,
        default: true
    },
    lastActive: {
        type: Date,
        default: Date.now
    },
    
    // Spel statistieken
    stats: {
        kills: { type: Number, default: 0 },
        deaths: { type: Number, default: 0 },
        damageDealt: { type: Number, default: 0 },
        damageTaken: { type: Number, default: 0 },
        playTime: { type: Number, default: 0 }
    }
}, { timestamps: true });

// Automatisch lastActive bijwerken
playerSchema.pre('save', function(next) {
    this.lastActive = Date.now();
    next();
});

// Automatisch spelers markeren als offline als ze langer dan 5 minuten niet actief zijn
playerSchema.statics.markInactivePlayers = async function() {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    await this.updateMany(
        { lastActive: { $lt: fiveMinutesAgo }, isOnline: true },
        { $set: { isOnline: false } }
    );
};

// Helpers voor positie updates
playerSchema.methods.updatePosition = function(newPos, newRot) {
    this.position = newPos;
    this.rotation = newRot;
    this.lastActive = Date.now();
    this.isOnline = true;
    return this.save();
};

// Helper voor health updates
playerSchema.methods.updateHealth = function(newHealth) {
    this.health = Math.max(0, Math.min(newHealth, this.maxHealth));
    this.isAlive = this.health > 0;
    return this.save();
};

// Helper om schade toe te passen
playerSchema.methods.takeDamage = function(amount, attackerId = null) {
    this.health = Math.max(0, this.health - amount);
    this.stats.damageTaken += amount;
    this.isAlive = this.health > 0;
    
    // Als de speler dood is, registreer een kill voor de aanvaller
    if (!this.isAlive && attackerId) {
        // Dit moet in de controller worden afgehandeld voor de aanvaller
        this.stats.deaths += 1;
    }
    
    return this.save();
};

// Helper voor het resetten van een speler (respawn)
playerSchema.methods.respawn = function(spawnPosition) {
    this.health = this.maxHealth;
    this.isAlive = true;
    if (spawnPosition) {
        this.position = spawnPosition;
    }
    return this.save();
};

// Index voor efficiënt zoeken van actieve spelers
playerSchema.index({ isOnline: 1 });

const Player = mongoose.model('Player', playerSchema);
module.exports = Player;