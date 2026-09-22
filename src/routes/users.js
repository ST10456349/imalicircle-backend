// routes/users.js
// View and update the logged-in user's own settings (language, notifications, biometric toggle).
const express = require('express');
const pool = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
const ALLOWED_LANGUAGES = ['en', 'zu', 'xh', 'af'];

router.get('/me', requireAuth, async (req, res) => {
  const result = await pool.query(
    `SELECT user_id, full_name, phone, language, notifications_enabled, biometric_enabled
     FROM users WHERE user_id = $1`,
    [req.user.userId]
  );
  if (!result.rows.length) return res.status(404).json({ error: 'User not found' });
  res.json(result.rows[0]);
});

router.put('/me', requireAuth, async (req, res) => {
  const { language, notificationsEnabled, biometricEnabled } = req.body;

  if (language && !ALLOWED_LANGUAGES.includes(language)) {
    return res.status(400).json({ error: `language must be one of ${ALLOWED_LANGUAGES.join(', ')}` });
  }

  const result = await pool.query(
    `UPDATE users SET
       language = COALESCE($1, language),
       notifications_enabled = COALESCE($2, notifications_enabled),
       biometric_enabled = COALESCE($3, biometric_enabled)
     WHERE user_id = $4
     RETURNING user_id, full_name, phone, language, notifications_enabled, biometric_enabled`,
    [language ?? null, notificationsEnabled ?? null, biometricEnabled ?? null, req.user.userId]
  );

  res.json(result.rows[0]);
});

module.exports = router;
