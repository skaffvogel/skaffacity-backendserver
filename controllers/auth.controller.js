/**
 * Auth controller voor authenticatie en gebruikersbeheer
 */

const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { Op } = require('sequelize');
const { User, Player } = require('../models');

// Helper functie voor het genereren van JWT tokens
const generateToken = (user, player) => {
    return jwt.sign(
        { 
            userId: user.id,
            playerId: player.id,
            username: user.username
        },
        process.env.JWT_SECRET || 'skaffacity_secret_key_2025',
        { expiresIn: '24h' }
    );
};

/**
 * Registreer een nieuwe gebruiker
 */
exports.register = async (req, res) => {
    try {
        const { username, email, password, displayName } = req.body;
        
        // Valideer input
        if (!username || !email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Gebruikersnaam, e-mail en wachtwoord zijn vereist'
            });
        }
        
        // Controleer of gebruikersnaam of email al bestaat
        const existingUser = await User.findOne({
            where: {
                [Op.or]: [
                    { username },
                    { email }
                ]
            }
        });
        
        if (existingUser) {
            return res.status(409).json({
                success: false,
                message: 'Gebruikersnaam of e-mail is al in gebruik'
            });
        }
        
        // Hash password
        const passwordHash = await bcrypt.hash(password, 10);
        
        // Maak nieuwe gebruiker aan
        const newUser = await User.create({
            username,
            email,
            password_hash: passwordHash,
            created_at: new Date()
        });
        
        // Maak geassocieerde speler aan
        const newPlayer = await Player.create({
            user_id: newUser.id,
            username,
            level: 1,
            xp: 0,
            skaff: 1000, // Startbedrag voor nieuwe spelers
            health: 100,
            max_health: 100,
            faction_id: 0, // Default faction (Naamloos)
            last_seen: new Date()
        });
        
        // Genereer JWT token
        const token = generateToken(newUser, newPlayer);
        
        res.status(201).json({
            success: true,
            message: 'Account succesvol aangemaakt',
            token,
            player: {
                id: newPlayer.id,
                username: newPlayer.username,
                level: newPlayer.level,
                skaff: newPlayer.skaff,
                health: newPlayer.health,
                email: newUser.email
            }
        });
    } catch (error) {
        console.error('[Auth] Registration error:', error);
        res.status(500).json({
            success: false,
            message: 'Interne serverfout tijdens registratie'
        });
    }
};

/**
 * Log in met bestaande gebruiker
 */
exports.login = async (req, res) => {
    try {
        const { username, password } = req.body;
        
        // Valideer input
        if (!username || !password) {
            return res.status(400).json({
                success: false,
                message: 'Gebruikersnaam en wachtwoord zijn vereist'
            });
        }
        
        // Zoek gebruiker op username of email
        const user = await User.findOne({
            where: {
                [Op.or]: [
                    { username },
                    { email: username }
                ]
            }
        });
        
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Ongeldige inloggegevens'
            });
        }
        
        // Controleer wachtwoord
        const isPasswordValid = await bcrypt.compare(password, user.password_hash);
        
        if (!isPasswordValid) {
            return res.status(401).json({
                success: false,
                message: 'Ongeldige inloggegevens'
            });
        }
        
        // Zoek geassocieerde speler
        const player = await Player.findOne({
            where: { user_id: user.id }
        });
        
        if (!player) {
            return res.status(500).json({
                success: false,
                message: 'Spelersprofiel niet gevonden'
            });
        }
        
        // Update laatste bezoek
        await player.update({
            last_seen: new Date()
        });
        
        // Genereer JWT token
        const token = generateToken(user, player);
        
        res.json({
            success: true,
            message: 'Succesvol ingelogd',
            token,
            player: {
                id: player.id,
                username: player.username,
                level: player.level,
                skaff: player.skaff,
                health: player.health,
                email: user.email
            }
        });
    } catch (error) {
        console.error('[Auth] Login error:', error);
        res.status(500).json({
            success: false,
            message: 'Interne serverfout tijdens inloggen'
        });
    }
};

/**
 * Valideer JWT token (voor Unity)
 */
exports.validateToken = async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        
        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'Geen token opgegeven'
            });
        }
        
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'skaffacity_secret_key_2025');
        
        const user = await User.findByPk(decoded.userId);
        const player = await Player.findByPk(decoded.playerId);
        
        if (!user || !player) {
            return res.status(401).json({
                success: false,
                message: 'Ongeldige token'
            });
        }
        
        res.json({
            success: true,
            message: 'Token geldig',
            player: {
                id: player.id,
                username: player.username,
                level: player.level,
                skaff: player.skaff,
                health: player.health,
                email: user.email
            }
        });
        
    } catch (error) {
        console.error('[Auth] Token validation error:', error);
        res.status(401).json({
            success: false,
            message: 'Ongeldige of verlopen token'
        });
    }
};

/**
 * Vernieuw JWT token
 */
exports.refreshToken = async (req, res) => {
    try {
        const { token } = req.body;
        
        if (!token) {
            return res.status(400).json({
                success: false,
                message: 'Token is vereist'
            });
        }
        
        // Verifieer de bestaande token
        jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
            if (err) {
                return res.status(401).json({
                    success: false,
                    message: 'Ongeldige of verlopen token'
                });
            }
            
            // Zoek gebruiker op ID uit token
            const user = await User.findByPk(decoded.userId);
            const player = await Player.findByPk(decoded.playerId);
            
            if (!user || !player) {
                return res.status(401).json({
                    success: false,
                    message: 'Gebruiker niet gevonden'
                });
            }
            
            // Genereer nieuwe token
            const newToken = generateToken(user, player);
            
            res.status(200).json({
                success: true,
                token: newToken
            });
        });
    } catch (error) {
        console.error('[Auth] RefreshToken error:', error);
        res.status(500).json({
            success: false,
            message: 'Interne serverfout'
        });
    }
};

/**
 * Krijg gebruikersprofiel
 */
exports.getUserProfile = async (req, res) => {
    try {
        const userId = req.user.userId;
        
        const user = await User.findByPk(userId);
        const player = await Player.findOne({ where: { user_id: userId } });
        
        if (!user || !player) {
            return res.status(404).json({
                success: false,
                message: 'Gebruiker niet gevonden'
            });
        }
        
        res.status(200).json({
            success: true,
            player: {
                id: player.id,
                username: player.username,
                email: user.email,
                level: player.level,
                xp: player.xp,
                skaff: player.skaff,
                health: player.health,
                max_health: player.max_health,
                faction_id: player.faction_id
            }
        });
    } catch (error) {
        console.error('[Auth] GetUserProfile error:', error);
        res.status(500).json({
            success: false,
            message: 'Interne serverfout'
        });
    }
};

/**
 * Update gebruikersprofiel
 */
exports.updateUserProfile = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { currentPassword, newPassword } = req.body;
        
        const user = await User.findByPk(userId);
        const player = await Player.findOne({ where: { user_id: userId } });
        
        if (!user || !player) {
            return res.status(404).json({
                success: false,
                message: 'Gebruiker niet gevonden'
            });
        }
        
        // Als er een nieuw wachtwoord is opgegeven, verifieer eerst het huidige wachtwoord
        if (newPassword) {
            if (!currentPassword) {
                return res.status(400).json({
                    success: false,
                    message: 'Huidig wachtwoord is vereist om het wachtwoord te wijzigen'
                });
            }
            
            const isPasswordValid = await bcrypt.compare(currentPassword, user.password_hash);
            
            if (!isPasswordValid) {
                return res.status(401).json({
                    success: false,
                    message: 'Huidig wachtwoord is onjuist'
                });
            }
            
            // Hash nieuw wachtwoord
            const newPasswordHash = await bcrypt.hash(newPassword, 10);
            
            // Update wachtwoord
            await user.update({
                password_hash: newPasswordHash
            });
        }
        
        res.status(200).json({
            success: true,
            message: 'Wachtwoord succesvol gewijzigd'
        });
    } catch (error) {
        console.error('[Auth] UpdateUserProfile error:', error);
        res.status(500).json({
            success: false,
            message: 'Interne serverfout'
        });
    }
};