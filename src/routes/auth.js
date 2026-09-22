// routes/auth.js
// Handles account registration and login.
// Passwords are NEVER stored in plain text - bcrypt hashes them before they touch the database,
// as required by the Part 1 design.
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../db');

const router = express.Router();
const SALT_ROUNDS = 12;

// Basic server-side validation so bad input can't crash the API or corrupt data.
function validateRegisterInput({ fullName, phone, password }) {
  const errors = [];
  if (!fullName || fullName.trim().length < 2) errors.push('fullName must be at least 2 characters');
  if (!phone || !/^\+?[0-9]{9,15}$/.test(phone)) errors.push('phone must be a valid phone number');
  if (!password || password.length < 8) errors.push('password must be at least 8 characters');
  return errors;
}

router.post('/register', async (req, res) => {
  try {
    const { fullName, phone, password } = req.body;
    const errors = validateRegisterInput({ fullName, phone, password });
    if (errors.length) return res.status(400).json({ errors });

    const existing = await pool.query('SELECT user_id FROM users WHERE phone = $1', [phone]);
    if (existing.rows.length) {
      return res.status(409).json({ error: 'A user with that phone number already exists' });
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const result = await pool.query(
      `INSERT INTO users (full_name, phone, password_hash)
       VALUES ($1, $2, $3)
       RETURNING user_id, full_name, phone, language, notifications_enabled`,
      [fullName.trim(), phone, passwordHash]
    );

    const user = result.rows[0];
    const token = jwt.sign({ userId: user.user_id }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    });

    res.status(201).json({ token, user });
  } catch (err) {
    console.error('register error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { phone, password } = req.body;
    if (!phone || !password) {
      return res.status(400).json({ error: 'phone and password are required' });
    }

    const result = await pool.query('SELECT * FROM users WHERE phone = $1', [phone]);
    if (!result.rows.length) {
      return res.status(401).json({ error: 'Invalid phone number or password' });
    }

    const user = result.rows[0];
    const passwordMatches = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatches) {
      return res.status(401).json({ error: 'Invalid phone number or password' });
    }

    const token = jwt.sign({ userId: user.user_id }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    });

    delete user.password_hash;
    res.json({ token, user });
  } catch (err) {
    console.error('login error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
