/**
 * Factie model voor database opslag
 */

const mongoose = require('mongoose');

// Schema voor factie relaties
const relationSchema = new mongoose.Schema({
    factionId: {
        type: Number,
        required: true
    },
    status: {
        type: String,
        enum: ['friendly', 'neutral', 'hostile'],
        default: 'neutral'
    }
});

// Factie schema
const factionSchema = new mongoose.Schema({
    // Factie identificatie
    factionId: {
        type: Number,
        required: true,
        unique: true,
        index: true
    },
    name: {
        type: String,
        required: true,
        unique: true
    },
    description: {
        type: String,
        required: true
    },
    color: {
        type: String,
        required: true,
        default: "#FFFFFF"
    },
    
    // Factie eigenschappen
    baseLocation: {
        x: { type: Number },
        y: { type: Number },
        z: { type: Number }
    },
    safeZoneRadius: {
        type: Number,
        default: 30
    },
    
    // Relaties met andere facties
    relations: [relationSchema],
    
    // Factie statistieken
    memberCount: {
        type: Number,
        default: 0
    },
    totalKills: {
        type: Number,
        default: 0
    },
    totalDeaths: {
        type: Number,
        default: 0
    },
    
    // Leiderschap
    leaderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    officers: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    
    // Metadata
    isActive: {
        type: Boolean,
        default: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Pre-save hook voor het bijwerken van updatedAt
factionSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

// Helper om relatie status te controleren tussen facties
factionSchema.methods.getRelationWith = function(targetFactionId) {
    const relation = this.relations.find(rel => rel.factionId === targetFactionId);
    return relation ? relation.status : 'neutral';
};

// Helper om factie relaties bij te werken
factionSchema.methods.updateRelation = function(targetFactionId, status) {
    const relation = this.relations.find(rel => rel.factionId === targetFactionId);
    
    if (relation) {
        relation.status = status;
    } else {
        this.relations.push({ factionId: targetFactionId, status });
    }
    
    return this.save();
};

// Automatische populatie van lid count bij queries
factionSchema.statics.updateMemberCount = async function(factionId) {
    const Player = mongoose.model('Player');
    const count = await Player.countDocuments({ factionId, isOnline: true });
    
    return this.findOneAndUpdate(
        { factionId },
        { $set: { memberCount: count } },
        { new: true }
    );
};

const Faction = mongoose.model('Faction', factionSchema);
module.exports = Faction;