/**
 * Auth controller voor authenticatie en gebruikersbeheer
 */

const User = require('../models/user.mysql');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

// Helper functie voor het genereren van JWT tokens
const generateToken = (user) => {
    return jwt.sign(
        { 
            id: user._id,
            username: user.username,
            role: user.role
        },
        process.env.JWT_SECRET,
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
                status: 'error',
                message: 'Gebruikersnaam, e-mail en wachtwoord zijn vereist'
            });
        }
        
        // Controleer of gebruikersnaam of email al bestaat
        const existingUser = await User.findOne({
            $or: [
                { username },
                { email }
            ]
        });
        
        if (existingUser) {
            return res.status(409).json({
                status: 'error',
                message: 'Gebruikersnaam of e-mail is al in gebruik'
            });
        }
        
        // Maak nieuwe gebruiker aan
        const newUser = new User({
            username,
            email,
            password,
            displayName: displayName || username,
            skaff: 100 // Startbedrag voor nieuwe spelers
        });
        
        await newUser.save();
        
        // Genereer JWT token
        const token = generateToken(newUser);
        
        res.status(201).json({
            status: 'success',
            message: 'Gebruiker succesvol geregistreerd',
            data: {
                user: {
                    id: newUser._id,
                    username: newUser.username,
                    email: newUser.email,
                    displayName: newUser.displayName,
                    skaff: newUser.skaff
                },
                token
            }
        });
    } catch (error) {
        console.error(`[AuthController] register error: ${error.message}`);
        res.status(500).json({
            status: 'error',
            message: 'Er is een serverfout opgetreden'
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
                status: 'error',
                message: 'Gebruikersnaam en wachtwoord zijn vereist'
            });
        }
        
        // Zoek gebruiker op username of email
        const user = await User.findOne({
            $or: [
                { username },
                { email: username }
            ]
        });
        
        if (!user) {
            return res.status(401).json({
                status: 'error',
                message: 'Ongeldige inloggegevens'
            });
        }
        
        // Controleer of account actief is
        if (!user.isActive) {
            return res.status(403).json({
                status: 'error',
                message: 'Dit account is gedeactiveerd'
            });
        }
        
        // Controleer wachtwoord
        const isPasswordValid = await user.comparePassword(password);
        
        if (!isPasswordValid) {
            return res.status(401).json({
                status: 'error',
                message: 'Ongeldige inloggegevens'
            });
        }
        
        // Reset dagelijkse oven spins
        user.resetDailyOvenSpins();
        await user.save();
        
        // Genereer JWT token
        const token = generateToken(user);
        
        res.status(200).json({
            status: 'success',
            message: 'Succesvol ingelogd',
            data: {
                user: {
                    id: user._id,
                    username: user.username,
                    email: user.email,
                    displayName: user.displayName,
                    role: user.role,
                    skaff: user.skaff,
                    ovenSpins: user.ovenSpins
                },
                token
            }
        });
    } catch (error) {
        console.error(`[AuthController] login error: ${error.message}`);
        res.status(500).json({
            status: 'error',
            message: 'Er is een serverfout opgetreden'
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
                status: 'error',
                message: 'Token is vereist'
            });
        }
        
        // Verifieer de bestaande token
        jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
            if (err) {
                return res.status(401).json({
                    status: 'error',
                    message: 'Ongeldige of verlopen token'
                });
            }
            
            // Zoek gebruiker op ID uit token
            const user = await User.findById(decoded.id);
            
            if (!user || !user.isActive) {
                return res.status(401).json({
                    status: 'error',
                    message: 'Gebruiker niet gevonden of inactief'
                });
            }
            
            // Genereer nieuwe token
            const newToken = generateToken(user);
            
            res.status(200).json({
                status: 'success',
                data: {
                    token: newToken
                }
            });
        });
    } catch (error) {
        console.error(`[AuthController] refreshToken error: ${error.message}`);
        res.status(500).json({
            status: 'error',
            message: 'Er is een serverfout opgetreden'
        });
    }
};

/**
 * Krijg gebruikersprofiel
 */
exports.getUserProfile = async (req, res) => {
    try {
        const userId = req.user.id;
        
        const user = await User.findById(userId)
            .select('-password -resetPasswordToken -resetPasswordExpires');
        
        if (!user) {
            return res.status(404).json({
                status: 'error',
                message: 'Gebruiker niet gevonden'
            });
        }
        
        // Reset dagelijkse oven spins
        user.resetDailyOvenSpins();
        await user.save();
        
        res.status(200).json({
            status: 'success',
            data: {
                user: {
                    id: user._id,
                    username: user.username,
                    email: user.email,
                    displayName: user.displayName,
                    avatarUrl: user.avatarUrl,
                    role: user.role,
                    skaff: user.skaff,
                    ovenSpins: user.ovenSpins
                }
            }
        });
    } catch (error) {
        console.error(`[AuthController] getUserProfile error: ${error.message}`);
        res.status(500).json({
            status: 'error',
            message: 'Er is een serverfout opgetreden'
        });
    }
};

/**
 * Update gebruikersprofiel
 */
exports.updateUserProfile = async (req, res) => {
    try {
        const userId = req.user.id;
        const { displayName, currentPassword, newPassword, avatarUrl } = req.body;
        
        const user = await User.findById(userId);
        
        if (!user) {
            return res.status(404).json({
                status: 'error',
                message: 'Gebruiker niet gevonden'
            });
        }
        
        // Update profiel velden als ze zijn opgegeven
        if (displayName) user.displayName = displayName;
        if (avatarUrl) user.avatarUrl = avatarUrl;
        
        // Als er een nieuw wachtwoord is opgegeven, verifieer eerst het huidige wachtwoord
        if (newPassword) {
            if (!currentPassword) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Huidig wachtwoord is vereist om het wachtwoord te wijzigen'
                });
            }
            
            const isPasswordValid = await user.comparePassword(currentPassword);
            
            if (!isPasswordValid) {
                return res.status(401).json({
                    status: 'error',
                    message: 'Huidig wachtwoord is onjuist'
                });
            }
            
            // Wachtwoord komt overeen, update het wachtwoord
            user.password = newPassword;
        }
        
        await user.save();
        
        res.status(200).json({
            status: 'success',
            message: 'Profiel succesvol bijgewerkt',
            data: {
                user: {
                    id: user._id,
                    username: user.username,
                    email: user.email,
                    displayName: user.displayName,
                    avatarUrl: user.avatarUrl
                }
            }
        });
    } catch (error) {
        console.error(`[AuthController] updateUserProfile error: ${error.message}`);
        res.status(500).json({
            status: 'error',
            message: 'Er is een serverfout opgetreden'
        });
    }
};