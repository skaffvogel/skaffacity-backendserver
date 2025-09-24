/**
 * Database initializer
 * Deze module exporteert de database models voor MySQL
 */

const fs = require('fs');
const path = require('path');

// Debug: Check wat er beschikbaar is
console.log('Current directory:', process.cwd());
console.log('__dirname:', __dirname);
if (fs.existsSync('../models')) {
    console.log('Models directory exists, contents:', fs.readdirSync('../models'));
} else if (fs.existsSync('./models')) {
    console.log('Models directory exists at ./models, contents:', fs.readdirSync('./models'));
} else {
    console.log('Models directory does not exist at ../models or ./models');
}

// Probeer models te laden met fallback
let User, Player, Faction, Transaction;

try {
    User = require('../models/user.mysql');
} catch (error) {
    console.warn('User model not found, creating placeholder');
    User = null;
}

try {
    Player = require('../models/player.mysql');
} catch (error) {
    console.warn('Player model not found, creating placeholder');
    Player = null;
}

try {
    Faction = require('../models/faction.mysql');
} catch (error) {
    console.warn('Faction model not found, creating placeholder');
    Faction = null;
}

try {
    Transaction = require('../models/transaction.mysql');
} catch (error) {
    console.warn('Transaction model not found, creating placeholder');
    Transaction = null;
}

// Exporteer alle models
module.exports = {
  User,
  Player,
  Faction,
  Transaction
};