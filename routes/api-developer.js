const express = require('express');
const router = express.Router();
const db = require('../db');
const config = require('../config');
const requireDeveloper = require('../middleware/requireDeveloper');
const sse = require('../sse');
const { generateUniqueId, getBoothByKey } = require('../helpers/config-helpers');

/**
 * Helper to notify a player via SSE
 */
async function notifyPlayer(playerId, eventName, data = {}) {
  try {
    const playerResult = await db.query('SELECT unique_id FROM players WHERE id = $1', [playerId]);
    if (playerResult.rows.length > 0) {
      sse.sendEvent(playerResult.rows[0].unique_id, eventName, data);
    }
  } catch (err) {
    console.error('SSE Notification failed:', err);
  }
}

// GET /api/developer/lookup-data — For smart dropdowns
router.get('/api/developer/lookup-data', requireDeveloper, async (req, res) => {
  try {
    const players = await db.query('SELECT id, name, unique_id FROM players ORDER BY name');
    const groups = await db.query('SELECT id, group_code FROM groups ORDER BY group_code');
    const booths = await db.query('SELECT * FROM booths ORDER BY name');
    const tiers = await db.query('SELECT * FROM redemption_tiers ORDER BY required_stamps');
    const categories = await db.query('SELECT * FROM categories ORDER BY category_key');
    
    res.json({
      players: players.rows,
      groups: groups.rows,
      booths: booths.rows,
      tiers: tiers.rows,
      categories: categories.rows
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Categories CRUD
router.get('/api/developer/categories', requireDeveloper, async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM categories ORDER BY category_key');
    res.json({ rows: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/api/developer/categories', requireDeveloper, async (req, res) => {
  try {
    const { category_key, name } = req.body;
    const result = await db.query(
      'INSERT INTO categories (category_key, name) VALUES ($1, $2) RETURNING *',
      [category_key.toUpperCase(), name]
    );
    res.json({ row: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/api/developer/categories', requireDeveloper, async (req, res) => {
  try {
    const { id, category_key, name } = req.body;
    const result = await db.query(
      'UPDATE categories SET category_key = COALESCE($2, category_key), name = COALESCE($3, name) WHERE id = $1 RETURNING *',
      [id, category_key ? category_key.toUpperCase() : null, name]
    );
    res.json({ row: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/api/developer/categories', requireDeveloper, async (req, res) => {
  try {
    await db.query('DELETE FROM categories WHERE id = $1', [req.query.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Booths CRUD
router.get('/api/developer/booths', requireDeveloper, async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM booths ORDER BY booth_key');
    res.json({ rows: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/api/developer/booths', requireDeveloper, async (req, res) => {
  try {
    const { booth_key, name, category, stamp_value } = req.body;
    const result = await db.query(
      'INSERT INTO booths (booth_key, name, category, stamp_value) VALUES ($1, $2, $3, $4) RETURNING *',
      [booth_key.toUpperCase(), name, category, stamp_value]
    );
    res.json({ row: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/api/developer/booths', requireDeveloper, async (req, res) => {
  try {
    const { id, booth_key, name, category, stamp_value } = req.body;
    const result = await db.query(
      'UPDATE booths SET booth_key = COALESCE($2, booth_key), name = COALESCE($3, name), category = COALESCE($4, category), stamp_value = COALESCE($5, stamp_value) WHERE id = $1 RETURNING *',
      [id, booth_key ? booth_key.toUpperCase() : null, name, category, stamp_value]
    );
    res.json({ row: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/api/developer/booths', requireDeveloper, async (req, res) => {
  try {
    await db.query('DELETE FROM booths WHERE id = $1', [req.query.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Tiers CRUD
router.get('/api/developer/tiers', requireDeveloper, async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM redemption_tiers ORDER BY required_stamps');
    res.json({ rows: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/api/developer/tiers', requireDeveloper, async (req, res) => {
  try {
    const { tier_key, name, required_stamps, min_categories, require_all_categories } = req.body;
    const result = await db.query(
      'INSERT INTO redemption_tiers (tier_key, name, required_stamps, min_categories, require_all_categories) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [tier_key.toUpperCase(), name, required_stamps, min_categories, require_all_categories]
    );
    res.json({ row: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/api/developer/tiers', requireDeveloper, async (req, res) => {
  try {
    const { id, tier_key, name, required_stamps, min_categories, require_all_categories } = req.body;
    const result = await db.query(
      'UPDATE redemption_tiers SET tier_key = COALESCE($2, tier_key), name = COALESCE($3, name), required_stamps = COALESCE($4, required_stamps), min_categories = COALESCE($5, min_categories), require_all_categories = COALESCE($6, require_all_categories) WHERE id = $1 RETURNING *',
      [id, tier_key ? tier_key.toUpperCase() : null, name, required_stamps, min_categories, require_all_categories]
    );
    res.json({ row: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/api/developer/tiers', requireDeveloper, async (req, res) => {
  try {
    await db.query('DELETE FROM redemptions WHERE tier_claimed = (SELECT tier_key FROM redemption_tiers WHERE id = $1)', [req.query.id]);
    await db.query('DELETE FROM gift_inventory WHERE tier = (SELECT tier_key FROM redemption_tiers WHERE id = $1)', [req.query.id]);
    await db.query('DELETE FROM redemption_tiers WHERE id = $1', [req.query.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Settings Management
router.get('/api/developer/settings', requireDeveloper, async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM system_settings ORDER BY setting_key');
    res.json({ rows: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/api/developer/settings', requireDeveloper, async (req, res) => {
  try {
    const { setting_key, setting_value } = req.body;
    await db.query(
      'INSERT INTO system_settings (setting_key, setting_value) VALUES ($1, $2) ON CONFLICT (setting_key) DO UPDATE SET setting_value = $2',
      [setting_key, setting_value]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Players CRUD
router.get('/api/developer/players', requireDeveloper, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT p.id, p.player_number, p.unique_id, p.name, p.current_round, g.group_code, p.created_at, p.group_id
       FROM players p JOIN groups g ON g.id = p.group_id ORDER BY p.player_number`
    );
    res.json({ rows: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/api/developer/players', requireDeveloper, async (req, res) => {
  try {
    let { unique_id, name, group_id, current_round, player_number } = req.body;
    if (!unique_id) unique_id = generateUniqueId();
    if (!player_number) {
        const seq = await db.query("SELECT nextval('player_number_seq')::int as num");
        player_number = seq.rows[0].num;
    }
    await db.query(
      'INSERT INTO players (unique_id, name, group_id, current_round, player_number) VALUES ($1, $2, $3, $4, $5)',
      [unique_id.toUpperCase(), name, group_id, current_round || 1, player_number]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/api/developer/players', requireDeveloper, async (req, res) => {
  try {
    const { id, unique_id, name, group_id, current_round, player_number } = req.body;
    const pid = parseInt(id);
    if (isNaN(pid)) return res.status(400).json({ error: 'Invalid ID' });

    await db.query(
      `UPDATE players 
       SET unique_id = COALESCE($1, unique_id), 
           name = COALESCE($2, name), 
           group_id = COALESCE($3, group_id), 
           current_round = COALESCE($4, current_round), 
           player_number = COALESCE($5, player_number) 
       WHERE id = $6`,
      [unique_id ? unique_id.toUpperCase() : null, name, group_id ? parseInt(group_id) : null, current_round ? parseInt(current_round) : null, player_number ? parseInt(player_number) : null, pid]
    );
    await notifyPlayer(pid, 'student:update', { type: 'profile_updated' });
    res.json({ success: true });
  } catch (err) {
    console.error('Player update error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.delete('/api/developer/players', requireDeveloper, async (req, res) => {
  try {
    const { id } = req.query;
    await db.query('DELETE FROM stamps WHERE player_id = $1', [id]);
    await db.query('DELETE FROM redemptions WHERE player_id = $1', [id]);
    await db.query('DELETE FROM players WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Stamps CRUD
router.get('/api/developer/stamps', requireDeveloper, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT s.id, p.name AS player_name, p.unique_id, s.booth_name, s.booth_category, s.stamp_value, s.round_number, s.issued_at, s.player_id
       FROM stamps s JOIN players p ON p.id = s.player_id ORDER BY s.issued_at DESC LIMIT 500`
    );
    res.json({ rows: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/api/developer/stamps', requireDeveloper, async (req, res) => {
  try {
    let { player_id, booth_name, booth_category, stamp_value, round_number } = req.body;
    const booth = await getBoothByKey(booth_name);
    if (booth) {
        booth_category = booth.category;
        stamp_value = booth.stampValue;
    }
    await db.query(
      'INSERT INTO stamps (player_id, booth_name, booth_category, stamp_value, round_number) VALUES ($1, $2, $3, $4, $5)',
      [player_id, booth_name, booth_category, stamp_value, round_number]
    );
    await notifyPlayer(player_id, 'stamp:issued', { boothName: booth_name });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/api/developer/stamps', requireDeveloper, async (req, res) => {
  try {
    let { id, player_id, booth_name, booth_category, stamp_value, round_number } = req.body;
    const sid = parseInt(id);
    if (isNaN(sid)) return res.status(400).json({ error: 'Invalid ID' });

    const booth = await getBoothByKey(booth_name);
    if (booth) {
        booth_category = booth.category;
        stamp_value = booth.stampValue;
    }
    await db.query(
      'UPDATE stamps SET player_id = $1, booth_name = $2, booth_category = $3, stamp_value = $4, round_number = $5 WHERE id = $6',
      [parseInt(player_id), booth_name, booth_category, parseInt(stamp_value), parseInt(round_number), sid]
    );
    await notifyPlayer(parseInt(player_id), 'student:update', { type: 'stamp_updated' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/api/developer/redemptions', requireDeveloper, async (req, res) => {
  try {
    const { id, player_id, tier_claimed, gift_name, round_number } = req.body;
    const rid = parseInt(id);
    if (isNaN(rid)) return res.status(400).json({ error: 'Invalid ID' });

    await db.query(
      'UPDATE redemptions SET player_id = $1, tier_claimed = $2, gift_name = $3, round_number = $4 WHERE id = $5',
      [parseInt(player_id), tier_claimed, gift_name, parseInt(round_number), rid]
    );
    await notifyPlayer(parseInt(player_id), 'student:update', { type: 'redemption_updated' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/api/developer/stamps', requireDeveloper, async (req, res) => {
  try {
    const { id } = req.query;
    const stamp = await db.query('SELECT player_id FROM stamps WHERE id = $1', [id]);
    if (stamp.rows.length > 0) {
        const pid = stamp.rows[0].player_id;
        await db.query('DELETE FROM stamps WHERE id = $1', [id]);
        await notifyPlayer(pid, 'stamp:revoked');
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Redemptions CRUD
router.get('/api/developer/redemptions', requireDeveloper, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT r.id, p.name AS player_name, p.unique_id, r.tier_claimed, r.gift_name, r.round_number, r.redeemed_at, r.player_id
       FROM redemptions r JOIN players p ON p.id = r.player_id ORDER BY r.redeemed_at DESC LIMIT 500`
    );
    res.json({ rows: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/api/developer/redemptions', requireDeveloper, async (req, res) => {
  try {
    const { player_id, tier_claimed, gift_name, round_number } = req.body;
    await db.query(
      'INSERT INTO redemptions (player_id, tier_claimed, gift_name, round_number) VALUES ($1, $2, $3, $4)',
      [player_id, tier_claimed, gift_name, round_number]
    );
    await db.query(
      'UPDATE gift_inventory SET remaining_qty = remaining_qty - 1 WHERE tier = $1 AND gift_name = $2',
      [tier_claimed, gift_name]
    );
    await notifyPlayer(player_id, 'student:update', { type: 'redemption_added' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/api/developer/redemptions', requireDeveloper, async (req, res) => {
  try {
    const { id, player_id, tier_claimed, gift_name, round_number } = req.body;
    await db.query(
      'UPDATE redemptions SET player_id = $1, tier_claimed = $2, gift_name = $3, round_number = $4 WHERE id = $5',
      [player_id, tier_claimed, gift_name, round_number, id]
    );
    await notifyPlayer(player_id, 'student:update', { type: 'redemption_updated' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/api/developer/redemptions', requireDeveloper, async (req, res) => {
  try {
    const { id } = req.query;
    const redemption = await db.query('SELECT * FROM redemptions WHERE id = $1', [id]);
    if (redemption.rows.length > 0) {
      const r = redemption.rows[0];
      await db.query(
        'UPDATE gift_inventory SET remaining_qty = remaining_qty + 1 WHERE tier = $1 AND gift_name = $2',
        [r.tier_claimed, r.gift_name]
      );
      await notifyPlayer(r.player_id, 'student:update', { type: 'redemption_revoked' });
      await db.query('DELETE FROM redemptions WHERE id = $1', [id]);
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Groups CRUD
router.get('/api/developer/groups', requireDeveloper, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT g.id, g.group_code, g.quota, g.checked_in, g.checked_in_at,
              (SELECT COUNT(*)::int FROM players WHERE group_id = g.id) AS registered_count,
              g.created_at
       FROM groups g ORDER BY g.id`
    );
    res.json({ rows: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/api/developer/groups', requireDeveloper, async (req, res) => {
  try {
    let { group_code, quota } = req.body;
    if (!group_code) group_code = Math.random().toString(36).substring(2, 10).toUpperCase();
    const result = await db.query(
      'INSERT INTO groups (group_code, quota) VALUES ($1, $2) RETURNING *',
      [group_code.toUpperCase(), quota || 40]
    );
    res.json({ row: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/api/developer/groups', requireDeveloper, async (req, res) => {
  try {
    const { id, group_code, quota, checked_in } = req.body;
    const result = await db.query(
      'UPDATE groups SET group_code = COALESCE($2, group_code), quota = COALESCE($3, quota), checked_in = COALESCE($4, checked_in) WHERE id = $1 RETURNING *',
      [id, group_code ? group_code.toUpperCase() : null, quota, checked_in]
    );
    res.json({ row: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/api/developer/groups', requireDeveloper, async (req, res) => {
  try {
    const { id } = req.query;
    await db.query('DELETE FROM stamps WHERE player_id IN (SELECT id FROM players WHERE group_id = $1)', [id]);
    await db.query('DELETE FROM redemptions WHERE player_id IN (SELECT id FROM players WHERE group_id = $1)', [id]);
    await db.query('DELETE FROM players WHERE group_id = $1', [id]);
    await db.query('DELETE FROM groups WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Gifts CRUD
router.get('/api/developer/gifts', requireDeveloper, async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM gift_inventory ORDER BY tier, gift_name');
    res.json({ rows: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/api/developer/gifts', requireDeveloper, async (req, res) => {
  try {
    const { tier, gift_name, total_qty } = req.body;
    const result = await db.query(
      'INSERT INTO gift_inventory (tier, gift_name, total_qty, remaining_qty) VALUES ($1, $2, $3, $3) RETURNING *',
      [tier, gift_name, total_qty]
    );
    res.json({ row: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/api/developer/gifts', requireDeveloper, async (req, res) => {
  try {
    const { id, tier, gift_name, remaining_qty, total_qty } = req.body;
    await db.query(
      'UPDATE gift_inventory SET tier = $1, gift_name = $2, remaining_qty = $3, total_qty = $4 WHERE id = $5',
      [tier, gift_name, remaining_qty, total_qty, id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/api/developer/gifts', requireDeveloper, async (req, res) => {
  try {
    await db.query('DELETE FROM gift_inventory WHERE id = $1', [req.query.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Stats
router.get('/api/developer/stats', requireDeveloper, async (req, res) => {
  try {
    const stats = {};
    const [players, stamps, redemptions, groups, checkedGroups] = await Promise.all([
      db.query('SELECT COUNT(*)::int AS cnt FROM players'),
      db.query('SELECT COUNT(*)::int AS cnt FROM stamps'),
      db.query('SELECT COUNT(*)::int AS cnt FROM redemptions'),
      db.query('SELECT COUNT(*)::int AS cnt FROM groups'),
      db.query('SELECT COUNT(*)::int AS cnt FROM groups WHERE checked_in = true')
    ]);
    
    stats.total_players = players.rows[0].cnt;
    stats.total_stamps = stamps.rows[0].cnt;
    stats.total_redemptions = redemptions.rows[0].cnt;
    stats.total_groups = groups.rows[0].cnt;
    stats.checked_in_groups = checkedGroups.rows[0].cnt;
    stats.sse_clients = sse.getClientCount();

    const settings = await db.loadSettings();
    const threshold = settings.LOW_STOCK_THRESHOLD || config.LOW_STOCK_THRESHOLD;
    const lowStock = await db.query('SELECT COUNT(*)::int AS cnt FROM gift_inventory WHERE remaining_qty <= $1', [threshold]);
    stats.low_stock_gifts = lowStock.rows[0].cnt;

    res.json([stats]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Export
router.get('/api/developer/export', requireDeveloper, async (req, res) => {
  try {
    const { table, format } = req.query;
    const allowed = ['players', 'stamps', 'redemptions', 'groups', 'gift_inventory', 'security_logs'];
    if (!allowed.includes(table)) return res.status(400).json({ error: 'Invalid table' });

    let q = `SELECT * FROM ${table}`;
    if (table === 'players') q = `SELECT p.*, g.group_code FROM players p JOIN groups g ON g.id = p.group_id ORDER BY p.player_number`;
    
    const result = await db.query(q);
    if (format === 'csv') {
      if (result.rows.length === 0) return res.send('');
      const headers = Object.keys(result.rows[0]);
      const csv = [headers.join(','), ...result.rows.map(row => headers.map(h => {
        let v = row[h];
        if (v === null || v === undefined) return '';
        v = String(v);
        return v.includes(',') || v.includes('"') || v.includes('\n') ? `"${v.replace(/"/g, '""')}"` : v;
      }).join(','))].join('\n');
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${table}.csv"`);
      return res.send(csv);
    }
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Links
router.get('/api/developer/links', requireDeveloper, async (req, res) => {
  try {
    const QRCode = require('qrcode');
    const base = `${req.protocol}://${req.get('host')}`;
    const links = [
      { name: 'Player Registration', url: `${base}/register` },
      { name: 'Admin Login', url: `${base}/admin/login` },
      { name: 'Group Check-in', url: `${base}/admin/group-checkin` },
      { name: 'Stamp Issue (Booth)', url: `${base}/admin/booth` },
      { name: 'Redemption Counter', url: `${base}/admin/redeem` },
      { name: 'Developer Login', url: `${base}/developer/login` }
    ];
    const linksWithQr = await Promise.all(links.map(async (l) => ({ ...l, qr: await QRCode.toDataURL(l.url) })));
    res.json(linksWithQr);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Init All
router.post('/api/developer/init-all', requireDeveloper, async (req, res) => {
  const client = await db.getClient();
  try {
    await client.query('BEGIN');
    for (const [key, cat] of Object.entries(config.CATEGORIES)) {
        await client.query('INSERT INTO categories (category_key, name) VALUES ($1, $2) ON CONFLICT (category_key) DO UPDATE SET name = $2', [key, cat.name]);
    }
    for (const b of config.BOOTHS) {
        await client.query('INSERT INTO booths (booth_key, name, category, stamp_value) VALUES ($1, $2, $3, $4) ON CONFLICT (booth_key) DO UPDATE SET name = $2, category = $3, stamp_value = $4', [b.key, b.name, b.category, b.stampValue]);
    }
    for (const t of config.REDEMPTION_TIERS) {
        await client.query('INSERT INTO redemption_tiers (tier_key, name, required_stamps, min_categories, require_all_categories) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (tier_key) DO UPDATE SET name = $2, required_stamps = $3, min_categories = $4, require_all_categories = $5', [t.key, t.name, t.requiredStamps, t.minCategories, t.requireAllCategories]);
    }
    const settings = {
        EVENT_DETAILS: config.EVENT_DETAILS,
        RATE_LIMITS: config.RATE_LIMITS,
        MAX_ROUNDS: config.MAX_ROUNDS,
        TOTAL_BOOTHS: config.TOTAL_BOOTHS,
        SESSION_TIMEOUT_MS: config.SESSION_TIMEOUT_MS,
        LOW_STOCK_THRESHOLD: config.LOW_STOCK_THRESHOLD
    };
    for (const [key, val] of Object.entries(settings)) {
        await client.query('INSERT INTO system_settings (setting_key, setting_value) VALUES ($1, $2) ON CONFLICT (setting_key) DO UPDATE SET setting_value = $2', [key, JSON.stringify(val)]);
    }
    for (const g of config.GROUPS) {
      await client.query('INSERT INTO groups (group_code, quota) VALUES ($1, $2) ON CONFLICT (group_code) DO UPDATE SET quota = $2', [g.group_code, g.quota]);
    }
    for (const tier of config.REDEMPTION_TIERS) {
      for (const gift of tier.gifts) {
        await client.query('INSERT INTO gift_inventory (tier, gift_name, total_qty, remaining_qty) VALUES ($1, $2, $3, $3) ON CONFLICT (tier, gift_name) DO UPDATE SET total_qty = $3, remaining_qty = $3', [tier.key, gift.name, gift.qty]);
      }
    }
    await client.query('COMMIT');
    res.json({ message: 'Initialisation complete.' });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// Clear All
router.post('/api/developer/clear-all', requireDeveloper, async (req, res) => {
  const client = await db.getClient();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM redemptions');
    await client.query('DELETE FROM stamps');
    await client.query('DELETE FROM players');
    await client.query('DELETE FROM booths');
    await client.query('DELETE FROM gift_inventory');
    await client.query('DELETE FROM groups');
    await client.query('DELETE FROM categories');
    await client.query('DELETE FROM redemption_tiers');
    await client.query('DELETE FROM system_settings');
    await client.query('DELETE FROM security_logs');
    await client.query("ALTER SEQUENCE player_number_seq RESTART WITH 1");
    await client.query('COMMIT');
    res.json({ message: 'All data cleared successfully.' });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

module.exports = router;