// routes/sync.js
// Bulk sync endpoint for contributions captured offline in the Android app's local Room database.
// The app batches everything queued while offline and sends it as one array; this endpoint
// responds with a per-record status so the app knows exactly which local rows to mark as synced.
const express = require('express');
const pool = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.post('/contributions', requireAuth, async (req, res) => {
  const { records } = req.body;
  if (!Array.isArray(records) || records.length === 0) {
    return res.status(400).json({ error: 'records must be a non-empty array' });
  }

  const results = [];
  for (const record of records) {
    const { clientRef, stokvelId, membershipId, amount, contributionDate } = record;
    try {
      if (!clientRef || !stokvelId || !membershipId || !amount) {
        results.push({ clientRef, status: 'error', message: 'missing required fields' });
        continue;
      }
      const inserted = await pool.query(
        `INSERT INTO contributions (stokvel_id, membership_id, amount, contribution_date, captured_by, client_ref)
         VALUES ($1, $2, $3, COALESCE($4, CURRENT_DATE), $5, $6)
         ON CONFLICT (client_ref) DO NOTHING
         RETURNING contribution_id`,
        [stokvelId, membershipId, amount, contributionDate ?? null, req.user.userId, clientRef]
      );
      results.push({
        clientRef,
        status: 'synced',
        contributionId: inserted.rows[0]?.contribution_id ?? 'already-synced',
      });
    } catch (err) {
      console.error('sync record error', err);
      results.push({ clientRef, status: 'error', message: 'server error' });
    }
  }

  res.json({ results });
});

module.exports = router;
