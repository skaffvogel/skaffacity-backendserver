/**
 * Main server file voor de SkaffaCity game backend.
 * Deze server behandelt alle netwerk interacties, speler synchronisatie en game state.
 * 
 * Om te starten op Linux:
 * - Zorg ervoor dat Node.js en MongoDB zijn geïnstalleerd
 * - Voer `npm install` uit om dependencies te installeren
 * - Start met `npm start` of voor productie `pm2 start index.js`
 */

// Imports
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const db = require('./utils/db');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Routes importeren
const authRoutes = require('./api/auth.routes');
const playerRoutes = require('./api/player.routes');
const factionRoutes = require('./api/faction.routes');
const economyRoutes = require('./api/economy.routes');
const inventoryRoutes = require('./api/inventory.routes');
const safeZoneRoutes = require('./api/safezone.routes');
const cosmeticsRoutes = require('./api/cosmetics.routes');
const ovenRoutes = require('./api/oven.routes');

// Load environment variables
dotenv.config();

// App initialisatie
const app = express();
const PORT = process.env.PORT || 8080;

// Middleware voor logging
// Setup log directory
const logDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir);
}

// Create a write stream for access logs
const accessLogStream = fs.createWriteStream(
    path.join(logDir, 'access.log'), 
    { flags: 'a' }
);

// Security middleware
app.use(helmet()); // Security headers
app.use(cors()); // CORS voor Unity client
app.use(compression()); // Response compressie

// Request logging
app.use(morgan('combined', { stream: accessLogStream }));
if (process.env.NODE_ENV !== 'production') {
    app.use(morgan('dev')); // Console logging in development
}

// Rate limiting om DoS te voorkomen
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minuten
    max: 500, // Max 500 requests per IP per window
    message: 'Te veel requests, probeer het later opnieuw'
});
app.use(limiter);

// Body parsing
app.use(express.json({ limit: '10mb' })); // Verhoog limiet indien nodig voor grote payloads
app.use(express.urlencoded({ extended: true }));

// Simple health check route
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'UP',
        timestamp: new Date(),
        uptime: process.uptime()
    });
});

// API routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/players', playerRoutes);
app.use('/api/v1/factions', factionRoutes);
app.use('/api/v1/economy', economyRoutes);
app.use('/api/v1/inventory', inventoryRoutes);
app.use('/api/v1/safezones', safeZoneRoutes);
app.use('/api/v1/cosmetics', cosmeticsRoutes);
app.use('/api/v1/oven', ovenRoutes);

// 404 handler
app.use((req, res) => {
    res.status(404).json({ 
        status: 'error',
        message: 'Endpoint niet gevonden' 
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(`[ERROR] ${err.stack}`);
    
    res.status(err.status || 500).json({
        status: 'error',
        message: process.env.NODE_ENV === 'production' 
            ? 'Er is een serverfout opgetreden'
            : err.message,
        stack: process.env.NODE_ENV === 'production' ? undefined : err.stack
    });
});

// Database connectie
const connectDB = async () => {
    try {
        console.log('Database verbinding initialiseren...');
        
        // Controleer de DEBUG_DB omgevingsvariabele voor extra diagnose
        const debugDb = process.env.DEBUG_DB === '1' || process.env.NODE_ENV === 'development';
        
        if (debugDb) {
            console.log('Database diagnose uitvoeren...');
            await db.diagnoseConnection();
        }
        
        const connected = await db.initDatabase();
        
        if (!connected) {
            console.error('Kan niet verbinden met de database');
            
            // Doe automatisch diagnose als verbinden mislukt
            console.log('Automatische diagnose uitvoeren na verbindingsfout...');
            await db.diagnoseConnection();
            
            if (process.env.NODE_ENV === 'production') {
                console.error('Kan niet verbinden met database in productie mode - server wordt afgesloten');
                process.exit(1);
            }
        }
        
        return connected;
    } catch (error) {
        console.error(`Onverwachte fout bij database verbinding: ${error.message}`);
        if (process.env.NODE_ENV !== 'production') {
            console.error(error.stack);
        }
        
        if (process.env.NODE_ENV === 'production') {
            process.exit(1);
        }
        return false;
    }
};

// Start server
connectDB().then((dbConnected) => {
    // Log database status
    if (dbConnected) {
        console.log('Database verbinding succesvol');
    } else {
        console.warn('Server draait zonder functionele database verbinding!');
    }
    app.listen(PORT, () => {
        console.log(`SkaffaCity server draait op poort ${PORT}`);
        console.log(`Omgeving: ${process.env.NODE_ENV || 'development'}`);
    });
});

// Graceful shutdown voor als het proces wordt beëindigd
const shutdown = async () => {
    console.log('Server wordt afgesloten...');
    try {
        await db.closeDatabase();
        console.log('Database verbinding gesloten');
    } catch (err) {
        console.error('Fout bij sluiten database verbinding:', err);
    }
    process.exit(0);
};

// Luister naar shutdown signalen
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);