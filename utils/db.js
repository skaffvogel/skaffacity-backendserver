/**
 * Database connectie module voor MySQL
 */

const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

// Laad de configuratie (met fallback)
let config, dbConfig;
try {
    config = require('./config/config.json');
    dbConfig = config.database;
} catch (error) {
    console.warn('Config file not found, using environment variables');
    // Fallback naar environment variables
    config = {
        database: {
            host: process.env.DB_HOST || '207.180.235.41',
            port: process.env.DB_PORT || 3306,
            name: process.env.DB_NAME || 'skaffacity',
            user: process.env.DB_USER || 'skaffa',
            password: process.env.DB_PASSWORD || 'defaultpassword',
            connectionLimit: 10
        }
    };
    dbConfig = config.database;
}

// Database pool voor efficiënt verbindingsbeheer
let pool;

/**
 * Initialiseer de database verbinding
 */
const initDatabase = async () => {
  // Eerst debug info tonen over de database configuratie
  const dbHost = process.env.DB_HOST || dbConfig.host;
  const dbPort = process.env.DB_PORT || dbConfig.port;
  const dbName = process.env.DB_NAME || dbConfig.name;
  const dbUser = process.env.DB_USER || dbConfig.user;
  
  try {
    console.log(`[DB DEBUG] Proberen verbinding te maken met database:
    - Host: ${dbHost}
    - Port: ${dbPort}
    - Database: ${dbName}
    - User: ${dbUser}
    - ConnectionLimit: ${dbConfig.pool?.max || 'niet ingesteld'}`);
    
    // Pool aanmaken
    pool = mysql.createPool({
      host: dbHost,
      port: dbPort,
      database: dbName,
      user: dbUser,
      password: process.env.DB_PASSWORD || dbConfig.password,
      waitForConnections: true,
      connectionLimit: dbConfig.pool?.max || 10,
      queueLimit: 0
    });

    console.log('[DB DEBUG] Pool gemaakt, verbinding testen...');
    
    // Test de verbinding
    const connection = await pool.getConnection();
    console.log('[DB SUCCESS] MySQL database verbinding succesvol');
    
    // Database server informatie weergeven
    const [versionResult] = await connection.query('SELECT VERSION() as version');
    console.log(`[DB INFO] MySQL server versie: ${versionResult[0].version}`);
    
    // Controleer of de database bestaat
    try {
      const [databasesResult] = await connection.query('SHOW DATABASES LIKE ?', [dbName]);
      if (databasesResult.length === 0) {
        console.error(`[DB ERROR] Database '${dbName}' bestaat niet!`);
      } else {
        console.log(`[DB INFO] Database '${dbName}' gevonden`);
      }
    } catch (dbError) {
      console.error(`[DB ERROR] Kan databases niet controleren: ${dbError.message}`);
    }
    
    console.log('[DB INFO] Database migraties uitvoeren...');
    
    // Voer database migraties uit
    await runMigrations();
    
    connection.release();
    return true;
  } catch (error) {
    console.error(`[DB ERROR] Database connectiefout: ${error.message}`);
    
    // Gedetailleerde error informatie weergeven
    if (error.code) {
      console.error(`[DB ERROR] Error code: ${error.code}`);
      
      // Specifieke foutcodes interpreteren
      switch (error.code) {
        case 'ECONNREFUSED':
          console.error('[DB DEBUG] Verbinding geweigerd: Controleer of de MySQL server draait en bereikbaar is op de opgegeven host en poort.');
          // Check voor host.docker.internal probleem
          if (dbHost === 'localhost' || dbHost === '127.0.0.1') {
            console.error('[DB CRITICAL] Je gebruikt localhost/127.0.0.1 terwijl de database buiten de container draait!');
            console.error('[DB CRITICAL] Gebruik "host.docker.internal" in plaats van localhost/127.0.0.1 voor toegang tot de host machine.');
          } else if (dbHost === 'host.docker.internal') {
            console.error('[DB CRITICAL] Verbinding naar host.docker.internal mislukt. Mogelijk oorzaken:');
            console.error('  1. De MySQL server draait niet op de host');
            console.error('  2. MySQL luistert alleen op 127.0.0.1 (bind-address in MySQL config)');
            console.error('  3. De host machine heeft geen poorttoegang ingesteld voor MySQL');
            console.error('  4. MySQL gebruiker heeft geen rechten voor externe verbindingen');
            console.error('');
            console.error('Oplossingen:');
            console.error('  1. Verander MySQL bind-address naar 0.0.0.0 in /etc/mysql/mysql.conf.d/mysqld.cnf');
            console.error('  2. Voer deze MySQL commando\'s uit op de host:');
            console.error('     CREATE USER \'skaffa\'@\'%\' IDENTIFIED BY \'jouw_wachtwoord\';');
            console.error('     GRANT ALL PRIVILEGES ON skaffacity.* TO \'skaffa\'@\'%\';');
            console.error('     FLUSH PRIVILEGES;');
          }
          break;
        case 'ER_ACCESS_DENIED_ERROR':
          console.error('[DB DEBUG] Toegang geweigerd: Controleer gebruikersnaam en wachtwoord.');
          // Controle voor host.docker.internal specifieke gebruikersproblemen
          if (dbHost === 'host.docker.internal') {
            console.error('[DB HELP] Voor host.docker.internal moet je gebruikersrechten geven met:');
            console.error(`  CREATE USER '${dbUser}'@'%' IDENTIFIED BY 'wachtwoord';`);
            console.error(`  GRANT ALL PRIVILEGES ON ${dbName}.* TO '${dbUser}'@'%';`);
            console.error('  FLUSH PRIVILEGES;');
          }
          break;
        case 'ER_BAD_DB_ERROR':
          console.error('[DB DEBUG] Database niet gevonden: De opgegeven database bestaat niet.');
          console.error(`[DB HELP] Maak de database aan met: CREATE DATABASE ${dbName};`);
          break;
        case 'ETIMEDOUT':
          console.error('[DB DEBUG] Verbinding timeout: De server antwoordde niet binnen de timeout periode.');
          console.error('[DB HELP] Controleer of er geen firewall tussen de container en MySQL server zit.');
          break;
        case 'ENOTFOUND':
          console.error('[DB DEBUG] Host niet gevonden: De opgegeven hostname kon niet worden opgelost.');
          if (dbHost === 'host.docker.internal') {
            console.error('[DB CRITICAL] host.docker.internal wordt niet herkend. Dit kan betekenen dat:');
            console.error('  1. Je Pterodactyl Wings versie is verouderd');
            console.error('  2. De Docker daemon configuratie host.docker.internal niet ondersteunt');
            console.error('');
            console.error('[DB HELP] Probeer het interne IP-adres van de host te gebruiken (niet 127.0.0.1 maar bijv. 192.168.x.x)');
          }
          break;
        default:
          console.error('[DB DEBUG] Onbekende fout. Zie error object voor details.');
      }
    }
    
    // Stack trace weergeven in development mode
    if (process.env.NODE_ENV !== 'production') {
      console.error('[DB DEBUG] Stack trace:', error.stack);
    }
    
    return false;
  }
};

/**
 * Voer een query uit op de database
 * @param {string} sql - SQL query
 * @param {Array} params - Query parameters
 * @returns {Promise} - Query resultaat
 */
const query = async (sql, params = []) => {
  // Check if debugging is enabled
  const debugMode = process.env.DB_DEBUG === '1' || process.env.NODE_ENV === 'development';
  
  if (!pool) {
    console.error('[DB ERROR] Database pool is niet geïnitialiseerd. Initialiseer eerst de database met initDatabase()');
    throw new Error('Database pool is niet geïnitialiseerd');
  }
  
  // Log de query in debug mode
  if (debugMode) {
    const truncatedSql = sql.length > 200 ? sql.substring(0, 200) + '...' : sql;
    console.log(`[DB DEBUG] Uitvoeren query: ${truncatedSql}`);
    if (params && params.length > 0) {
      console.log(`[DB DEBUG] Parameters: ${JSON.stringify(params)}`);
    }
  }
  
  const startTime = Date.now();
  
  try {
    const [results] = await pool.execute(sql, params);
    
    // Log query tijd in debug mode
    if (debugMode) {
      const duration = Date.now() - startTime;
      console.log(`[DB DEBUG] Query uitgevoerd in ${duration}ms, ${results ? results.length : 0} resultaten`);
    }
    
    return results;
  } catch (error) {
    const duration = Date.now() - startTime;
    
    console.error(`[DB ERROR] Query fout: ${error.message}`);
    console.error(`[DB ERROR] SQL (${duration}ms): ${sql}`);
    if (params && params.length > 0) {
      console.error(`[DB ERROR] Parameters: ${JSON.stringify(params)}`);
    }
    
    // Gedetailleerde error informatie
    if (error.code) {
      console.error(`[DB ERROR] Error code: ${error.code}`);
      
      // Specifieke MySQL foutcodes interpreteren
      switch (error.errno) {
        case 1054: // ER_BAD_FIELD_ERROR
          console.error('[DB DEBUG] Onbekend veld in query');
          break;
        case 1146: // ER_NO_SUCH_TABLE
          console.error('[DB DEBUG] Tabel bestaat niet');
          break;
        case 1062: // ER_DUP_ENTRY
          console.error('[DB DEBUG] Duplicate entry voor unieke sleutel');
          break;
        case 1064: // ER_PARSE_ERROR
          console.error('[DB DEBUG] SQL syntax error');
          break;
        default:
          console.error(`[DB DEBUG] MySQL error nummer: ${error.errno}`);
      }
    }
    
    // Stack trace in development mode
    if (process.env.NODE_ENV !== 'production') {
      console.error('[DB DEBUG] Stack trace:', error.stack);
    }
    
    throw error;
  }
};

/**
 * Initialiseer model tabellen
 */
const initModelTables = async () => {
  try {
    console.log('Model tabellen initialiseren...');
    
    // Importeer de modellen dynamisch
    const Transaction = require('../models/transaction.mysql');
    
    // Initialiseer de tabellen
    if (Transaction.initTable && typeof Transaction.initTable === 'function') {
      await Transaction.initTable();
    }
    
    // Hier kunnen andere model tabellen worden toegevoegd
    // bijvoorbeeld: await User.initTable();
    
    console.log('Model tabellen geïnitialiseerd');
  } catch (error) {
    console.error(`Model tabel initialisatie fout: ${error.message}`);
  }
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
  const dbHost = process.env.DB_HOST || dbConfig.host;
  const dbPort = process.env.DB_PORT || dbConfig.port;
  const dbName = process.env.DB_NAME || dbConfig.name;
  const dbUser = process.env.DB_USER || dbConfig.user;
  
  console.log('==== DATABASE DIAGNOSE ====');
  console.log('Configuratie:');
  console.log(` - Host: ${dbHost}`);
  console.log(` - Port: ${dbPort}`);
  console.log(` - Database: ${dbName}`);
  console.log(` - User: ${dbUser}`);
  console.log(` - Password: ${process.env.DB_PASSWORD ? '***' + process.env.DB_PASSWORD.substr(-3) : '***' + dbConfig.password.substr(-3)}`);
  
  // Check voor localhost issues in containers
  if (dbHost === 'localhost' || dbHost === '127.0.0.1') {
    console.log('\n[WAARSCHUWING] Je gebruikt localhost of 127.0.0.1 voor de database host.');
    console.log('[WAARSCHUWING] Als MySQL draait buiten de container (op de host machine), dan');
    console.log('[WAARSCHUWING] zul je verbindingsproblemen ondervinden omdat localhost/127.0.0.1');
    console.log('[WAARSCHUWING] binnen de container naar de container zelf verwijst, niet naar de host.');
    console.log('[TIP] Gebruik "host.docker.internal" om te verbinden met de host machine vanuit een container.');
    console.log('[TIP] Of gebruik het interne IP-adres van de host machine (bijv. 192.168.x.x).');
  } else if (dbHost === 'host.docker.internal') {
    console.log('\n[INFO] Je gebruikt host.docker.internal om te verbinden met MySQL op de host machine.');
    console.log('[INFO] Zorg ervoor dat:');
    console.log('  1. MySQL is geconfigureerd om externe verbindingen toe te staan (bind-address = 0.0.0.0)');
    console.log('  2. De MySQL gebruiker toegang heeft vanaf andere hosts dan localhost (gebruiker@\'%\')');
  }
  
  // Test netwerk verbinding zonder authenticatie
  console.log('\nNetwerk connectiviteit test:');
  try {
    const { exec } = require('child_process');
    const platform = process.platform;
    
    if (platform === 'win32') {
      // Windows
      exec(`ping -n 2 ${dbHost}`, (error, stdout, stderr) => {
        console.log(stdout);
        if (error) {
          console.error(`[DIAGNOSE] Ping error: ${error.message}`);
        }
      });
    } else {
      // Unix/Linux/MacOS
      exec(`ping -c 2 ${dbHost}`, (error, stdout, stderr) => {
        console.log(stdout);
        if (error) {
          console.error(`[DIAGNOSE] Ping error: ${error.message}`);
        }
      });
    }
  } catch (error) {
    console.error(`[DIAGNOSE] Kan ping niet uitvoeren: ${error.message}`);
  }
  
  // Docker specifieke test voor host-connectivity
  console.log('\nDocker host connectivity test:');
  try {
    const net = require('net');
    
    // Test verbinding met host.docker.internal
    const testDockerHost = (host, port) => {
      return new Promise((resolve) => {
        const socket = new net.Socket();
        const onError = () => {
          socket.destroy();
          resolve(false);
        };
        
        socket.setTimeout(1000);
        socket.once('error', onError);
        socket.once('timeout', onError);
        
        socket.connect(port, host, () => {
          socket.end();
          resolve(true);
        });
      });
    };
    
    // Controleer verschillende hostnames die vaak gebruikt worden voor Docker -> host communicatie
    const hostConnectivityCheck = async () => {
      const hosts = [
        {name: dbHost, description: 'Configured database host'},
        {name: 'host.docker.internal', description: 'Docker special hostname for host machine (Windows/Mac)'},
        {name: '172.17.0.1', description: 'Default Docker bridge gateway'},
        {name: 'host-gateway', description: 'Docker network host gateway'}
      ];
      
      for (const host of hosts) {
        const connected = await testDockerHost(host.name, dbPort);
        console.log(`[DIAGNOSE] ${host.name} (${host.description}): ${connected ? 'BEREIKBAAR ✅' : 'NIET BEREIKBAAR ❌'}`);
      }
    };
    
    hostConnectivityCheck();
  } catch (error) {
    console.error(`[DIAGNOSE] Docker host connectivity test error: ${error.message}`);
  }
  
  // Controleer omgevingsvariabelen
  console.log('\nOmgevingsvariabelen:');
  const envVars = [
    'DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER', 'DB_PASSWORD',
    'NODE_ENV', 'DB_DEBUG'
  ];
  
  envVars.forEach(varName => {
    const value = process.env[varName];
    console.log(` - ${varName}: ${varName.includes('PASSWORD') && value ? '***' + value.substr(-3) : value || 'niet ingesteld'}`);
  });
  
  console.log('\nConfig bestand check:');
  try {
    console.log(` - Config bestand: ${config ? 'Geladen' : 'Niet geladen'}`);
    console.log(` - Database config: ${dbConfig ? 'Aanwezig' : 'Ontbreekt'}`);
    if (dbConfig) {
      console.log(` - Config validatie: ${
        dbConfig.host && dbConfig.port && dbConfig.name && dbConfig.user && dbConfig.password 
        ? 'OK' 
        : 'Onvolledig (een of meer vereiste velden ontbreken)'
      }`);
    }
  } catch (error) {
    console.error(` - Config error: ${error.message}`);
  }
  
  console.log('===========================\n');
};

module.exports = {
  initDatabase,
  query,
  getConnection,
  closeDatabase,
  diagnoseConnection  // Diagnostische functie exporteren
};