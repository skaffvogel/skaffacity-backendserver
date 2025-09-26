/**
 * Server entry point
 */

console.log('╔════════════════════════════════════════════════════════╗');
console.log('║                 SkaffaCity Server                      ║');
console.log('║                    Opstarten...                       ║');
console.log('╚════════════════════════════════════════════════════════╝');

console.log('[MODULE] Core modules laden...');

// Load environment variables first
try {
    require('dotenv').config();
    console.log('[MODULE] ✅ Environment variables loaded');
} catch (error) {
    console.log('[MODULE] ⚠️  dotenv not available, skipping .env file');
}

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { v4: uuidv4 } = require('uuid');
const morgan = require('morgan');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
console.log('[MODULE] Core modules geladen!');

// Command handler voor Pterodactyl console commands
console.log('[MODULE] Command handler laden...');
const commandHandler = require('./commands/handler');
console.log('[MODULE] Command handler geladen!');

// Server configuratie laden via ConfigManager
console.log('[MODULE] Server configuratie laden...');
let config, serverConfig, configManager;

try {
    const ConfigManager = require('./utils/config-manager');
    configManager = new ConfigManager();
    
    // Maak ConfigManager globaal beschikbaar VOOR andere modules
    global.configManager = configManager;
    
    config = configManager.getAllConfigs();
    serverConfig = configManager.getServerConfig();
    
    // Controleer of configuratie geldig is geladen
    if (!config || !serverConfig) {
        throw new Error('Configuration is null or undefined');
    }
    
    console.log('[MODULE] Server configuratie geladen!', {
        port: serverConfig.port,
        httpsPort: serverConfig.httpsPort,
        host: serverConfig.host,
        apiPrefix: serverConfig.apiPrefix,
        enableHTTPS: serverConfig.enableHTTPS,
        sslKeyPath: serverConfig.enableHTTPS ? serverConfig.sslKeyPath : 'N/A',
        sslCertPath: serverConfig.enableHTTPS ? serverConfig.sslCertPath : 'N/A'
    });
    
    // Maak config manager beschikbaar voor commands
    global.configManager = configManager;
    
} catch (error) {
    console.error('[ERROR] ❌ Configuratie laden mislukt:', error.message);
    console.log('[ERROR] 🔧 Probeer fallback configuratie...');
    
    // Fallback configuratie
    serverConfig = {
        port: 8000,
        httpsPort: 8443,
        host: '0.0.0.0',
        apiPrefix: '/api/v1',
        enableHTTPS: false,
        sslKeyPath: path.join(__dirname, '../ssl/private-key.pem'),
        sslCertPath: path.join(__dirname, '../ssl/certificate.pem'),
        jwtSecret: '',
        adminPassword: ''
    };
    
    config = {
        server: serverConfig,
        database: {
            host: '207.180.235.41',
            port: 3306,
            database: 's14_skaffacity',
            username: 'u14_Sz62GJBI8E',
            password: ''
        },
        ssl: {
            keyPath: '../ssl/private-key.pem',
            certPath: '../ssl/certificate.pem',
            keyPassword: '',
            caPath: ''
        },
        gameserver: {
            maxServers: 5,
            autoScale: true,
            pterodactyl: {
                enabled: false,
                apiUrl: '',
                apiKey: '',
                serverId: '',
                adminApiKey: '',
                clientApiKey: ''
            }
        }
    };
    
    // Create a minimal ConfigManager for fallback
    global.configManager = {
        getConfig: (type) => type ? config[type] : config,
        getAllConfigs: () => config,
        getServerConfig: () => serverConfig,
        getDatabaseConfig: () => config.database,
        getSSLConfig: () => config.ssl,
        getGameServerConfig: () => config.gameserver
    };
    
    console.log('[ERROR] ✅ Fallback configuratie geladen');
    console.log('[ERROR] 💡 Fix config.json en herstart voor volledige functionaliteit');
}

// Functie om altijd de huidige configuratie op te halen
function getCurrentServerConfig() {
    if (global.configManager) {
        const currentConfig = global.configManager.getServerConfig();
        if (currentConfig) {
            // Ensure host is valid for server binding
            if (currentConfig.host === '207.180.235.41') {
                console.warn('[CONFIG] ⚠️ Database host found in server config, correcting to 0.0.0.0');
                currentConfig.host = '0.0.0.0';
            }
            return currentConfig;
        }
    }
    // Ensure fallback config has correct host
    if (serverConfig && serverConfig.host === '207.180.235.41') {
        console.warn('[CONFIG] ⚠️ Correcting fallback host from database IP to 0.0.0.0');
        serverConfig.host = '0.0.0.0';
    }
    return serverConfig; // Fallback naar startup config
}

// Maak functie globaal beschikbaar
global.getCurrentServerConfig = getCurrentServerConfig;

// Globale getConfigByType functie voor nieuwe config system
function getConfigByType(type) {
    if (global.configManager && global.configManager.getConfig) {
        return global.configManager.getConfig(type);
    }
    return null;
}
global.getConfigByType = getConfigByType;

// Setup config change listener voor runtime updates
if (global.configManager) {
    global.configManager.on('configChanged', ({ type, config: changedConfig }) => {
        console.log(`\n🔄 [SERVER] ${type} configuration changed, applying runtime changes...`);
        
        // Update runtime variabelen based on config type
        if (type === 'server') {
            // Update global server config reference
            serverConfig = changedConfig;
            console.log('✅ [SERVER] Server config updated:');
            console.log(`   - Host: ${changedConfig.host}`);
            console.log(`   - Port: ${changedConfig.port}`);
            console.log(`   - HTTPS Port: ${changedConfig.httpsPort}`);
            console.log(`   - HTTPS Enabled: ${changedConfig.enableHTTPS}`);
        } else if (type === 'database') {
            console.log('✅ [SERVER] Database config updated:');
            console.log(`   - Host: ${changedConfig.host}`);
            console.log(`   - Port: ${changedConfig.port}`);
        } else if (type === 'ssl') {
            console.log('✅ [SERVER] SSL config updated');
        } else if (type === 'gameserver') {
            console.log('✅ [SERVER] GameServer config updated:');
            console.log(`   - Max Servers: ${changedConfig.maxServers}`);
            console.log(`   - Auto Scale: ${changedConfig.autoScale}`);
        }
        
        console.log('💡 [SERVER] Configuration applied immediately (live reload active)\n');
    });
    
    global.configManager.on('configSaved', ({ type, config: savedConfig }) => {
        console.log(`💾 [SERVER] ${type} configuration saved to config/${type}.json`);
    });
}

console.log('[MODULE] Database connectie laden...');
const db = require('./utils/db');
console.log('[MODULE] Database connectie geladen!');

console.log('[MODULE] Database models laden...');
let models;
try {
    // Test en laad de nieuwe Sequelize models
    const { validateModels } = require('./utils/model-validator');
    
    // Probeer eerst de nieuwe Sequelize models
    models = require('./models');
    console.log('[MODULE] Sequelize models geladen!');
    
    // Valideer de models (maar start de server ook als validatie faalt)
    validateModels().then(isValid => {
        if (isValid) {
            console.log('[MODULE] ✅ Model validatie succesvol!');
        } else {
            console.warn('[MODULE] ⚠️ Model validatie gefaald, maar server start wel');
        }
    }).catch(error => {
        console.error('[VALIDATOR] ❌ Validation failed:', error.message);
        if (error.stack) {
            console.error('[VALIDATOR] Stack:', error.stack);
        }
        console.warn('[MODULE] ⚠️ Model validatie gefaald, maar server start wel');
    });
    
} catch (error) {
    console.warn('[MODULE] Database models fout:', error.message);
    console.warn('[MODULE] Server start zonder Sequelize models');
    models = {};
}

// Routes importeren
console.log('[MODULE] Auth routes laden...');
const authRoutes = require('./api/auth.routes');
console.log('[MODULE] Auth routes geladen!');

console.log('[MODULE] Player routes laden...');
const playerRoutes = require('./api/player.routes');
console.log('[MODULE] Player routes geladen!');

console.log('[MODULE] Economy routes laden...');
const economyRoutes = require('./api/economy.routes');
console.log('[MODULE] Economy routes geladen!');

console.log('[MODULE] Inventory routes laden...');
const inventoryRoutes = require('./api/inventory.routes');
console.log('[MODULE] Inventory routes geladen!');

console.log('[MODULE] SafeZone routes laden...');
const safeZoneRoutes = require('./api/safezone.routes');
console.log('[MODULE] SafeZone routes geladen!');

console.log('[MODULE] Cosmetics routes laden...');
const cosmeticsRoutes = require('./api/cosmetics.routes');
console.log('[MODULE] Cosmetics routes geladen!');

console.log('[MODULE] Oven routes laden...');
const ovenRoutes = require('./api/oven.routes');
console.log('[MODULE] Oven routes geladen!');

// Middleware importeren
console.log('[MODULE] Auth middleware laden...');
const { authenticateToken } = require('./middleware/auth');
console.log('[MODULE] Auth middleware geladen!');

// Express app initialiseren
console.log('[MODULE] Express app initialiseren...');
const app = express();
// Enable trust proxy so Nginx forwarded headers are honored (rate limiting, IP, HTTPS scheme)
app.set('trust proxy', 1);
console.log('[MODULE] Express app geïnitialiseerd!');

// Logging configureren
console.log('[MODULE] Logging configureren...');
const logDirectory = path.join(__dirname, './logs');
fs.existsSync(logDirectory) || fs.mkdirSync(logDirectory);
const accessLogStream = fs.createWriteStream(
  path.join(logDirectory, 'access.log'), 
  { flags: 'a' }
);

// Middleware
// Refined CORS: allow specific origins (env override or default allowlist)
const allowedOrigins = (process.env.CORS_ORIGINS || 'https://api.lvlagency.nl,https://lvlagency.nl,http://localhost:3000').split(',').map(o => o.trim());
app.use(cors({
  origin: function(origin, callback) {
    if (!origin) return callback(null, true); // non-browser / curl
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('CORS origin not allowed: ' + origin));
  },
  credentials: true,
  allowedHeaders: ['Authorization','Content-Type','Accept','X-Requested-With'],
  methods: ['GET','POST','PUT','DELETE','OPTIONS']
}));
app.use(helmet());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('combined', { stream: accessLogStream }));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 900000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  standardHeaders: true,
  legacyHeaders: false
});
app.use(limiter);

// Request logging
app.use((req, res, next) => {
  req.requestId = uuidv4();
  const realIp = req.headers['x-forwarded-for'] ? req.headers['x-forwarded-for'].split(',')[0].trim() : req.ip;
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} - RequestID: ${req.requestId} - IP: ${realIp}`);
  next();
});

// API routes
const apiPrefix = serverConfig.apiPrefix;
console.log('[MODULE] API routes registreren...');

console.log('[MODULE] Auth endpoints registreren op', `${apiPrefix}/auth`);
app.use(`${apiPrefix}/auth`, authRoutes);

console.log('[MODULE] Player endpoints registreren op', `${apiPrefix}/players`);
app.use(`${apiPrefix}/players`, authenticateToken, playerRoutes);

console.log('[MODULE] Economy endpoints registreren op', `${apiPrefix}/economy`);
app.use(`${apiPrefix}/economy`, authenticateToken, economyRoutes);

console.log('[MODULE] Inventory endpoints registreren op', `${apiPrefix}/inventory`);
app.use(`${apiPrefix}/inventory`, authenticateToken, inventoryRoutes);

console.log('[MODULE] SafeZone endpoints registreren op', `${apiPrefix}/safezone`);
app.use(`${apiPrefix}/safezone`, authenticateToken, safeZoneRoutes);

console.log('[MODULE] Cosmetics endpoints registreren op', `${apiPrefix}/cosmetics`);
app.use(`${apiPrefix}/cosmetics`, authenticateToken, cosmeticsRoutes);

console.log('[MODULE] Oven endpoints registreren op', `${apiPrefix}/oven`);
app.use(`${apiPrefix}/oven`, authenticateToken, ovenRoutes);

// Nieuwe game features
console.log('[MODULE] Mining routes laden...');
const miningRoutes = require('./api/mining.routes');
console.log('[MODULE] Mining routes geladen!');

console.log('[MODULE] Shop routes laden...');
const shopRoutes = require('./api/shop.routes');
console.log('[MODULE] Shop routes geladen!');

console.log('[MODULE] Faction routes laden...');
const factionRoutes = require('./api/faction.routes');
console.log('[MODULE] Faction routes geladen!');

console.log('[MODULE] Faction Wars routes laden...');
const factionWarsRoutes = require('./api/faction-wars.routes');
console.log('[MODULE] Faction Wars routes geladen!');

console.log('[MODULE] Mining endpoints registreren op', `${apiPrefix}/mining`);
app.use(`${apiPrefix}/mining`, miningRoutes);

console.log('[MODULE] Shop endpoints registreren op', `${apiPrefix}/shop`);
app.use(`${apiPrefix}/shop`, shopRoutes);

console.log('[MODULE] Faction endpoints registreren op', `${apiPrefix}/factions`);
app.use(`${apiPrefix}/factions`, factionRoutes);

console.log('[MODULE] Faction Wars endpoints registreren op', `${apiPrefix}/faction-wars`);
app.use(`${apiPrefix}/faction-wars`, factionWarsRoutes);

// Game Server Management routes (optioneel - alleen laden als modules beschikbaar zijn)
console.log('[MODULE] Game Server routes laden...');
let gameServerRoutes;
try {
    gameServerRoutes = require('./api/gameserver.routes');
    console.log('[MODULE] Game Server routes geladen!');
} catch (error) {
    console.warn('[MODULE] ⚠️ Game Server routes niet beschikbaar:', error.message);
    console.warn('[MODULE] Installeer dependencies met: npm install');
    gameServerRoutes = null;
}

if (gameServerRoutes) {
    console.log('[MODULE] Game Server endpoints registreren op', `${apiPrefix}/gameservers`);
    app.use(`${apiPrefix}/gameservers`, authenticateToken, gameServerRoutes);
} else {
    console.warn('[MODULE] ⚠️ Game Server endpoints overgeslagen (dependencies ontbreken)');
}

// Configuration API routes
console.log('[MODULE] Config routes laden...');
const configRoutes = require('./api/config.routes');
console.log('[MODULE] Config routes geladen!');
console.log('[MODULE] Config endpoints registreren op', `${apiPrefix}/config`);
app.use(`${apiPrefix}/config`, configRoutes);

// Public Server Discovery API routes (voor Unity server discovery)
console.log('[MODULE] Public server discovery routes laden...');
let publicServerRoutes;
try {
    publicServerRoutes = require('./api/servers.routes');
    console.log('[MODULE] Public server discovery routes geladen!');
    console.log('[MODULE] Public server endpoints registreren op', `${apiPrefix}/servers`);
    app.use(`${apiPrefix}/servers`, publicServerRoutes);
} catch (error) {
    console.warn('[MODULE] ⚠️ Public server discovery routes niet beschikbaar:', error.message);
}

// Internal Server API routes (voor game server communicatie)
console.log('[MODULE] Internal server routes laden...');
let internalServerRoutes;
try {
    internalServerRoutes = require('./api/internal/servers.routes');
    console.log('[MODULE] Internal server routes geladen!');
    console.log('[MODULE] Internal server endpoints registreren op', `${apiPrefix}/internal/servers`);
    app.use(`${apiPrefix}/internal/servers`, internalServerRoutes);
} catch (error) {
    console.warn('[MODULE] ⚠️ Internal server routes niet beschikbaar:', error.message);
}

console.log('[MODULE] Alle API routes geregistreerd!');

// Health check endpoint
console.log('[MODULE] Health check endpoint configureren...');
app.get(`${apiPrefix}/health`, (req, res) => {
  res.status(200).json({
    status: 'UP',
    timestamp: new Date(),
    serverName: 'SkaffaCity Server',
    version: process.env.npm_package_version || '1.0.0'
  });
});
console.log('[MODULE] Health check endpoint geconfigureerd op', `${apiPrefix}/health`);

// Error handling middleware
console.log('[MODULE] Error handling middleware configureren...');
app.use((err, req, res, next) => {
  console.error(`[Error] RequestID: ${req.requestId} - ${err.stack}`);
  res.status(err.status || 500).json({
    error: {
      message: err.message || 'Er is een onbekende fout opgetreden',
      requestId: req.requestId
    }
  });
});
console.log('[MODULE] Error handling middleware geconfigureerd!');

// 404 handler
console.log('[MODULE] 404 handler configureren...');
app.use((req, res) => {
  res.status(404).json({
    error: {
      message: 'Endpoint niet gevonden',
      requestId: req.requestId
    }
  });
});
console.log('[MODULE] 404 handler geconfigureerd!');

// Start de server
const startServer = async () => {
  try {
    console.log('[MODULE] Server startup proces starten...');
    
    // Database initialiseren (optioneel)
    console.log('[MODULE] Database initialisatie starten...');
    try {
      const dbConnected = await db.initDatabase();
      if (dbConnected) {
        console.log('[MODULE] ✅ Database initialisatie voltooid!');
        global.databaseAvailable = true;
      } else {
        console.warn('[MODULE] ⚠️  Database niet beschikbaar, server start zonder database functionaliteit');
        global.databaseAvailable = false;
      }
    } catch (error) {
      console.warn('[MODULE] ⚠️  Database connectie mislukt:', error.message);
      console.warn('[MODULE] ⚠️  Server start zonder database functionaliteit');
      global.databaseAvailable = false;
    }
    
    // Server starten
    
    // Gebruik altijd de huidige configuratie
    const currentServerConfig = getCurrentServerConfig();
    
    if (currentServerConfig.enableHTTPS) {
      console.log('[MODULE] HTTPS server starten...');
      
      // Controleer of SSL certificaten bestaan
      if (!fs.existsSync(currentServerConfig.sslKeyPath) || !fs.existsSync(currentServerConfig.sslCertPath)) {
        console.error('[MODULE] ❌ SSL certificaten niet gevonden!');
        console.error(`Key: ${currentServerConfig.sslKeyPath}`);
        console.error(`Cert: ${currentServerConfig.sslCertPath}`);
        console.error('Genereer eerst SSL certificaten met: node generate-cert.js');
        process.exit(1);
      }
      
      // Laad SSL certificaten
      const sslOptions = {
        key: fs.readFileSync(currentServerConfig.sslKeyPath),
        cert: fs.readFileSync(currentServerConfig.sslCertPath)
      };
      
      // Start HTTPS server
      const httpsServer = https.createServer(sslOptions, app);
      httpsServer.listen(currentServerConfig.httpsPort, currentServerConfig.host, () => {
        console.log('[MODULE] ✅ HTTPS server gestart!');
      });
      
      // Start ook HTTP server voor redirects
      const httpApp = express();
      httpApp.use((req, res) => {
        res.redirect(`https://${req.headers.host.split(':')[0]}:${currentServerConfig.httpsPort}${req.url}`);
      });
      
      const httpServer = http.createServer(httpApp);
      httpServer.listen(currentServerConfig.port, currentServerConfig.host, () => {
        console.log('[MODULE] ✅ HTTP redirect server gestart!');
        console.log(`
╔════════════════════════════════════════════════════════╗
║                                                        ║
║             SkaffaCity Game Server                     ║
║                    � HTTPS SECURE! 🔐                 ║
║                                                        ║
╠════════════════════════════════════════════════════════╣
║                                                        ║
║  HTTPS: https://${currentServerConfig.host}:${currentServerConfig.httpsPort}${currentServerConfig.apiPrefix}             ║
║  Health: https://${currentServerConfig.host}:${currentServerConfig.httpsPort}${currentServerConfig.apiPrefix}/health      ║
║  HTTP Redirect: http://${currentServerConfig.host}:${currentServerConfig.port} → HTTPS         ║
║                                                        ║
║  Omgeving: ${process.env.NODE_ENV || 'development'}                               ║
║  Database: MySQL - ${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 3306}   ║
║                                                        ║
║  🔐 SSL Certificaten geladen!                         ║
║  🎮 Alle modules succesvol geladen!                   ║
║                                                        ║
╚════════════════════════════════════════════════════════╝
        `);
      });
    } else {
      console.log('[MODULE] HTTP server starten...');
      app.listen(currentServerConfig.port, currentServerConfig.host, () => {
        console.log('[MODULE] ✅ HTTP server gestart!');
        console.log(`
╔════════════════════════════════════════════════════════╗
║                                                        ║
║             SkaffaCity Game Server                     ║
║                    �🚀 ONLINE! 🚀                       ║
║                                                        ║
╠════════════════════════════════════════════════════════╣
║                                                        ║
║  Server: http://${currentServerConfig.host}:${currentServerConfig.port}${currentServerConfig.apiPrefix}                      ║
║  Health: http://${currentServerConfig.host}:${currentServerConfig.port}${currentServerConfig.apiPrefix}/health             ║
║                                                        ║
║  Omgeving: ${process.env.NODE_ENV || 'development'}                               ║
║  Database: MySQL - ${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 3306}   ║
║                                                        ║
║  ⚠️  HTTP modus - voor development only!               ║
║  🎮 Alle modules succesvol geladen!                   ║
║                                                        ║
╚════════════════════════════════════════════════════════╝
        `);
      });
    }
  } catch (error) {
    console.error(`Server start mislukt: ${error.message}`);
    process.exit(1);
  }
};

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM ontvangen, server afsluiten...');
  await db.closeDatabase();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT ontvangen, server afsluiten...');
  await db.closeDatabase();
  process.exit(0);
});

// Start de server
startServer();