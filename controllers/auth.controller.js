/**
 * Auth controller (PURE SEQUELIZE MODE - Option B)
 * Memory fallback verwijderd. Alle paden vereisen succesvolle database initialisatie.
 */

const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { Op } = require('sequelize');
const models = require('../models');
const { v4: uuidv4 } = require('uuid');

// Helper functie voor het genereren van JWT tokens
const generateToken = (user, player) => jwt.sign({
  userId: user.id,
  playerId: player.id,
  username: user.username
}, process.env.JWT_SECRET || 'skaffacity_secret_key_2025', { expiresIn: '12h' });

/**
 * Registreer een nieuwe gebruiker
 */
exports.register = async (req, res) => {
  try {
    // Safeguard: check models (runtime)
    const User = models.User;
    const Player = models.Player;
    const sequelize = models.sequelize;
    if (!User || !Player) {
      console.error('[Auth][Register] User/Player model niet geïnitialiseerd!');
      return res.status(503).json({ success:false, message:'Server niet gereed (models niet geïnitialiseerd)' });
    }
    const { username, email, password } = req.body;
    if (!username || !email || !password) {
      return res.status(400).json({ success:false, message:'Gebruikersnaam, e-mail en wachtwoord zijn vereist' });
    }
    const existing = await User.findOne({ where:{ [Op.or]: [{ username }, { email }] } });
    if (existing) return res.status(409).json({ success:false, message:'Gebruikersnaam of e-mail al in gebruik' });

    const passwordHash = await bcrypt.hash(password, 10);
    const t = await sequelize.transaction();
    try {
      const user = await User.create({ id: uuidv4(), username, email, password: passwordHash, created_at: new Date() }, { transaction: t });
      const player = await Player.create({
        id: uuidv4(),
        user_id: user.id,
        username,
        faction_id: 0,
        health: 100,
        max_health: 100,
        position_x: 0, position_y: 0, position_z: 0,
        rotation_x: 0, rotation_y: 0, rotation_z: 0,
        created_at: new Date()
      }, { transaction: t });
      await t.commit();
      const token = generateToken(user, player);
      return res.status(201).json({ success:true, message:'Account aangemaakt', token, player:{ id: player.id, username: player.username, health: player.health, max_health: player.max_health, email: user.email } });
    } catch (e) {
      await t.rollback();
      console.error('[Auth][Register] Transactie fout:', e.message);
      return res.status(500).json({ success:false, message:'Registratie mislukt' });
    }
  } catch (error) {
    console.error('[Auth] Registration error:', error.message);
    res.status(500).json({ success:false, message:'Interne serverfout tijdens registratie' });
  }
};

/**
 * Log in met bestaande gebruiker
 */
exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;
    const User = models.User;
    const Player = models.Player;
    if (!User || !Player) {
      console.error('[Auth][Login] User/Player model niet geïnitialiseerd!');
      return res.status(503).json({ success:false, message:'Server niet klaar (models niet geïnitialiseerd)' });
    }
    if (!username || !password) return res.status(400).json({ success:false, message:'Gebruikersnaam en wachtwoord vereist' });
    const user = await User.findOne({ where:{ [Op.or]: [{ username }, { email: username }] } });
    if (!user) return res.status(401).json({ success:false, message:'Ongeldige inloggegevens' });
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ success:false, message:'Ongeldige inloggegevens' });
    const player = await Player.findOne({ where:{ user_id: user.id } });
    if (!player) return res.status(500).json({ success:false, message:'Spelersprofiel ontbreekt' });
    await player.update({ last_seen: new Date() });
    const token = generateToken(user, player);
    return res.json({ success:true, message:'Succesvol ingelogd', token, player:{ id: player.id, username: player.username, health: player.health, max_health: player.max_health, email: user.email } });
  } catch (error) {
    console.error('[Auth] Login error:', error.message);
    res.status(500).json({ success:false, message:'Interne serverfout tijdens inloggen' });
  }
};

/**
 * Valideer JWT token (voor Unity)
 */
exports.validateToken = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ success:false, message:'Geen token opgegeven' });
    let decoded;
    try { decoded = jwt.verify(token, process.env.JWT_SECRET || 'skaffacity_secret_key_2025'); } catch { return res.status(401).json({ success:false, message:'Ongeldige of verlopen token' }); }
    const user = await User.findByPk(decoded.userId);
    const player = await Player.findByPk(decoded.playerId);
    if (!user || !player) return res.status(401).json({ success:false, message:'Ongeldige token' });
    return res.json({ success:true, message:'Token geldig', player:{ id: player.id, username: player.username, health: player.health, max_health: player.max_health, email: user.email } });
  } catch (error) {
    console.error('[Auth] Token validation error:', error.message);
    res.status(401).json({ success:false, message:'Ongeldige of verlopen token' });
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
    const User = models.User;
    const Player = models.Player;
    const userId = req.user.userId;
    const user = await User.findByPk(userId);
    const player = await Player.findOne({ where:{ user_id: userId } });
    if (!user || !player) return res.status(404).json({ success:false, message:'Gebruiker niet gevonden' });
    return res.status(200).json({ success:true, player:{ id: player.id, username: player.username, email: user.email, health: player.health, max_health: player.max_health, faction_id: player.faction_id } });
  } catch (error) {
    console.error('[Auth] GetUserProfile error:', error.message);
    res.status(500).json({ success:false, message:'Interne serverfout' });
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
            
        const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
            
            if (!isPasswordValid) {
                return res.status(401).json({
                    success: false,
                    message: 'Huidig wachtwoord is onjuist'
                });
            }
            
            // Hash nieuw wachtwoord
            const newPasswordHash = await bcrypt.hash(newPassword, 10);
            
            // Update wachtwoord
            await user.update({ password: newPasswordHash });
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