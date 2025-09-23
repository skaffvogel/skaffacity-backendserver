/**
 * Database model - User
 * MySQL implementatie
 */

const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
const db = require('../utils/db');
const config = require('../config/config.json');

class User {
  constructor(data = {}) {
    this.id = data.id || uuidv4();
    this.username = data.username;
    this.password = data.password; // Encrypted password
    this.email = data.email;
    this.displayName = data.display_name;
    this.avatarUrl = data.avatar_url;
    this.skaff = data.skaff || 0;
    this.ovenSpins = data.oven_spins || 1;
    this.lastOvenReset = data.last_oven_reset || new Date();
    this.hasVoted = data.has_voted || false;
    this.lastVoteReset = data.last_vote_reset || new Date();
    this.isActive = data.is_active !== undefined ? data.is_active : true;
    this.role = data.role || 'player';
    this.resetPasswordToken = data.reset_password_token;
    this.resetPasswordExpires = data.reset_password_expires;
    this.createdAt = data.created_at || new Date();
    this.updatedAt = data.updated_at || new Date();
  }

  /**
   * Hash een wachtwoord
   * @param {string} password - Wachtwoord om te hashen
   * @returns {Promise<string>} - Gehashed wachtwoord
   */
  static async hashPassword(password) {
    return await bcrypt.hash(password, config.auth.saltRounds);
  }

  /**
   * Vergelijk een wachtwoord met een hash
   * @param {string} password - Wachtwoord om te controleren
   * @param {string} hash - Hash om mee te vergelijken
   * @returns {Promise<boolean>} - Is het wachtwoord correct
   */
  static async comparePassword(password, hash) {
    return await bcrypt.compare(password, hash);
  }

  /**
   * Creëer een nieuwe gebruiker
   * @param {Object} userData - Gebruikersdata
   * @returns {Promise<User>} - Nieuwe gebruiker
   */
  static async create(userData) {
    const hashedPassword = await this.hashPassword(userData.password);
    const id = uuidv4();
    
    await db.query(
      'INSERT INTO users (id, username, password, email, display_name, avatar_url, role) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, userData.username, hashedPassword, userData.email, userData.displayName, userData.avatarUrl, userData.role || 'player']
    );
    
    return await this.findById(id);
  }

  /**
   * Vind een gebruiker op ID
   * @param {string} id - Gebruiker ID
   * @returns {Promise<User|null>} - Gevonden gebruiker of null
   */
  static async findById(id) {
    const [user] = await db.query('SELECT * FROM users WHERE id = ?', [id]);
    return user ? new User(user) : null;
  }

  /**
   * Vind een gebruiker op gebruikersnaam
   * @param {string} username - Gebruikersnaam
   * @returns {Promise<User|null>} - Gevonden gebruiker of null
   */
  static async findByUsername(username) {
    const [user] = await db.query('SELECT * FROM users WHERE username = ?', [username]);
    return user ? new User(user) : null;
  }

  /**
   * Vind een gebruiker op email
   * @param {string} email - Email adres
   * @returns {Promise<User|null>} - Gevonden gebruiker of null
   */
  static async findByEmail(email) {
    const [user] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
    return user ? new User(user) : null;
  }

  /**
   * Vind alle gebruikers
   * @param {Object} filter - Filter criteria
   * @param {number} limit - Maximum aantal resultaten
   * @param {number} skip - Aantal resultaten om over te slaan
   * @returns {Promise<User[]>} - Lijst van gebruikers
   */
  static async find(filter = {}, limit = 100, skip = 0) {
    let query = 'SELECT * FROM users';
    const params = [];
    
    // Bouw WHERE clausule als er filters zijn
    if (Object.keys(filter).length > 0) {
      const whereConditions = [];
      
      for (const [key, value] of Object.entries(filter)) {
        const columnName = key.replace(/([A-Z])/g, '_$1').toLowerCase();
        whereConditions.push(`${columnName} = ?`);
        params.push(value);
      }
      
      query += ' WHERE ' + whereConditions.join(' AND ');
    }
    
    // Voeg limiet en offset toe
    query += ' LIMIT ? OFFSET ?';
    params.push(limit, skip);
    
    const users = await db.query(query, params);
    return users.map(user => new User(user));
  }

  /**
   * Tel het aantal gebruikers dat aan criteria voldoet
   * @param {Object} filter - Filter criteria
   * @returns {Promise<number>} - Aantal gebruikers
   */
  static async countDocuments(filter = {}) {
    let query = 'SELECT COUNT(*) as count FROM users';
    const params = [];
    
    // Bouw WHERE clausule als er filters zijn
    if (Object.keys(filter).length > 0) {
      const whereConditions = [];
      
      for (const [key, value] of Object.entries(filter)) {
        const columnName = key.replace(/([A-Z])/g, '_$1').toLowerCase();
        whereConditions.push(`${columnName} = ?`);
        params.push(value);
      }
      
      query += ' WHERE ' + whereConditions.join(' AND ');
    }
    
    const [result] = await db.query(query, params);
    return result ? result.count : 0;
  }

  /**
   * Update een gebruiker
   * @param {Object} updates - Velden om bij te werken
   * @returns {Promise<User>} - Bijgewerkte gebruiker
   */
  async update(updates) {
    const updateData = {};
    
    // Converteer camelCase naar snake_case voor MySQL
    for (const [key, value] of Object.entries(updates)) {
      if (key !== 'id' && typeof value !== 'function') {
        const snakeKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
        updateData[snakeKey] = value;
      }
    }
    
    if (Object.keys(updateData).length === 0) {
      return this;
    }
    
    const setClause = Object.keys(updateData)
      .map(key => `${key} = ?`)
      .join(', ');
    
    const params = [...Object.values(updateData), this.id];
    
    await db.query(`UPDATE users SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, params);
    
    // Haal de bijgewerkte gebruiker op
    return User.findById(this.id);
  }

  /**
   * Update een gebruikerswachtwoord
   * @param {string} password - Nieuw wachtwoord
   * @returns {Promise<User>} - Bijgewerkte gebruiker
   */
  async updatePassword(password) {
    const hashedPassword = await User.hashPassword(password);
    await db.query('UPDATE users SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [hashedPassword, this.id]);
    return User.findById(this.id);
  }

  /**
   * Update laatste login tijd
   * @returns {Promise<User>} - Bijgewerkte gebruiker
   */
  async updateLastLogin() {
    await db.query('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?', [this.id]);
    return User.findById(this.id);
  }

  /**
   * Reset dagelijkse oven spins
   * @returns {Promise<User>} - Bijgewerkte gebruiker
   */
  async resetDailyOvenSpins() {
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
      
      await db.query(
        'UPDATE users SET oven_spins = 1, last_oven_reset = CURRENT_TIMESTAMP WHERE id = ?', 
        [this.id]
      );
    }
    
    return this;
  }

  /**
   * Helper voor SKAFF transacties
   * @param {number} amount - Hoeveelheid toe te voegen
   * @returns {Promise<User>} - Bijgewerkte gebruiker
   */
  async addSkaff(amount) {
    await db.query(
      'UPDATE users SET skaff = skaff + ? WHERE id = ?',
      [amount, this.id]
    );
    
    const updated = await User.findById(this.id);
    this.skaff = updated.skaff;
    return this;
  }

  /**
   * Helper voor SKAFF transacties
   * @param {number} amount - Hoeveelheid af te trekken
   * @returns {Promise<User>} - Bijgewerkte gebruiker
   */
  async subtractSkaff(amount) {
    // Controleer of gebruiker genoeg SKAFF heeft
    const [user] = await db.query('SELECT skaff FROM users WHERE id = ?', [this.id]);
    
    if (!user || user.skaff < amount) {
      throw new Error('Niet genoeg SKAFF');
    }
    
    await db.query(
      'UPDATE users SET skaff = skaff - ? WHERE id = ?',
      [amount, this.id]
    );
    
    const updated = await User.findById(this.id);
    this.skaff = updated.skaff;
    return this;
  }

  /**
   * Verwijder een gebruiker
   * @returns {Promise<boolean>} - Success
   */
  async remove() {
    await db.query('DELETE FROM users WHERE id = ?', [this.id]);
    return true;
  }
  
  /**
   * Converteer voor JSON (API response)
   */
  toJSON() {
    return {
      id: this.id,
      username: this.username,
      email: this.email,
      displayName: this.displayName,
      avatarUrl: this.avatarUrl,
      skaff: this.skaff,
      ovenSpins: this.ovenSpins,
      role: this.role,
      isActive: this.isActive,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

module.exports = User;