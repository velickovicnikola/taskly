const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../db');
const auth = require('../middleware/auth');

const router = express.Router();

function createToken(user) {
  return jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' });
}

const MAX_LOGIN_ATTEMPTS = 10;
const LOCK_TIME_MS = 5 * 60 * 1000; // change 5 to 2 for a 2-minute lock
const loginAttempts = new Map();

// Remove expired entries so the map does not keep growing
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of loginAttempts) {
    if (now >= entry.expiresAt) loginAttempts.delete(key);
  }
}, LOCK_TIME_MS).unref();

// Blocks further logins after too many failed attempts for the same IP and email
function limitLoginAttempts(req, res, next) {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const key = `${req.ip}|${email}`;
  const now = Date.now();

  let entry = loginAttempts.get(key);
  if (!entry || now >= entry.expiresAt) {
    entry = { count: 0, expiresAt: now + LOCK_TIME_MS };
    loginAttempts.set(key, entry);
  }

  if (entry.count >= MAX_LOGIN_ATTEMPTS) {
    const minutes = Math.ceil((entry.expiresAt - now) / 60000);
    return res
      .status(429)
      .json({ message: `Too many login attempts. Try again in ${minutes} min.` });
  }

  // Counted before the password check, so parallel requests cannot skip the limit
  entry.count++;
  if (entry.count === MAX_LOGIN_ATTEMPTS) entry.expiresAt = now + LOCK_TIME_MS;

  // A successful login resets the counter
  res.on('finish', () => {
    if (res.statusCode === 200) loginAttempts.delete(key);
  });

  next();
}

// POST /api/auth/register
router.post('/register', async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ message: 'Name, email and password are required' });
  }
  if (password.length < 6) {
    return res.status(400).json({ message: 'Password must be at least 6 characters' });
  }

  try {
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ message: 'Email is already registered' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id, name, email',
      [name, email.toLowerCase(), passwordHash]
    );

    const user = result.rows[0];
    res.status(201).json({ user, token: createToken(user) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/auth/login
router.post('/login', limitLoginAttempts, async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' });
  }

  try {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase()]);
    const user = result.rows[0];

    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    res.json({
      user: { id: user.id, name: user.name, email: user.email },
      token: createToken(user),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/auth/me (protected)
router.get('/me', auth, async (req, res) => {
  try {
    const result = await pool.query('SELECT id, name, email FROM users WHERE id = $1', [req.userId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json({ user: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;