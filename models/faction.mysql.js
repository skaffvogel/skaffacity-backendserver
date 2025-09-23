/**
 * Database model - Faction
 * MySQL implementatie
 */

const { v4: uuidv4 } = require('uuid');
const db = require('../utils/db');

class Faction {
  constructor(data = {}) {
    this.id = data.id;
    this.name = data.name;
    this.description = data.description;
    this.color = data.color || '#FFFFFF';
    this.createdAt = data.created_at || new Date();
  }

  /**
   * Creëer een nieuwe factie
   * @param {Object} factionData - Factie data
   * @returns {Promise<Faction>} - Nieuwe factie
   */
  static async create(factionData) {
    const result = await db.query(
      `INSERT INTO factions (name, description, color)
       VALUES (?, ?, ?)`,
      [
        factionData.name,
        factionData.description || null,
        factionData.color || '#FFFFFF'
      ]
    );
    
    // MySQL auto-increment ID ophalen
    const id = result.insertId;
    return await this.findById(id);
  }

  /**
   * Vind een factie op ID
   * @param {number} id - Factie ID
   * @returns {Promise<Faction|null>} - Gevonden factie of null
   */
  static async findById(id) {
    const [faction] = await db.query('SELECT * FROM factions WHERE id = ?', [id]);
    return faction ? new Faction(faction) : null;
  }

  /**
   * Vind een factie op naam
   * @param {string} name - Factie naam
   * @returns {Promise<Faction|null>} - Gevonden factie of null
   */
  static async findByName(name) {
    const [faction] = await db.query('SELECT * FROM factions WHERE name = ?', [name]);
    return faction ? new Faction(faction) : null;
  }

  /**
   * Vind alle facties
   * @param {Object} filter - Filter criteria
   * @param {number} limit - Maximum aantal resultaten
   * @param {number} skip - Aantal resultaten om over te slaan
   * @returns {Promise<Faction[]>} - Lijst van facties
   */
  static async find(filter = {}, limit = 100, skip = 0) {
    let query = 'SELECT * FROM factions';
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
    
    const factions = await db.query(query, params);
    return factions.map(faction => new Faction(faction));
  }

  /**
   * Update een factie
   * @param {Object} updates - Velden om bij te werken
   * @returns {Promise<Faction>} - Bijgewerkte factie
   */
  async update(updates) {
    const updateData = {};
    
    // Converteer camelCase naar snake_case voor MySQL
    for (const [key, value] of Object.entries(updates)) {
      if (key !== 'id' && key !== 'createdAt') {
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
    
    await db.query(`UPDATE factions SET ${setClause} WHERE id = ?`, params);
    
    // Haal de bijgewerkte factie op
    return Faction.findById(this.id);
  }

  /**
   * Haal alle leden van een factie op
   * @returns {Promise<Array>} - Lijst van spelers in deze factie
   */
  async getMembers() {
    const players = await db.query(
      `SELECT * FROM players WHERE faction_id = ?`,
      [this.id]
    );
    
    const Player = require('./player.mysql');
    return players.map(player => new Player(player));
  }

  /**
   * Tel het aantal leden in een factie
   * @returns {Promise<number>} - Aantal leden
   */
  async getMemberCount() {
    const [result] = await db.query(
      `SELECT COUNT(*) as count FROM players WHERE faction_id = ?`,
      [this.id]
    );
    
    return result ? result.count : 0;
  }

  /**
   * Verwijder een factie
   * @returns {Promise<boolean>} - Success
   */
  async remove() {
    // Eerst alle spelers uit de factie verwijderen
    await db.query('UPDATE players SET faction_id = NULL WHERE faction_id = ?', [this.id]);
    
    // Dan de factie zelf verwijderen
    await db.query('DELETE FROM factions WHERE id = ?', [this.id]);
    return true;
  }
  
  /**
   * Converteer voor JSON (API response)
   */
  toJSON() {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      color: this.color,
      createdAt: this.createdAt
    };
  }
}

module.exports = Faction;