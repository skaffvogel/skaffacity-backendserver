/**
 * Database connectie module voor MySQL
 */

const mysql = require('mysql2/promise');

// Database pool voor efficiënt verbindingsbeheer
let pool;

/**
 * Initialiseer de database verbinding
 */
const initDatabase = async () => {
  // Database configuratie uit environment variables
  const dbHost = process.env.DB_HOST || 'localhost';
  const dbPort = parseInt(process.env.DB_PORT) || 3306;
  const dbName = process.env.DB_NAME || 'skaffacity';
  const dbUser = process.env.DB_USER || 'skaffa';
  const dbPassword = process.env.DB_PASSWORD || '';
  
  try {
    console.log(`Database verbinding maken naar ${dbHost}:${dbPort}/${dbName} als gebruiker ${dbUser}`);
    
    // Pool aanmaken
    pool = mysql.createPool({
      host: dbHost,
      port: dbPort,
      database: dbName,
      user: dbUser,
      password: dbPassword,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });

    // Test de verbinding
    const connection = await pool.getConnection();
    console.log('Database verbinding succesvol');
    
    // Voer database migraties uit
    await runMigrations();
    
    connection.release();
    return true;
  } catch (error) {
    console.error(`Database fout: ${error.message}`);
    throw error;
  }
};

/**
 * Voer een query uit op de database
 * @param {string} sql - SQL query
 * @param {Array} params - Query parameters
 * @returns {Promise} - Query resultaat
 */
const query = async (sql, params = []) => {
  if (!pool) {
    throw new Error('Database pool is niet geïnitialiseerd');
  }
  
  try {
    const [results] = await pool.execute(sql, params);
    return results;
  } catch (error) {
    console.error(`Query fout: ${error.message}`);
    throw error;
  }
};

/**
 * Initialiseer model tabellen
 */
const initModelTables = async () => {
  console.log('Model tabellen skippen - wordt door migraties afgehandeld');
};

/**
 * Voer database migraties uit om de tabellen aan te maken
 */
const runMigrations = async () => {
  try {
    console.log('Database migraties uitvoeren...');
    
    // Maak tables aan als ze nog niet bestaan
    
    // Users tabel
    await query(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(36) PRIMARY KEY,
        username VARCHAR(50) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        email VARCHAR(100) UNIQUE,
        display_name VARCHAR(100),
        avatar_url VARCHAR(255),
        skaff BIGINT DEFAULT 0,
        oven_spins INT DEFAULT 1,
        last_oven_reset TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        has_voted BOOLEAN DEFAULT false,
        last_vote_reset TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        is_active BOOLEAN DEFAULT true,
        role ENUM('player', 'admin', 'moderator') DEFAULT 'player',
        reset_password_token VARCHAR(255),
        reset_password_expires TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    
    // Players tabel
    await query(`
      CREATE TABLE IF NOT EXISTS players (
        id VARCHAR(36) PRIMARY KEY,
        user_id VARCHAR(36) NOT NULL,
        username VARCHAR(50) NOT NULL,
        faction_id INT NULL,
        health INT DEFAULT 100,
        max_health INT DEFAULT 100,
        position_x FLOAT DEFAULT 0,
        position_y FLOAT DEFAULT 0,
        position_z FLOAT DEFAULT 0,
        rotation_x FLOAT DEFAULT 0,
        rotation_y FLOAT DEFAULT 0,
        rotation_z FLOAT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        last_sync TIMESTAMP NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
    
    // Factions tabel
    await query(`
      CREATE TABLE IF NOT EXISTS factions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(50) NOT NULL UNIQUE,
        description TEXT,
        color VARCHAR(7) DEFAULT '#FFFFFF',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Economy tabel
    await query(`
      CREATE TABLE IF NOT EXISTS economy (
        player_id VARCHAR(36) PRIMARY KEY,
        skaff BIGINT DEFAULT 0,
        last_update TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE
      )
    `);
    
    // Inventory tabellen
    await query(`
      CREATE TABLE IF NOT EXISTS inventory (
        id VARCHAR(36) PRIMARY KEY,
        player_id VARCHAR(36) NOT NULL,
        max_slots INT DEFAULT 20,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE
      )
    `);
    
    await query(`
      CREATE TABLE IF NOT EXISTS inventory_items (
        id VARCHAR(36) PRIMARY KEY,
        inventory_id VARCHAR(36) NOT NULL,
        item_id VARCHAR(50) NOT NULL,
        quantity INT DEFAULT 1,
        slot INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (inventory_id) REFERENCES inventory(id) ON DELETE CASCADE,
        UNIQUE KEY inventory_slot (inventory_id, slot)
      )
    `);
    
    // Voeg basisfacties toe als ze niet bestaan
    const factions = await query('SELECT COUNT(*) as count FROM factions');
    if (factions[0].count === 0) {
      await query(`
        INSERT INTO factions (name, description, color) VALUES
        ('Neutral', 'Neutrale factie voor nieuwe spelers', '#AAAAAA'),
        ('Miners Guild', 'Specialisten in mijnbouw en grondstoffen', '#FF7700'),
        ('Traders Union', 'Handelaren en zakenlieden', '#77AAFF')
      `);
      console.log('Standaard facties aangemaakt');
    }
    
    console.log('Database migraties voltooid');
    
    // Initialiseer model tabellen na migraties
    await initModelTables();
  } catch (error) {
    console.error(`Migratie fout: ${error.message}`);
    throw error;
  }
};

/**
 * Sluit de database verbinding
 */
const closeDatabase = async () => {
  if (pool) {
    await pool.end();
    console.log('Database verbinding gesloten');
  }
};

/**
 * Get a database connection from the pool
 */
const getConnection = async () => {
  if (!pool) {
    throw new Error('Database niet geïnitialiseerd');
  }
  return await pool.getConnection();
};

/**
 * Voert diagnostiek uit op de database configuratie zonder verbinding te maken
 * Dit is nuttig voor troubleshooting van verbindingsproblemen
 */
const diagnoseConnection = async () => {
  const dbHost = process.env.DB_HOST || 'localhost';
  const dbPort = process.env.DB_PORT || 3306;
  const dbName = process.env.DB_NAME || 'skaffacity';
  const dbUser = process.env.DB_USER || 'skaffa';
  
  console.log('==== DATABASE DIAGNOSE ====');
  console.log('Environment Variables:');
  console.log(` - DB_HOST: ${dbHost}`);
  console.log(` - DB_PORT: ${dbPort}`);
  console.log(` - DB_NAME: ${dbName}`);
  console.log(` - DB_USER: ${dbUser}`);
  console.log(` - DB_PASSWORD: ${process.env.DB_PASSWORD ? 'ingesteld' : 'NIET INGESTELD!'}`);
  console.log('===========================\n');
};

module.exports = {
  initDatabase,
  query,
  getConnection,
  closeDatabase,
  diagnoseConnection  // Diagnostische functie exporteren
};