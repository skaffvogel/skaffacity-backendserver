/**
 * Economy controller voor SKAFF transacties en beheer
 */

const User = require('../models/user.mysql');
const Transaction = require('../models/transaction.mysql');
const db = require('./utils/db');

/**
 * Krijg SKAFF balans van gebruiker
 */
exports.getBalance = async (req, res) => {
    try {
        const userId = req.user.id;
        
        const user = await User.findById(userId).select('username skaff');
        
        if (!user) {
            return res.status(404).json({
                status: 'error',
                message: 'Gebruiker niet gevonden'
            });
        }
        
        res.status(200).json({
            status: 'success',
            data: {
                username: user.username,
                skaff: user.skaff
            }
        });
    } catch (error) {
        console.error(`[EconomyController] getBalance error: ${error.message}`);
        res.status(500).json({ 
            status: 'error', 
            message: 'Er is een serverfout opgetreden' 
        });
    }
};

/**
 * Transfer SKAFF tussen gebruikers
 */
exports.transferSkaff = async (req, res) => {
    try {
        const { toUsername, amount, description } = req.body;
        const fromUserId = req.user.id;
        
        // Valideer input
        if (!toUsername || !amount) {
            return res.status(400).json({
                status: 'error',
                message: 'Gebruikersnaam en bedrag zijn vereist'
            });
        }
        
        if (amount <= 0) {
            return res.status(400).json({
                status: 'error',
                message: 'Bedrag moet groter zijn dan 0'
            });
        }
        
        // Begin transactie sessie
        const connection = await db.getConnection();
        await connection.beginTransaction();
        
        try {
            // Haal gebruikers op
            const fromUser = await User.findById(fromUserId, connection);
            const toUser = await User.findByUsername(toUsername, connection);
            
            if (!fromUser || !toUser) {
                await connection.rollback();
                connection.release();
                
                return res.status(404).json({
                    status: 'error',
                    message: 'Gebruiker niet gevonden'
                });
            }
            
            if (fromUser.id === toUser.id) {
                await connection.rollback();
                connection.release();
                
                return res.status(400).json({
                    status: 'error',
                    message: 'Je kunt geen SKAFF naar jezelf sturen'
                });
            }
            
            // Controleer of zender genoeg SKAFF heeft
            if (fromUser.skaff < amount) {
                await connection.rollback();
                connection.release();
                
                return res.status(400).json({
                    status: 'error',
                    message: 'Niet genoeg SKAFF om deze transactie uit te voeren'
                });
            }
            
            // Transfer SKAFF
            fromUser.skaff -= amount;
            toUser.skaff += amount;
            
            await fromUser.save(connection);
            await toUser.save(connection);
            
            // Log transactie
            const transaction = new Transaction({
                type: 'transfer',
                amount,
                fromUserId: fromUser.id,
                toUserId: toUser.id,
                description: description || 'Speler transfer'
            });
            
            await transaction.save(connection);
            
            // Commit transactie
            await connection.commit();
            connection.release();
            
            res.status(200).json({
                status: 'success',
                message: 'SKAFF succesvol overgemaakt',
                data: {
                    fromUser: fromUser.username,
                    toUser: toUser.username,
                    amount,
                    newBalance: fromUser.skaff
                }
            });
        } catch (error) {
            // Als er een fout optreedt, rollback de transactie
            await session.abortTransaction();
            session.endSession();
            
            throw error;
        }
    } catch (error) {
        console.error(`[EconomyController] transferSkaff error: ${error.message}`);
        res.status(500).json({ 
            status: 'error', 
            message: 'Er is een serverfout opgetreden' 
        });
    }
};

/**
 * Beloon een gebruiker met SKAFF (admin only)
 */
exports.rewardSkaff = async (req, res) => {
    try {
        // Admin check
        if (req.user.role !== 'admin' && req.user.role !== 'moderator') {
            return res.status(403).json({
                status: 'error',
                message: 'Geen toestemming voor deze actie'
            });
        }
        
        const { username, amount, description } = req.body;
        const adminId = req.user.id;
        
        // Valideer input
        if (!username || !amount) {
            return res.status(400).json({
                status: 'error',
                message: 'Gebruikersnaam en bedrag zijn vereist'
            });
        }
        
        if (amount <= 0) {
            return res.status(400).json({
                status: 'error',
                message: 'Bedrag moet groter zijn dan 0'
            });
        }
        
        // Begin transactie sessie
        const session = await mongoose.startSession();
        session.startTransaction();
        
        try {
            // Haal gebruiker op
            const user = await User.findOne({ username }).session(session);
            
            if (!user) {
                await session.abortTransaction();
                session.endSession();
                
                return res.status(404).json({
                    status: 'error',
                    message: 'Gebruiker niet gevonden'
                });
            }
            
            // Geef SKAFF
            user.skaff += amount;
            await user.save({ session });
            
            // Log transactie
            const transaction = new Transaction({
                type: 'reward',
                amount,
                toUserId: user._id,
                description: description || 'Admin beloning',
                processedByAdmin: true,
                adminId
            });
            
            await transaction.save({ session });
            
            // Commit transactie
            await session.commitTransaction();
            session.endSession();
            
            res.status(200).json({
                status: 'success',
                message: 'SKAFF succesvol toegekend',
                data: {
                    username: user.username,
                    amount,
                    newBalance: user.skaff
                }
            });
        } catch (error) {
            // Als er een fout optreedt, rollback de transactie
            await session.abortTransaction();
            session.endSession();
            
            throw error;
        }
    } catch (error) {
        console.error(`[EconomyController] rewardSkaff error: ${error.message}`);
        res.status(500).json({ 
            status: 'error', 
            message: 'Er is een serverfout opgetreden' 
        });
    }
};

/**
 * Ontneem SKAFF van een gebruiker (admin only)
 */
exports.penaltySkaff = async (req, res) => {
    try {
        // Admin check
        if (req.user.role !== 'admin' && req.user.role !== 'moderator') {
            return res.status(403).json({
                status: 'error',
                message: 'Geen toestemming voor deze actie'
            });
        }
        
        const { username, amount, description } = req.body;
        const adminId = req.user.id;
        
        // Valideer input
        if (!username || !amount) {
            return res.status(400).json({
                status: 'error',
                message: 'Gebruikersnaam en bedrag zijn vereist'
            });
        }
        
        if (amount <= 0) {
            return res.status(400).json({
                status: 'error',
                message: 'Bedrag moet groter zijn dan 0'
            });
        }
        
        // Begin transactie sessie
        const session = await mongoose.startSession();
        session.startTransaction();
        
        try {
            // Haal gebruiker op
            const user = await User.findOne({ username }).session(session);
            
            if (!user) {
                await session.abortTransaction();
                session.endSession();
                
                return res.status(404).json({
                    status: 'error',
                    message: 'Gebruiker niet gevonden'
                });
            }
            
            // Verwijder SKAFF, maar niet onder 0
            const actualDeduction = Math.min(user.skaff, amount);
            user.skaff -= actualDeduction;
            
            await user.save({ session });
            
            // Log transactie
            const transaction = new Transaction({
                type: 'penalty',
                amount: actualDeduction,
                toUserId: user._id,
                description: description || 'Admin straf',
                processedByAdmin: true,
                adminId
            });
            
            await transaction.save({ session });
            
            // Commit transactie
            await session.commitTransaction();
            session.endSession();
            
            res.status(200).json({
                status: 'success',
                message: 'SKAFF succesvol afgenomen',
                data: {
                    username: user.username,
                    amountDeducted: actualDeduction,
                    newBalance: user.skaff
                }
            });
        } catch (error) {
            // Als er een fout optreedt, rollback de transactie
            await session.abortTransaction();
            session.endSession();
            
            throw error;
        }
    } catch (error) {
        console.error(`[EconomyController] penaltySkaff error: ${error.message}`);
        res.status(500).json({ 
            status: 'error', 
            message: 'Er is een serverfout opgetreden' 
        });
    }
};

/**
 * Krijg transactiegeschiedenis van gebruiker
 */
exports.getTransactions = async (req, res) => {
    try {
        const userId = req.user.id;
        const { limit = 10, page = 1 } = req.query;
        
        // Valideer paginatie params
        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        
        if (isNaN(pageNum) || isNaN(limitNum) || pageNum < 1 || limitNum < 1) {
            return res.status(400).json({
                status: 'error',
                message: 'Ongeldige paginatie parameters'
            });
        }
        
        // Haal transacties op
        const skip = (pageNum - 1) * limitNum;
        const transactions = await Transaction.find({
            $or: [
                { fromUserId: userId },
                { toUserId: userId }
            ]
        })
        .populate('fromUserId', 'username')
        .populate('toUserId', 'username')
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limitNum);
        
        // Krijg ook het totaal aantal transacties voor paginatie
        const total = await Transaction.countDocuments({
            $or: [
                { fromUserId: userId },
                { toUserId: userId }
            ]
        });
        
        // Formatteer de transacties voor de client
        const formattedTransactions = transactions.map(t => ({
            id: t._id,
            type: t.type,
            amount: t.amount,
            from: t.fromUserId ? t.fromUserId.username : 'System',
            to: t.toUserId ? t.toUserId.username : 'System',
            description: t.description,
            timestamp: t.timestamp,
            isIncoming: t.toUserId && t.toUserId._id.toString() === userId
        }));
        
        res.status(200).json({
            status: 'success',
            page: pageNum,
            limit: limitNum,
            total,
            pages: Math.ceil(total / limitNum),
            data: formattedTransactions
        });
    } catch (error) {
        console.error(`[EconomyController] getTransactions error: ${error.message}`);
        res.status(500).json({ 
            status: 'error', 
            message: 'Er is een serverfout opgetreden' 
        });
    }
};

/**
 * Krijg alle transacties in het systeem (admin only)
 */
exports.getGlobalTransactions = async (req, res) => {
    try {
        // Admin check
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                status: 'error',
                message: 'Geen toestemming voor deze actie'
            });
        }
        
        const { limit = 50, page = 1, type } = req.query;
        
        // Valideer paginatie params
        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        
        if (isNaN(pageNum) || isNaN(limitNum) || pageNum < 1 || limitNum < 1) {
            return res.status(400).json({
                status: 'error',
                message: 'Ongeldige paginatie parameters'
            });
        }
        
        // Filter op type indien opgegeven
        const filter = {};
        if (type) {
            filter.type = type;
        }
        
        // Haal transacties op
        const skip = (pageNum - 1) * limitNum;
        const transactions = await Transaction.find(filter)
            .populate('fromUserId', 'username')
            .populate('toUserId', 'username')
            .populate('adminId', 'username')
            .sort({ timestamp: -1 })
            .skip(skip)
            .limit(limitNum);
        
        // Krijg ook het totaal aantal transacties voor paginatie
        const total = await Transaction.countDocuments(filter);
        
        // Formatteer de transacties voor de client
        const formattedTransactions = transactions.map(t => ({
            id: t._id,
            type: t.type,
            amount: t.amount,
            from: t.fromUserId ? t.fromUserId.username : 'System',
            to: t.toUserId ? t.toUserId.username : 'System',
            description: t.description,
            timestamp: t.timestamp,
            admin: t.adminId ? t.adminId.username : null
        }));
        
        res.status(200).json({
            status: 'success',
            page: pageNum,
            limit: limitNum,
            total,
            pages: Math.ceil(total / limitNum),
            data: formattedTransactions
        });
    } catch (error) {
        console.error(`[EconomyController] getGlobalTransactions error: ${error.message}`);
        res.status(500).json({ 
            status: 'error', 
            message: 'Er is een serverfout opgetreden' 
        });
    }
};