/**
 * Setup script voor MySQL database
 * 
 * Dit script maakt een nieuwe database en gebruiker aan voor SkaffaCity
 * Zorg ervoor dat je een MySQL server hebt draaien en de root toegangsgegevens hebt
 */

const mysql = require('mysql2/promise');
const prompts = require('prompts');
const fs = require('fs');
const path = require('path');
const config = require('../config/config.json');

// Instellingen voor de database
const DB_NAME = config.database.name || 'skaffacity';
const DB_USER = config.database.user || 'skaffacity';
const DB_PASSWORD = config.database.password || 'skaffacity_password';
const DB_HOST = config.database.host || 'localhost';

/**
 * Hoofdfunctie voor het instellen van de database
 */
async function setupDatabase() {
  console.log('\n========= SkaffaCity Database Setup =========\n');
  
  try {
    // Vraag om MySQL root toegangsgegevens
    const credentials = await prompts([
      {
        type: 'text',
        name: 'host',
        message: 'MySQL server adres:',
        initial: 'localhost'
      },
      {
        type: 'number',
        name: 'port',
        message: 'MySQL server poort:',
        initial: 3306
      },
      {
        type: 'text',
        name: 'user',
        message: 'MySQL root gebruikersnaam:',
        initial: 'root'
      },
      {
        type: 'password',
        name: 'password',
        message: 'MySQL root wachtwoord:'
      },
      {
        type: 'text',
        name: 'database',
        message: 'Naam van de database die je wilt aanmaken:',
        initial: DB_NAME
      },
      {
        type: 'text',
        name: 'newUser',
        message: 'Nieuwe gebruiker voor SkaffaCity:',
        initial: DB_USER
      },
      {
        type: 'password',
        name: 'newPassword',
        message: 'Wachtwoord voor nieuwe gebruiker:',
        initial: DB_PASSWORD
      }
    ]);
    
    // Maak een verbinding met MySQL als root
    console.log('\nVerbinding maken met MySQL server...');
    const rootPool = await mysql.createPool({
      host: credentials.host,
      port: credentials.port,
      user: credentials.user,
      password: credentials.password,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });
    
    // Test de verbinding
    await rootPool.query('SELECT 1');
    console.log('✅ Verbonden met MySQL server\n');
    
    // Controleer of de database al bestaat
    const [databases] = await rootPool.query(
      'SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME = ?',
      [credentials.database]
    );
    
    if (databases.length > 0) {
      const { confirm } = await prompts({
        type: 'confirm',
        name: 'confirm',
        message: `Database '${credentials.database}' bestaat al. Wil je deze overschrijven?`,
        initial: false
      });
      
      if (confirm) {
        console.log(`Database '${credentials.database}' wordt verwijderd...`);
        await rootPool.query(`DROP DATABASE IF EXISTS ${credentials.database}`);
        console.log(`✅ Database '${credentials.database}' verwijderd\n`);
      } else {
        console.log('\n❌ Operatie geannuleerd door gebruiker');
        process.exit(0);
      }
    }
    
    // Maak de database aan
    console.log(`Database '${credentials.database}' wordt aangemaakt...`);
    await rootPool.query(`CREATE DATABASE IF NOT EXISTS ${credentials.database} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    console.log(`✅ Database '${credentials.database}' aangemaakt\n`);
    
    // Controleer of de gebruiker al bestaat
    const [users] = await rootPool.query(
      `SELECT User FROM mysql.user WHERE User = ? AND Host = ?`,
      [credentials.newUser, '%']
    );
    
    if (users.length > 0) {
      console.log(`Gebruiker '${credentials.newUser}' bestaat al en wordt bijgewerkt...`);
      await rootPool.query(`DROP USER IF EXISTS '${credentials.newUser}'@'%'`);
    } else {
      console.log(`Gebruiker '${credentials.newUser}' wordt aangemaakt...`);
    }
    
    // Maak de gebruiker aan en geef rechten
    await rootPool.query(`CREATE USER '${credentials.newUser}'@'%' IDENTIFIED BY '${credentials.newPassword}'`);
    await rootPool.query(`GRANT ALL PRIVILEGES ON ${credentials.database}.* TO '${credentials.newUser}'@'%'`);
    await rootPool.query('FLUSH PRIVILEGES');
    console.log(`✅ Gebruiker '${credentials.newUser}' aangemaakt en rechten toegekend\n`);
    
    // Werk config.json bij
    console.log('Config.json wordt bijgewerkt...');
    
    // Laad het bestaande config bestand
    const configPath = path.join(__dirname, '../config/config.json');
    const configContent = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    
    // Update database configuratie
    configContent.database.host = credentials.host;
    configContent.database.port = credentials.port;
    configContent.database.name = credentials.database;
    configContent.database.user = credentials.newUser;
    configContent.database.password = credentials.newPassword;
    
    // Schrijf het bijgewerkte config bestand
    fs.writeFileSync(configPath, JSON.stringify(configContent, null, 2));
    console.log(`✅ Config.json bijgewerkt\n`);
    
    console.log('\n✅ Database setup succesvol voltooid!\n');
    console.log(`Je kunt nu verbinding maken met de database:`);
    console.log(`  Host: ${credentials.host}`);
    console.log(`  Poort: ${credentials.port}`);
    console.log(`  Database: ${credentials.database}`);
    console.log(`  Gebruiker: ${credentials.newUser}`);
    console.log(`  Wachtwoord: ${credentials.newPassword}`);
    
    console.log('\nJe kunt de server nu starten met: npm start\n');
    
    // Sluit de verbinding
    await rootPool.end();
    process.exit(0);
  } catch (error) {
    console.error(`\n❌ Fout bij het instellen van de database: ${error.message}`);
    process.exit(1);
  }
}

// Start het setup script
setupDatabase();