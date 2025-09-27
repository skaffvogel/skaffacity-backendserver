const jwt = require('jsonwebtoken');

// JWT secret ophalen uit env of config
const JWT_SECRET = process.env.JWT_SECRET || 'change_this_secret_in_production';

// Middleware om JWT te controleren
function authenticateJWT(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) return res.status(401).json({ error: 'Geen token meegegeven' });
  const token = authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Geen token gevonden' });
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Token ongeldig of verlopen' });
    req.user = user;
    next();
  });
}

// Functie om een JWT te genereren
function generateJWT(payload, expiresIn = '2h') {
  return jwt.sign(payload, JWT_SECRET, { expiresIn });
}

module.exports = {
  authenticateJWT,
  generateJWT
};
