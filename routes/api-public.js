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

// POST /api/players/register — Player self-activation / login
router.post('/api/players/register', async (req, res) => {
  const client = await db.getClient();
  try {
    let { playerId } = req.body;
    if (!playerId) return res.status(400).json({ error: 'Player ID required' });
    
    // Auto zero-pad if it's purely numeric and under 3 chars
    if (/^\d{1,2}$/.test(playerId)) {
      playerId = playerId.padStart(3, '0');
    }

    await client.query('BEGIN');

    // Look up player
    const playerResult = await client.query(
      'SELECT * FROM players WHERE unique_id = $1 FOR UPDATE',
      [playerId]
    );
    if (playerResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Invalid Player ID' });
    }
    const player = playerResult.rows[0];

    // If not active, activate them
    if (!player.is_active) {
      await client.query(
        'UPDATE players SET is_active = true WHERE id = $1',
        [player.id]
      );
    }

    await client.query('COMMIT');

    res.json({ uniqueId: player.unique_id, name: player.name, playerNumber: player.player_number });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Registration/Login error:', err);
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
    let uniqueId = req.params.uniqueId.toUpperCase();
    if (/^\d{1,2}$/.test(uniqueId)) uniqueId = uniqueId.padStart(3, '0');
    
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
