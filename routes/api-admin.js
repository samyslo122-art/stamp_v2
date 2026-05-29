const express = require('express');
const router = express.Router();
const db = require('../db');
const config = require('../config');
const QRCode = require('qrcode');
const requireAdmin = require('../middleware/requireAdmin');
const socketManager = require('../socket');
const sse = require('../sse');
const {
  generateUniqueId,
  formatPlayerName,
  getBoothByKey,
  calculateStampTotal,
  checkRedemptionEligibility,
} = require('../helpers/config-helpers');

// GET /api/admin/groups/lookup/:qrCode
router.get('/api/admin/groups/lookup/:qrCode', requireAdmin, async (req, res) => {
  try {
    const code = req.params.qrCode.toUpperCase();
    const groupResult = await db.query(
      'SELECT * FROM groups WHERE group_code = $1',
      [code]
    );
    if (groupResult.rows.length === 0) {
      return res.status(404).json({ error: 'Group not found' });
    }
    const group = groupResult.rows[0];
    const countResult = await db.query(
      'SELECT COUNT(*)::int AS cnt FROM players WHERE group_id = $1',
      [group.id]
    );
    const registered = countResult.rows[0].cnt;
    res.json({
      group_code: group.group_code,
      quota: group.quota,
      registered,
      remaining: group.quota - registered,
      checked_in: group.checked_in,
      checked_in_at: group.checked_in_at,
    });
  } catch (err) {
    console.error('Group lookup error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/admin/groups/checkin
router.post('/api/admin/groups/checkin', requireAdmin, async (req, res) => {
  try {
    const { groupCode } = req.body;
    if (!groupCode) return res.status(400).json({ error: 'Group code required' });

    const result = await db.query(
      'UPDATE groups SET checked_in = true, checked_in_at = NOW() WHERE group_code = $1 RETURNING *',
      [groupCode.toUpperCase()]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Group not found' });
    }
    res.json({ success: true, group: result.rows[0] });
  } catch (err) {
    console.error('Group checkin error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/admin/players/create — Manual player creation
router.post('/api/admin/players/create', requireAdmin, async (req, res) => {
  const client = await db.getClient();
  try {
    const { groupCode } = req.body;
    if (!groupCode) return res.status(400).json({ error: 'Group code required' });

    await client.query('BEGIN');

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
      return res.status(400).json({ error: 'Group not checked in yet' });
    }

    const countResult = await client.query(
      'SELECT COUNT(*)::int AS cnt FROM players WHERE group_id = $1',
      [group.id]
    );
    if (countResult.rows[0].cnt >= group.quota) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Group quota full' });
    }

    const seqResult = await client.query("SELECT nextval('player_number_seq')::int AS num");
    const playerNumber = seqResult.rows[0].num;
    const playerName = formatPlayerName(playerNumber);

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

    await client.query(
      'INSERT INTO players (player_number, unique_id, name, group_id) VALUES ($1, $2, $3, $4)',
      [playerNumber, uniqueId, playerName, group.id]
    );

    await client.query('COMMIT');
    res.json({ uniqueId, name: playerName, playerNumber });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Admin player create error:', err);
    res.status(500).json({ error: 'Failed to create player' });
  } finally {
    client.release();
  }
});

// GET /api/admin/players/search?q=...
router.get('/api/admin/players/search', requireAdmin, async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    if (!q) return res.json({ players: [] });

    // Search by unique_id, name, or group_code
    const result = await db.query(
      `SELECT p.*, g.group_code FROM players p
       JOIN groups g ON g.id = p.group_id
       WHERE p.unique_id ILIKE $1
          OR p.name ILIKE $1
          OR g.group_code ILIKE $1
       ORDER BY p.player_number
       LIMIT 50`,
      [`%${q}%`]
    );

    const players = [];
    for (const p of result.rows) {
      const portalUrl = `${req.protocol}://${req.get('host')}/player/${p.unique_id}`;
      const qr_data_url = await QRCode.toDataURL(portalUrl, { width: 200, margin: 2 });
      players.push({
        id: p.id,
        name: p.name,
        unique_id: p.unique_id,
        current_round: p.current_round,
        group_code: p.group_code,
        qr_data_url,
      });
    }

    res.json({ players });
  } catch (err) {
    console.error('Player search error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/admin/stamps/issue
router.post('/api/admin/stamps/issue', requireAdmin, async (req, res) => {
  try {
    const { boothKey, uniqueId } = req.body;
    if (!boothKey || !uniqueId) return res.status(400).json({ error: 'Booth and player ID required' });

    const booth = await getBoothByKey(boothKey);
    if (!booth) return res.status(400).json({ error: 'Invalid booth' });

    const playerResult = await db.query(
      'SELECT * FROM players WHERE unique_id = $1',
      [uniqueId.toUpperCase()]
    );
    if (playerResult.rows.length === 0) {
      return res.status(404).json({ error: 'Player not found' });
    }
    const player = playerResult.rows[0];

    // Check if already stamped
    const existing = await db.query(
      'SELECT id FROM stamps WHERE player_id = $1 AND booth_name = $2 AND round_number = $3',
      [player.id, booth.key, player.current_round]
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Already stamped this booth this round' });
    }

    await db.query(
      'INSERT INTO stamps (player_id, booth_name, booth_category, stamp_value, round_number) VALUES ($1, $2, $3, $4, $5)',
      [player.id, booth.key, booth.category, booth.stampValue, player.current_round]
    );

    // Socket push to player
    socketManager.sendEvent(player.unique_id, 'stamp:issued', {
      boothKey: booth.key,
      boothName: booth.name,
      stampValue: booth.stampValue
    });

    res.json({
      success: true,
      playerName: player.name,
      boothName: booth.name,
      stampValue: booth.stampValue
    });
  } catch (err) {
    console.error('Stamp issue error:', err);
    res.status(500).json({ error: 'Failed to issue stamp' });
  }
});

// POST /api/admin/stamps/revoke
router.post('/api/admin/stamps/revoke', requireAdmin, async (req, res) => {
  try {
    const { boothKey, uniqueId } = req.body;
    if (!boothKey || !uniqueId) return res.status(400).json({ error: 'Booth and player ID required' });

    const booth = await getBoothByKey(boothKey);
    if (!booth) return res.status(400).json({ error: 'Invalid booth' });

    const playerResult = await db.query(
      'SELECT * FROM players WHERE unique_id = $1',
      [uniqueId.toUpperCase()]
    );
    if (playerResult.rows.length === 0) {
      return res.status(404).json({ error: 'Player not found' });
    }
    const player = playerResult.rows[0];

    const result = await db.query(
      'DELETE FROM stamps WHERE player_id = $1 AND booth_name = $2 AND round_number = $3 RETURNING id',
      [player.id, booth.key, player.current_round]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No stamp found to revoke' });
    }

    // Socket push to player
    socketManager.sendEvent(player.unique_id, 'stamp:revoked', {
      boothKey: booth.key,
      boothName: booth.name,
    });

    res.json({
      success: true,
      playerName: player.name,
      boothName: booth.name,
    });
  } catch (err) {
    console.error('Stamp revoke error:', err);
    res.status(500).json({ error: 'Failed to revoke stamp' });
  }
});

// POST /api/admin/redemption/lookup
router.post('/api/admin/redemption/lookup', requireAdmin, async (req, res) => {
  console.log('[API] /api/admin/redemption/lookup called', { body: req.body, session: req.session?.isAdmin });
  try {
    const { uniqueId } = req.body;
    if (!uniqueId) return res.status(400).json({ error: 'Player ID required' });

    const playerResult = await db.query(
      'SELECT * FROM players WHERE unique_id = $1',
      [uniqueId.toUpperCase()]
    );
    if (playerResult.rows.length === 0) {
      return res.status(404).json({ error: 'Player not found' });
    }
    const player = playerResult.rows[0];

    // Get stamps for current round
    const stampsResult = await db.query(
      'SELECT * FROM stamps WHERE player_id = $1 AND round_number = $2',
      [player.id, player.current_round]
    );
    const stamps = stampsResult.rows;
    const stampTotal = await calculateStampTotal(stamps);
    const categoriesCollected = [...new Set(stamps.map((s) => s.booth_category))];

    // Get redemptions for current round
    const redemptionsResult = await db.query(
      'SELECT tier_claimed FROM redemptions WHERE player_id = $1 AND round_number = $2',
      [player.id, player.current_round]
    );
    const redeemedTiers = redemptionsResult.rows.map((r) => r.tier_claimed);

    // Get gift inventory for eligible tiers
    const tiers = await checkRedemptionEligibility(stampTotal, categoriesCollected, redeemedTiers);

    // Attach gift inventory info to eligible tiers
    for (const tier of tiers) {
      if (tier.eligible) {
        const giftResult = await db.query(
          'SELECT gift_name AS name, remaining_qty AS remaining FROM gift_inventory WHERE tier = $1 AND remaining_qty > 0',
          [tier.key]
        );
        tier.gifts = giftResult.rows.map((g) => ({
          name: g.name,
          remaining: g.remaining,
        }));
      }
    }

    res.json({
      name: player.name,
      uniqueId: player.unique_id,
      currentRound: player.current_round,
      stampTotal,
      categoriesCollected,
      tiers,
    });
  } catch (err) {
    console.error('Redemption lookup error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/admin/redemption/claim
router.post('/api/admin/redemption/claim', requireAdmin, async (req, res) => {
  console.log('[API] /api/admin/redemption/claim called', { body: req.body, session: req.session?.isAdmin });
  try {
    const { uniqueId, tierKey, giftName } = req.body;
    if (!uniqueId || !tierKey || !giftName) {
      return res.status(400).json({ error: 'Player ID, tier, and gift required' });
    }

    const playerResult = await db.query(
      'SELECT * FROM players WHERE unique_id = $1',
      [uniqueId.toUpperCase()]
    );
    if (playerResult.rows.length === 0) {
      return res.status(404).json({ error: 'Player not found' });
    }
    const player = playerResult.rows[0];

    // Use atomic stored procedure
    const claimResult = await db.query(
      'SELECT * FROM claim_redemption_atomic($1, $2, $3, $4)',
      [player.id, tierKey, giftName, player.current_round]
    );

    const result = claimResult.rows[0];
    if (!result.success) {
      return res.status(400).json({ error: result.message });
    }

    // SSE push
    sse.sendEvent(player.unique_id, 'student:update', { type: 'redemption', tierKey, giftName });

    res.json({ success: true, message: result.message });
  } catch (err) {
    console.error('Redemption claim error:', err);
    res.status(500).json({ error: 'Claim failed' });
  }
});

// POST /api/admin/rounds/reset
router.post('/api/admin/rounds/reset', requireAdmin, async (req, res) => {
  try {
    const { uniqueId } = req.body;
    if (!uniqueId) return res.status(400).json({ error: 'Player ID required' });

    const playerResult = await db.query(
      'SELECT * FROM players WHERE unique_id = $1',
      [uniqueId.toUpperCase()]
    );
    if (playerResult.rows.length === 0) {
      return res.status(404).json({ error: 'Player not found' });
    }
    const player = playerResult.rows[0];

    // Verify player has collected all stamps (12 points) before resetting
    const stampsResult = await db.query(
      'SELECT SUM(stamp_value)::int as total FROM stamps WHERE player_id = $1 AND round_number = $2',
      [player.id, player.current_round]
    );
    const totalPoints = stampsResult.rows[0].total || 0;
    if (totalPoints < 12) {
      return res.status(400).json({ error: `Player only has ${totalPoints}/12 points. Must collect all stamps to advance.` });
    }

    const settings = await db.loadSettings();
    const resetResult = await db.query(
      'SELECT * FROM reset_player_round($1, $2)',
      [player.id, settings.MAX_ROUNDS]
    );
    const result = resetResult.rows[0];
    if (!result.success) {
      return res.status(400).json({ error: result.message });
    }

    // SSE push
    sse.sendEvent(player.unique_id, 'student:update', { type: 'round_reset', newRound: result.new_round });

    res.json({ success: true, newRound: result.new_round });
  } catch (err) {
    console.error('Round reset error:', err);
    res.status(500).json({ error: 'Reset failed' });
  }
});

module.exports = router;
