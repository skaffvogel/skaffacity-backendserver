/**
 * Authentication middleware voor het beveiligen van routes
 */

const jwt = require('jsonwebtoken');
const User = require('./models/user.mysql');

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
                status: 'error',
                message: 'Geen token aanwezig'
            });
        }
        
        // Verifieer token
        jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
            if (err) {
                return res.status(403).json({ 
                    status: 'error',
                    message: 'Ongeldige of verlopen token'
                });
            }
            
            // Zoek gebruiker en controleer of actief
            const user = await User.findById(decoded.id);
            if (!user || !user.isActive) {
                return res.status(403).json({
                    status: 'error',
                    message: 'Gebruiker niet gevonden of inactief'
                });
            }
            
            // Zet gebruiker op request object
            req.user = {
                id: user._id,
                username: user.username,
                email: user.email,
                role: user.role
            };
            
            next();
        });
    } catch (error) {
        console.error(`[Auth Middleware] Error: ${error.message}`);
        return res.status(500).json({ 
            status: 'error',
            message: 'Er is een serverfout opgetreden'
        });
    }
};

/**
 * Controleer of gebruiker admin is
 */
exports.isAdmin = (req, res, next) => {
    if (req.user && req.user.role === 'admin') {
        next();
    } else {
        return res.status(403).json({
            status: 'error',
            message: 'Toegang geweigerd. Admin rechten vereist.'
        });
    }
};

/**
 * Controleer of gebruiker moderator of admin is
 */
exports.isModerator = (req, res, next) => {
    if (req.user && (req.user.role === 'admin' || req.user.role === 'moderator')) {
        next();
    } else {
        return res.status(403).json({
            status: 'error',
            message: 'Toegang geweigerd. Moderator rechten vereist.'
        });
    }
};