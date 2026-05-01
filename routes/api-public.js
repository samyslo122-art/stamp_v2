const express = require('express');
const router = express.Router();
const db = require('../db');
const config = require('../config');
const QRCode = require('qrcode');
const sse = require('../sse');
const {
  generateUniqueId,
  formatPlayerName,
  buildPassportByCategory,
  calculateStampTotal,
  checkRedemptionEligibility,
} = require('../helpers/config-helpers');

// POST /api/players/register — Create player from group code
router.post('/api/players/register', async (req, res) => {
  const client = await db.getClient();
  try {
    const { groupCode } = req.body;
    if (!groupCode) return res.status(400).json({ error: 'Group code required' });

    await client.query('BEGIN');

    // Look up group with lock
    const groupResult = await client.query(
      'SELECT * FROM groups WHERE group_code = $1 FOR UPDATE',
      [groupCode.toUpperCase()]
    );
    if (groupResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Invalid group code' });
    }
    const group = groupResult.rows[0];

    if (!group.checked_in) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Registration not open yet' });
    }

    // Check quota atomically
    const countResult = await client.query(
      'SELECT COUNT(*)::int AS cnt FROM players WHERE group_id = $1',
      [group.id]
    );
    if (countResult.rows[0].cnt >= group.quota) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'This group is full' });
    }

    // Get next player number from sequence
    const seqResult = await client.query("SELECT nextval('player_number_seq')::int AS num");
    const playerNumber = seqResult.rows[0].num;
    const playerName = formatPlayerName(playerNumber);

    // Generate unique ID (retry if collision)
    let uniqueId;
    let attempts = 0;
    while (attempts < 20) {
      uniqueId = generateUniqueId();
      const existing = await client.query('SELECT id FROM players WHERE unique_id = $1', [uniqueId]);
      if (existing.rows.length === 0) break;
      attempts++;
    }
    if (attempts >= 20) {
      await client.query('ROLLBACK');
      return res.status(500).json({ error: 'Failed to generate unique ID' });
    }

    // Create player
    await client.query(
      'INSERT INTO players (player_number, unique_id, name, group_id) VALUES ($1, $2, $3, $4)',
      [playerNumber, uniqueId, playerName, group.id]
    );

    await client.query('COMMIT');

    res.json({ uniqueId, name: playerName, playerNumber });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Registration failed' });
  } finally {
    client.release();
  }
});

// GET /api/groups/validate/:qrCode — Validate group for registration button state
router.get('/api/groups/validate/:qrCode', async (req, res) => {
  try {
    const code = req.params.qrCode.toUpperCase();
    const groupResult = await db.query(
      'SELECT * FROM groups WHERE group_code = $1',
      [code]
    );
    if (groupResult.rows.length === 0) {
      return res.json({ found: false });
    }
    const group = groupResult.rows[0];
    const countResult = await db.query(
      'SELECT COUNT(*)::int AS cnt FROM players WHERE group_id = $1',
      [group.id]
    );
    const registered = countResult.rows[0].cnt;
    res.json({
      found: true,
      checked_in: group.checked_in,
      quota: group.quota,
      registered,
      remaining: group.quota - registered,
    });
  } catch (err) {
    console.error('Group validate error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/player/:uniqueId — Player data + round summary
router.get('/api/player/:uniqueId', async (req, res) => {
  try {
    const uniqueId = req.params.uniqueId.toUpperCase();
    const playerResult = await db.query(
      'SELECT * FROM players WHERE unique_id = $1',
      [uniqueId]
    );
    if (playerResult.rows.length === 0) {
      return res.status(404).json({ error: 'Player not found' });
    }
    const player = playerResult.rows[0];

    const stampsResult = await db.query(
      'SELECT * FROM stamps WHERE player_id = $1 AND round_number = $2',
      [player.id, player.current_round]
    );
    const stamps = stampsResult.rows;
    const passport = await buildPassportByCategory(stamps);
    const stampCount = await calculateStampTotal(stamps);

    // Flatten passport for client
    const flatPassport = [];
    passport.forEach((cat) => {
      cat.booths.forEach((b) => {
        flatPassport.push(b);
      });
    });

    res.json({
      player: {
        name: player.name,
        uniqueId: player.unique_id,
        currentRound: player.current_round,
      },
      stamps,
      stampCount,
      passport: flatPassport,
    });
  } catch (err) {
    console.error('Player data error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
