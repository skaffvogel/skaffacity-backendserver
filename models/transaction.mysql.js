/**
 * Database model - Transaction
 * MySQL implementatie
 */

const { v4: uuidv4 } = require('uuid');
const db = require('./utils/db');

class Transaction {
  constructor(data = {}) {
    this.id = data.id || uuidv4();
    this.amount = data.amount || 0;
    this.type = data.type;
    this.senderId = data.sender_id;
    this.receiverId = data.receiver_id;
    this.description = data.description;
    this.createdAt = data.created_at || new Date();
    this.status = data.status || 'completed';
    this.metadata = data.metadata ? JSON.parse(data.metadata) : {};
  }

  /**
   * Creëer een nieuwe transactie
   * @param {Object} transactionData - Transactie data
   * @returns {Promise<Transaction>} - Nieuwe transactie
   */
  static async create(transactionData) {
    const id = transactionData.id || uuidv4();
    const metadata = transactionData.metadata ? JSON.stringify(transactionData.metadata) : null;
    
    await db.query(
      `INSERT INTO transactions (
        id, amount, type, sender_id, receiver_id, description, status, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        transactionData.amount || 0,
        transactionData.type,
        transactionData.senderId,
        transactionData.receiverId,
        transactionData.description,
        transactionData.status || 'completed',
        metadata
      ]
    );
    
    return await this.findById(id);
  }

  /**
   * Vind een transactie op ID
   * @param {string} id - Transactie ID
   * @returns {Promise<Transaction|null>} - Gevonden transactie of null
   */
  static async findById(id) {
    const [transaction] = await db.query('SELECT * FROM transactions WHERE id = ?', [id]);
    return transaction ? new Transaction(transaction) : null;
  }

  /**
   * Vind transacties op filter
   * @param {Object} filter - Filter criteria
   * @param {number} limit - Maximum aantal resultaten
   * @param {number} skip - Aantal resultaten om over te slaan
   * @returns {Promise<Transaction[]>} - Lijst van transacties
   */
  static async find(filter = {}, limit = 100, skip = 0) {
    let query = 'SELECT * FROM transactions';
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
    
    // Sorteer op aanmaakdatum (nieuwste eerst)
    query += ' ORDER BY created_at DESC';
    
    // Voeg limiet en offset toe
    query += ' LIMIT ? OFFSET ?';
    params.push(limit, skip);
    
    const transactions = await db.query(query, params);
    return transactions.map(transaction => new Transaction(transaction));
  }

  /**
   * Vind transacties voor een bepaalde speler (verzonden of ontvangen)
   * @param {string} playerId - Speler ID
   * @param {number} limit - Maximum aantal resultaten
   * @param {number} skip - Aantal resultaten om over te slaan
   * @returns {Promise<Transaction[]>} - Lijst van transacties
   */
  static async findByPlayerId(playerId, limit = 100, skip = 0) {
    const query = `
      SELECT * FROM transactions 
      WHERE sender_id = ? OR receiver_id = ? 
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `;
    
    const transactions = await db.query(query, [playerId, playerId, limit, skip]);
    return transactions.map(transaction => new Transaction(transaction));
  }

  /**
   * Update een transactie
   * @param {Object} updates - Velden om bij te werken
   * @returns {Promise<Transaction>} - Bijgewerkte transactie
   */
  async update(updates) {
    const updateData = {};
    
    // Converteer camelCase naar snake_case voor MySQL
    for (const [key, value] of Object.entries(updates)) {
      if (key === 'metadata') {
        updateData['metadata'] = JSON.stringify(value);
      } else if (key !== 'id' && key !== 'createdAt') {
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
    
    await db.query(`UPDATE transactions SET ${setClause} WHERE id = ?`, params);
    
    // Haal de bijgewerkte transactie op
    return Transaction.findById(this.id);
  }
  
  /**
   * Converteer voor JSON (API response)
   */
  toJSON() {
    return {
      id: this.id,
      amount: this.amount,
      type: this.type,
      senderId: this.senderId,
      receiverId: this.receiverId,
      description: this.description,
      status: this.status,
      metadata: this.metadata,
      createdAt: this.createdAt
    };
  }
}

// Maak de transactions tabel aan als deze nog niet bestaat
async function initTable() {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS transactions (
        id VARCHAR(36) PRIMARY KEY,
        amount BIGINT NOT NULL,
        type VARCHAR(50) NOT NULL,
        sender_id VARCHAR(36),
        receiver_id VARCHAR(36),
        description TEXT,
        status VARCHAR(20) NOT NULL DEFAULT 'completed',
        metadata JSON,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX (sender_id),
        INDEX (receiver_id),
        INDEX (type),
        INDEX (created_at)
      )
    `);
    console.log('Transactions tabel gecontroleerd/aangemaakt');
  } catch (err) {
    console.error('Error creating transactions table:', err);
  }
}

// Voer table initialisatie uit tijdens server opstart
Transaction.initTable = initTable;

module.exports = Transaction;