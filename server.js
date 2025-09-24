/**
 * Server entry point
 */

console.log('╔════════════════════════════════════════════════════════╗');
console.log('║                 SkaffaCity Server                      ║');
console.log('║                    Opstarten...                       ║');
console.log('╚════════════════════════════════════════════════════════╝');

console.log('[MODULE] Core modules laden...');
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

// Server configuratie via environment variables
console.log('[MODULE] Server configuratie laden...');
const serverConfig = {
    port: process.env.PORT || 8000,
    httpsPort: process.env.HTTPS_PORT || 8443,
    host: process.env.HOST || '0.0.0.0',
    apiPrefix: '/api/v1',
    enableHTTPS: process.env.ENABLE_HTTPS === 'true' || false,
    sslKeyPath: process.env.SSL_KEY_PATH || path.join(__dirname, '../ssl/private-key.pem'),
    sslCertPath: process.env.SSL_CERT_PATH || path.join(__dirname, '../ssl/certificate.pem')
};
console.log('[MODULE] Server configuratie geladen!', {
    ...serverConfig,
    sslKeyPath: serverConfig.enableHTTPS ? serverConfig.sslKeyPath : 'N/A',
    sslCertPath: serverConfig.enableHTTPS ? serverConfig.sslCertPath : 'N/A'
});

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
        console.warn('[MODULE] ⚠️ Model validatie error:', error.message);
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
const PORT = process.env.PORT || serverConfig.port;
const HOST = process.env.HOST || serverConfig.host;
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
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
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
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} - RequestID: ${req.requestId}`);
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

// Game Server Management routes
console.log('[MODULE] Game Server routes laden...');
const gameServerRoutes = require('./api/gameserver.routes');
console.log('[MODULE] Game Server routes geladen!');

console.log('[MODULE] Game Server endpoints registreren op', `${apiPrefix}/gameservers`);
app.use(`${apiPrefix}/gameservers`, authenticateToken, gameServerRoutes);

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
    
    // Database initialiseren
    console.log('[MODULE] Database initialisatie starten...');
    const dbConnected = await db.initDatabase();
    
    if (!dbConnected) {
      console.error('[MODULE] ❌ Database initialisatie mislukt!');
      console.error('Server start afgebroken vanwege database connectiefout');
      process.exit(1);
    }
    console.log('[MODULE] ✅ Database initialisatie voltooid!');
    
    // Server starten
    const PORT = serverConfig.port;
    const HTTPS_PORT = serverConfig.httpsPort;
    const HOST = serverConfig.host;
    
    if (serverConfig.enableHTTPS) {
      console.log('[MODULE] HTTPS server starten...');
      
      // Controleer of SSL certificaten bestaan
      if (!fs.existsSync(serverConfig.sslKeyPath) || !fs.existsSync(serverConfig.sslCertPath)) {
        console.error('[MODULE] ❌ SSL certificaten niet gevonden!');
        console.error(`Key: ${serverConfig.sslKeyPath}`);
        console.error(`Cert: ${serverConfig.sslCertPath}`);
        console.error('Genereer eerst SSL certificaten met: node generate-cert.js');
        process.exit(1);
      }
      
      // Laad SSL certificaten
      const sslOptions = {
        key: fs.readFileSync(serverConfig.sslKeyPath),
        cert: fs.readFileSync(serverConfig.sslCertPath)
      };
      
      // Start HTTPS server
      const httpsServer = https.createServer(sslOptions, app);
      httpsServer.listen(HTTPS_PORT, HOST, () => {
        console.log('[MODULE] ✅ HTTPS server gestart!');
      });
      
      // Start ook HTTP server voor redirects
      const httpApp = express();
      httpApp.use((req, res) => {
        res.redirect(`https://${req.headers.host.split(':')[0]}:${HTTPS_PORT}${req.url}`);
      });
      
      const httpServer = http.createServer(httpApp);
      httpServer.listen(PORT, HOST, () => {
        console.log('[MODULE] ✅ HTTP redirect server gestart!');
        console.log(`
╔════════════════════════════════════════════════════════╗
║                                                        ║
║             SkaffaCity Game Server                     ║
║                    � HTTPS SECURE! 🔐                 ║
║                                                        ║
╠════════════════════════════════════════════════════════╣
║                                                        ║
║  HTTPS: https://${HOST}:${HTTPS_PORT}${serverConfig.apiPrefix}             ║
║  Health: https://${HOST}:${HTTPS_PORT}${serverConfig.apiPrefix}/health      ║
║  HTTP Redirect: http://${HOST}:${PORT} → HTTPS         ║
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
      app.listen(PORT, HOST, () => {
        console.log('[MODULE] ✅ HTTP server gestart!');
        console.log(`
╔════════════════════════════════════════════════════════╗
║                                                        ║
║             SkaffaCity Game Server                     ║
║                    �🚀 ONLINE! 🚀                       ║
║                                                        ║
╠════════════════════════════════════════════════════════╣
║                                                        ║
║  Server: http://${HOST}:${PORT}${serverConfig.apiPrefix}                      ║
║  Health: http://${HOST}:${PORT}${serverConfig.apiPrefix}/health             ║
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