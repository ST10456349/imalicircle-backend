// routes/stokvels.js
// Create/list stokvel groups, manage members, capture contributions, and view the payout rotation.
const express = require('express');
const pool = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// POST /stokvels - create a new stokvel; creator becomes the first admin member.
router.post('/', requireAuth, async (req, res) => {
  const { name, contributionAmount, frequency } = req.body;
  if (!name || !contributionAmount || !['weekly', 'fortnightly', 'monthly'].includes(frequency)) {
    return res.status(400).json({ error: 'name, contributionAmount and a valid frequency are required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const stokvel = await client.query(
      `INSERT INTO stokvels (name, contribution_amount, frequency, created_by)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [name.trim(), contributionAmount, frequency, req.user.userId]
    );
    await client.query(
      `INSERT INTO memberships (user_id, stokvel_id, role, payout_order)
       VALUES ($1, $2, 'admin', 1)`,
      [req.user.userId, stokvel.rows[0].stokvel_id]
    );
    await client.query('COMMIT');
    res.status(201).json(stokvel.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('create stokvel error', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

// GET /stokvels - list stokvels the logged-in user belongs to.
router.get('/', requireAuth, async (req, res) => {
  const result = await pool.query(
    `SELECT s.*, m.role FROM stokvels s
     JOIN memberships m ON m.stokvel_id = s.stokvel_id
     WHERE m.user_id = $1
     ORDER BY s.created_at DESC`,
    [req.user.userId]
  );
  res.json(result.rows);
});

// POST /stokvels/:id/members - invite a member by phone number (must already have an account).
router.post('/:id/members', requireAuth, async (req, res) => {
  const { phone, role = 'member' } = req.body;
  if (!phone) return res.status(400).json({ error: 'phone is required' });

  const userResult = await pool.query('SELECT user_id FROM users WHERE phone = $1', [phone]);
  if (!userResult.rows.length) {
    return res.status(404).json({ error: 'No registered user with that phone number' });
  }

  const countResult = await pool.query(
    'SELECT COUNT(*)::int AS count FROM memberships WHERE stokvel_id = $1',
    [req.params.id]
  );

  const result = await pool.query(
    `INSERT INTO memberships (user_id, stokvel_id, role, payout_order)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id, stokvel_id) DO NOTHING
     RETURNING *`,
    [userResult.rows[0].user_id, req.params.id, role, countResult.rows[0].count + 1]
  );
  res.status(201).json(result.rows[0] ?? { message: 'User is already a member' });
});

// GET /stokvels/:id/members - list members of a stokvel.
router.get('/:id/members', requireAuth, async (req, res) => {
  const result = await pool.query(
    `SELECT m.membership_id, m.role, m.payout_order, u.user_id, u.full_name, u.phone
     FROM memberships m JOIN users u ON u.user_id = m.user_id
     WHERE m.stokvel_id = $1 ORDER BY m.payout_order ASC`,
    [req.params.id]
  );
  res.json(result.rows);
});

// POST /stokvels/:id/contributions - capture a single contribution (supports "capture on behalf").
router.post('/:id/contributions', requireAuth, async (req, res) => {
  const { membershipId, amount, contributionDate, clientRef } = req.body;
  if (!membershipId || !amount) {
    return res.status(400).json({ error: 'membershipId and amount are required' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO contributions (stokvel_id, membership_id, amount, contribution_date, captured_by, client_ref)
       VALUES ($1, $2, $3, COALESCE($4, CURRENT_DATE), $5, $6)
       ON CONFLICT (client_ref) DO NOTHING
       RETURNING *`,
      [req.params.id, membershipId, amount, contributionDate ?? null, req.user.userId, clientRef ?? null]
    );
    res.status(201).json(result.rows[0] ?? { message: 'Already synced' });
  } catch (err) {
    console.error('capture contribution error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /stokvels/:id/contributions - list contributions for a stokvel.
router.get('/:id/contributions', requireAuth, async (req, res) => {
  const result = await pool.query(
    `SELECT c.*, u.full_name AS captured_by_name
     FROM contributions c JOIN users u ON u.user_id = c.captured_by
     WHERE c.stokvel_id = $1 ORDER BY c.contribution_date DESC`,
    [req.params.id]
  );
  res.json(result.rows);
});

// GET /stokvels/:id/payouts - the always-visible payout rotation (next-up member based on payout_order).
router.get('/:id/payouts', requireAuth, async (req, res) => {
  const rotation = await pool.query(
    `SELECT m.payout_order, u.user_id, u.full_name
     FROM memberships m JOIN users u ON u.user_id = m.user_id
     WHERE m.stokvel_id = $1 ORDER BY m.payout_order ASC`,
    [req.params.id]
  );
  const history = await pool.query(
    `SELECT * FROM payouts WHERE stokvel_id = $1 ORDER BY payout_date DESC`,
    [req.params.id]
  );
  res.json({ rotation: rotation.rows, history: history.rows });
});

module.exports = router;
