/**
 * Authentication middleware voor het beveiligen van routes
 */

const jwt = require('jsonwebtoken');
const models = require('../models'); // nu met blocking init helpers

/**
 * Controleer JWT token en zet de gebruiker op req object
 */
exports.authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) {
      return res.status(401).json({ success:false, message:'Geen token aanwezig' });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET || 'skaffacity_secret_key_2025');
    } catch (e) {
      return res.status(401).json({ success:false, message:'Ongeldige of verlopen token' });
    }

    // Pure Sequelize modus: models moeten volledig geïnitialiseerd zijn
    if (!models.isInitialized || !models.isInitialized()) {
      return res.status(503).json({ success:false, message:'Server niet gereed (database niet geïnitialiseerd)' });
    }

    const UserModel = models.User;
    const PlayerModel = models.Player;
    if (!UserModel || !PlayerModel) {
      return res.status(503).json({ success:false, message:'Model referenties ontbreken' });
    }

    const user = await UserModel.findByPk(decoded.userId);
    if (!user) return res.status(401).json({ success:false, message:'Gebruiker niet gevonden' });
    const player = await PlayerModel.findByPk(decoded.playerId);
    if (!player) return res.status(409).json({ success:false, message:'Gekoppelde speler ontbreekt' });

    req.user = {
      userId: user.id,
      playerId: player.id,
      username: user.username,
      email: user.email
    };
    return next();
  } catch (error) {
    console.error('[Auth Middleware] Onverwachte fout:', error.message);
    return res.status(500).json({ success:false, message:'Interne serverfout' });
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