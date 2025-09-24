/**
 * Database initializer
 * Deze module exporteert de database models voor MySQL
 */

const User = require('./models/user.mysql');
const Player = require('./models/player.mysql');
const Faction = require('./models/faction.mysql');
const Transaction = require('./models/transaction.mysql');

// Exporteer alle models
module.exports = {
  User,
  Player,
  Faction,
  Transaction
};