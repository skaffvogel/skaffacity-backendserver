/**
 * Authentication middleware voor het beveiligen van routes
 */

const jwt = require('jsonwebtoken');
const { User, Player } = require('../models');

/**
 * Controleer JWT token en zet de gebruiker op req object
 */
exports.authenticateToken = async (req, res, next) => {
    try {
        // Krijg token uit header
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1]; // Format: "Bearer TOKEN"
        
        if (!token) {
            return res.status(401).json({ 
                success: false,
                message: 'Geen token aanwezig'
            });
        }
        
        // Verifieer token
        jwt.verify(token, process.env.JWT_SECRET || 'skaffacity_secret_key_2025', async (err, decoded) => {
            if (err) {
                return res.status(403).json({ 
                    success: false,
                    message: 'Ongeldige of verlopen token'
                });
            }
            
            // Zoek gebruiker en speler
            const user = await User.findByPk(decoded.userId);
            const player = await Player.findByPk(decoded.playerId);
            
            if (!user || !player) {
                return res.status(403).json({
                    success: false,
                    message: 'Gebruiker niet gevonden'
                });
            }
            
            // Zet gebruiker en speler info op request object
            req.user = {
                userId: user.id,
                playerId: player.id,
                username: user.username,
                email: user.email
            };
            
            next();
        });
    } catch (error) {
        console.error('[Auth Middleware] Error:', error);
        return res.status(500).json({ 
            success: false,
            message: 'Interne serverfout'
        });
    }
};

/**
 * Controleer of gebruiker admin is
 */
exports.isAdmin = (req, res, next) => {
    // Voor nu simpel - later kunnen we dit uitbreiden met rol systeem
    if (req.user) {
        next();
    } else {
        return res.status(403).json({
            success: false,
            message: 'Toegang geweigerd'
        });
    }
};

/**
 * Controleer of gebruiker moderator of admin is
 */
exports.isModerator = (req, res, next) => {
    // Voor nu simpel - later kunnen we dit uitbreiden met rol systeem
    if (req.user) {
        next();
    } else {
        return res.status(403).json({
            success: false,
            message: 'Toegang geweigerd'
        });
    }
};