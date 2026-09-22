// routes/debug.js
// Read-only helper so you can see what's actually stored in the hosted
// database straight from a browser tab - no separate DB client needed.
// Protected by a simple shared-secret query param so it's not wide open.
const express = require('express');
const pool = require('../db');

const router = express.Router();

router.get('/data', async (req, res) => {
  if (req.query.key !== process.env.DEBUG_KEY) {
    return res.status(403).json({ error: 'Add ?key=YOUR_DEBUG_KEY to the URL' });
  }

  try {
    const users = await pool.query(
      'SELECT user_id, full_name, phone, password_hash, language, created_at FROM users ORDER BY created_at DESC'
    );
    const stokvels = await pool.query('SELECT * FROM stokvels ORDER BY created_at DESC');
    const memberships = await pool.query(
      `SELECT m.membership_id, m.role, u.full_name, s.name AS stokvel_name
       FROM memberships m
       JOIN users u ON u.user_id = m.user_id
       JOIN stokvels s ON s.stokvel_id = m.stokvel_id`
    );
    const contributions = await pool.query('SELECT * FROM contributions ORDER BY created_at DESC');

    res.json({
      users: users.rows,
      stokvels: stokvels.rows,
      memberships: memberships.rows,
      contributions: contributions.rows,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
