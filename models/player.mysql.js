/**
 * Database model - Player
 * MySQL implementatie
 */

const { v4: uuidv4 } = require('uuid');
const db = require('./utils/db');
const User = require('./user.mysql');

class Player {
  constructor(data = {}) {
    this.id = data.id || uuidv4();
    this.userId = data.user_id;
    this.username = data.username;
    this.factionId = data.faction_id;
    this.health = data.health || 100;
    this.maxHealth = data.max_health || 100;
    this.position = {
      x: data.position_x || 0,
      y: data.position_y || 0,
      z: data.position_z || 0
    };
    this.rotation = {
      x: data.rotation_x || 0,
      y: data.rotation_y || 0,
      z: data.rotation_z || 0
    };
    this.createdAt = data.created_at || new Date();
    this.updatedAt = data.updated_at || new Date();
    this.lastSync = data.last_sync;
  }

  /**
   * Creëer een nieuwe speler
   * @param {Object} playerData - Speler data
   * @returns {Promise<Player>} - Nieuwe speler
   */
  static async create(playerData) {
    const id = playerData.id || uuidv4();
    
    await db.query(
      `INSERT INTO players (
        id, user_id, username, faction_id, health, max_health,
        position_x, position_y, position_z,
        rotation_x, rotation_y, rotation_z
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, 
        playerData.userId, 
        playerData.username, 
        playerData.factionId || null,
        playerData.health || 100,
        playerData.maxHealth || 100,
        playerData.position?.x || 0,
        playerData.position?.y || 0,
        playerData.position?.z || 0,
        playerData.rotation?.x || 0,
        playerData.rotation?.y || 0,
        playerData.rotation?.z || 0
      ]
    );
    
    // Maak economy record voor speler
    await db.query(
      `INSERT INTO economy (player_id, skaff, last_update)
       VALUES (?, ?, CURRENT_TIMESTAMP)`,
      [id, 0]
    );
    
    // Maak inventory record voor speler
    await db.query(
      `INSERT INTO inventory (id, player_id, max_slots, created_at)
       VALUES (UUID(), ?, 20, CURRENT_TIMESTAMP)`,
      [id]
    );
    
    return await this.findById(id);
  }

  /**
   * Vind een speler op ID
   * @param {string} id - Speler ID
   * @returns {Promise<Player|null>} - Gevonden speler of null
   */
  static async findById(id) {
    const [player] = await db.query('SELECT * FROM players WHERE id = ?', [id]);
    return player ? new Player(player) : null;
  }

  /**
   * Vind een speler op gebruiker ID
   * @param {string} userId - Gebruiker ID
   * @returns {Promise<Player|null>} - Gevonden speler of null
   */
  static async findByUserId(userId) {
    const [player] = await db.query('SELECT * FROM players WHERE user_id = ?', [userId]);
    return player ? new Player(player) : null;
  }

  /**
   * Vind een speler op gebruikersnaam
   * @param {string} username - Gebruikersnaam
   * @returns {Promise<Player|null>} - Gevonden speler of null
   */
  static async findByUsername(username) {
    const [player] = await db.query('SELECT * FROM players WHERE username = ?', [username]);
    return player ? new Player(player) : null;
  }

  /**
   * Vind alle spelers
   * @param {Object} filter - Filter criteria
   * @param {number} limit - Maximum aantal resultaten
   * @param {number} skip - Aantal resultaten om over te slaan
   * @returns {Promise<Player[]>} - Lijst van spelers
   */
  static async find(filter = {}, limit = 100, skip = 0) {
    let query = 'SELECT * FROM players';
    const params = [];
    
    // Bouw WHERE clausule als er filters zijn
    if (Object.keys(filter).length > 0) {
      const whereConditions = [];
      
      for (const [key, value] of Object.entries(filter)) {
        // Speciaal geval voor positie en rotatie
        if (key === 'position' || key === 'rotation') {
          for (const [axis, val] of Object.entries(value)) {
            whereConditions.push(`${key}_${axis} = ?`);
            params.push(val);
          }
        } else {
          const columnName = key.replace(/([A-Z])/g, '_$1').toLowerCase();
          whereConditions.push(`${columnName} = ?`);
          params.push(value);
        }
      }
      
      query += ' WHERE ' + whereConditions.join(' AND ');
    }
    
    // Voeg limiet en offset toe
    query += ' LIMIT ? OFFSET ?';
    params.push(limit, skip);
    
    const players = await db.query(query, params);
    return players.map(player => new Player(player));
  }

  /**
   * Tel het aantal spelers dat aan criteria voldoet
   * @param {Object} filter - Filter criteria
   * @returns {Promise<number>} - Aantal spelers
   */
  static async countDocuments(filter = {}) {
    let query = 'SELECT COUNT(*) as count FROM players';
    const params = [];
    
    // Bouw WHERE clausule als er filters zijn
    if (Object.keys(filter).length > 0) {
      const whereConditions = [];
      
      for (const [key, value] of Object.entries(filter)) {
        // Speciaal geval voor positie en rotatie
        if (key === 'position' || key === 'rotation') {
          for (const [axis, val] of Object.entries(value)) {
            whereConditions.push(`${key}_${axis} = ?`);
            params.push(val);
          }
        } else {
          const columnName = key.replace(/([A-Z])/g, '_$1').toLowerCase();
          whereConditions.push(`${columnName} = ?`);
          params.push(value);
        }
      }
      
      query += ' WHERE ' + whereConditions.join(' AND ');
    }
    
    const [result] = await db.query(query, params);
    return result ? result.count : 0;
  }

  /**
   * Update een speler
   * @param {Object} updates - Velden om bij te werken
   * @returns {Promise<Player>} - Bijgewerkte speler
   */
  async update(updates) {
    const updateData = {};
    
    // Verwerk updates en converteer naar MySQL format
    for (const [key, value] of Object.entries(updates)) {
      if (key === 'position') {
        if (value.x !== undefined) updateData['position_x'] = value.x;
        if (value.y !== undefined) updateData['position_y'] = value.y;
        if (value.z !== undefined) updateData['position_z'] = value.z;
      } else if (key === 'rotation') {
        if (value.x !== undefined) updateData['rotation_x'] = value.x;
        if (value.y !== undefined) updateData['rotation_y'] = value.y;
        if (value.z !== undefined) updateData['rotation_z'] = value.z;
      } else if (key !== 'id' && key !== 'userId' && key !== 'createdAt') {
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
    
    await db.query(`UPDATE players SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, params);
    
    // Haal de bijgewerkte speler op
    return Player.findById(this.id);
  }

  /**
   * Update speler positie
   * @param {Object} position - X, Y, Z coordinaten
   * @returns {Promise<Player>} - Bijgewerkte speler
   */
  async updatePosition(position) {
    await db.query(
      `UPDATE players SET 
        position_x = ?,
        position_y = ?,
        position_z = ?,
        last_sync = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?`,
      [position.x, position.y, position.z, this.id]
    );
    
    this.position = position;
    this.lastSync = new Date();
    return this;
  }

  /**
   * Update speler rotatie
   * @param {Object} rotation - X, Y, Z rotatie
   * @returns {Promise<Player>} - Bijgewerkte speler
   */
  async updateRotation(rotation) {
    await db.query(
      `UPDATE players SET 
        rotation_x = ?,
        rotation_y = ?,
        rotation_z = ?,
        last_sync = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?`,
      [rotation.x, rotation.y, rotation.z, this.id]
    );
    
    this.rotation = rotation;
    this.lastSync = new Date();
    return this;
  }

  /**
   * Beschadig een speler
   * @param {number} amount - Hoeveelheid schade
   * @returns {Promise<Player>} - Bijgewerkte speler
   */
  async damage(amount) {
    const newHealth = Math.max(0, this.health - amount);
    
    await db.query(
      `UPDATE players SET health = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [newHealth, this.id]
    );
    
    this.health = newHealth;
    return this;
  }

  /**
   * Genees een speler
   * @param {number} amount - Hoeveelheid healing
   * @returns {Promise<Player>} - Bijgewerkte speler
   */
  async heal(amount) {
    const newHealth = Math.min(this.maxHealth, this.health + amount);
    
    await db.query(
      `UPDATE players SET health = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [newHealth, this.id]
    );
    
    this.health = newHealth;
    return this;
  }

  /**
   * Haal de gebruiker op voor deze speler
   * @returns {Promise<User|null>} - Gebruiker of null
   */
  async getUser() {
    if (!this.userId) return null;
    return await User.findById(this.userId);
  }

  /**
   * Verwijder een speler
   * @returns {Promise<boolean>} - Success
   */
  async remove() {
    await db.query('DELETE FROM players WHERE id = ?', [this.id]);
    return true;
  }
  
  /**
   * Converteer voor JSON (API response)
   */
  toJSON() {
    return {
      id: this.id,
      userId: this.userId,
      username: this.username,
      factionId: this.factionId,
      health: this.health,
      maxHealth: this.maxHealth,
      position: this.position,
      rotation: this.rotation,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      lastSync: this.lastSync
    };
  }
}

module.exports = Player;