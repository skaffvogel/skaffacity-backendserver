/**
 * Server entry point
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { v4: uuidv4 } = require('uuid');
const morgan = require('morgan');
const fs = require('fs');
const path = require('path');

// Server configuratie via environment variables
const serverConfig = {
    port: process.env.PORT || 8000,
    host: process.env.HOST || '0.0.0.0',
    apiPrefix: '/api/v1'
};

const db = require('./utils/db');
let models;
try {
    models = require('./utils/database');
} catch (error) {
    console.warn('Database models not found, continuing without models');
    models = {};
}

// Routes importeren
const authRoutes = require('./api/auth.routes');
const playerRoutes = require('./api/player.routes');
const economyRoutes = require('./api/economy.routes');
const inventoryRoutes = require('./api/inventory.routes');
const safeZoneRoutes = require('./api/safezone.routes');
const cosmeticsRoutes = require('./api/cosmetics.routes');
const ovenRoutes = require('./api/oven.routes');

// Middleware importeren
const { authenticateToken } = require('./middleware/auth');

// Express app initialiseren
const app = express();
const PORT = process.env.PORT || serverConfig.port;
const HOST = process.env.HOST || serverConfig.host;

// Logging configureren
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

app.use(`${apiPrefix}/auth`, authRoutes);
app.use(`${apiPrefix}/player`, authenticateToken, playerRoutes);
app.use(`${apiPrefix}/economy`, authenticateToken, economyRoutes);
app.use(`${apiPrefix}/inventory`, authenticateToken, inventoryRoutes);
app.use(`${apiPrefix}/safezone`, authenticateToken, safeZoneRoutes);
app.use(`${apiPrefix}/cosmetics`, authenticateToken, cosmeticsRoutes);
app.use(`${apiPrefix}/oven`, authenticateToken, ovenRoutes);

// Health check endpoint
app.get(`${apiPrefix}/health`, (req, res) => {
  res.status(200).json({
    status: 'UP',
    timestamp: new Date(),
    serverName: 'SkaffaCity Server',
    version: process.env.npm_package_version || '1.0.0'
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(`[Error] RequestID: ${req.requestId} - ${err.stack}`);
  res.status(err.status || 500).json({
    error: {
      message: err.message || 'Er is een onbekende fout opgetreden',
      requestId: req.requestId
    }
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: {
      message: 'Endpoint niet gevonden',
      requestId: req.requestId
    }
  });
});

// Start de server
const startServer = async () => {
  try {
    // Database initialiseren
    const dbConnected = await db.initDatabase();
    
    if (!dbConnected) {
      console.error('Server start afgebroken vanwege database connectiefout');
      process.exit(1);
    }
    
    // Server starten
    app.listen(PORT, HOST, () => {
      console.log(`
╔════════════════════════════════════════════════════════╗
║                                                        ║
║             SkaffaCity Game Server                     ║
║                                                        ║
╠════════════════════════════════════════════════════════╣
║                                                        ║
║  Server draait op http://${HOST}:${PORT}${apiPrefix}        ║
║                                                        ║
║  Omgeving: ${process.env.NODE_ENV || 'development'}                               ║
║  Database: MySQL - ${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 3306}   ║
║                                                        ║
╚════════════════════════════════════════════════════════╝
      `);
    });
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