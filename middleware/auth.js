/**
 * Authentication middleware voor het beveiligen van routes
 */

const jwt = require('jsonwebtoken');
// Gebruik lazy model toegang zodat Sequelize modellen kunnen initialiseren nadat de DB klaar is
const models = require('../models');

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

            // Probeer (her)initialisatie van modellen indien nodig
            let UserModel = models.User;
            let PlayerModel = models.Player;
            if (!UserModel || !PlayerModel) {
                if (models.reinitialize) models.reinitialize();
                UserModel = models.User;
                PlayerModel = models.Player;
            }

            if (!UserModel || !PlayerModel) {
                // Geen Sequelize beschikbaar – in plaats van crash: 503 of (optioneel) bypass als BYPASS_PLAYER_AUTH actief
                if (process.env.BYPASS_PLAYER_AUTH === '1' || process.env.BYPASS_PLAYER_AUTH === 'true') {
                    req.user = { userId: decoded.userId, playerId: decoded.playerId, username: decoded.username, fallback: true };
                    return next();
                }
                return res.status(503).json({
                    success: false,
                    message: 'Authenticatie niet beschikbaar (sequelize models ontbreken)'
                });
            }

            try {
                // Memory token ondersteuning zelfs nadat Sequelize geactiveerd is
                if (decoded.mem) {
                    req.user = {
                        userId: decoded.userId,
                        playerId: decoded.playerId,
                        username: decoded.username,
                        memory: true
                    };
                    return next();
                }
                const user = await UserModel.findByPk(decoded.userId);
                const player = await PlayerModel.findByPk(decoded.playerId);
                if (!user || !player) {
                    return res.status(403).json({ success:false, message:'Gebruiker niet gevonden' });
                }
                req.user = {
                    userId: user.id,
                    playerId: player.id,
                    username: user.username,
                    email: user.email
                };
                return next();
            } catch (e2) {
                console.error('[Auth Middleware] DB lookup error:', e2.message);
                return res.status(500).json({ success:false, message:'Interne authenticatie fout' });
            }
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