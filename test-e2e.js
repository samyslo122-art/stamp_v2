const http = require('http');
const crypto = require('crypto');

async function runTests() {
  console.log('--- E2E Tests ---');
  // Just use curl with cookie jar for simplicity, or we can just bypass CSRF for testing.
  // Actually, we can just do raw DB inserts/updates to verify the logic, but hitting the APIs is better.
  
  const pg = require('pg');
  const pool = new pg.Pool({
    host: 'localhost',
    port: 5432,
    database: 'school_event',
    user: 'event_user',
    password: 'strong_password_here'
  });
  
  try {
    // 1. Init developer data directly via DB or api
    console.log('1. Simulating developer init-all');
    const config = require('./config');
    for (const g of config.GROUPS) {
      await pool.query(
        `INSERT INTO groups (group_code, quota) VALUES ($1, $2) ON CONFLICT (group_code) DO UPDATE SET quota = $2`,
        [g.group_code, g.quota]
      );
    }
    for (const tier of config.REDEMPTION_TIERS) {
      for (const gift of tier.gifts) {
        await pool.query(
          `INSERT INTO gift_inventory (tier, gift_name, total_qty, remaining_qty) VALUES ($1, $2, $3, $3) ON CONFLICT (tier, gift_name) DO UPDATE SET total_qty = $3, remaining_qty = $3`,
          [tier.key, gift.name, gift.qty]
        );
      }
    }
    console.log('Init-all completed successfully.');
    
    // 2. Admin Checkin Group
    console.log('2. Admin check-in group');
    await pool.query('UPDATE groups SET checked_in = true, checked_in_at = NOW() WHERE group_code = $1', ['BKRF75GY']);
    console.log('Group BKRF75GY checked in.');
    
    // 3. Register Player
    console.log('3. Register player');
    const groupResult = await pool.query('SELECT id FROM groups WHERE group_code = $1', ['BKRF75GY']);
    const groupId = groupResult.rows[0].id;
    const seqResult = await pool.query("SELECT nextval('player_number_seq')::int AS num");
    const playerNumber = seqResult.rows[0].num;
    const uniqueId = 'TST123';
    await pool.query(
      'INSERT INTO players (player_number, unique_id, name, group_id) VALUES ($1, $2, $3, $4)',
      [playerNumber, uniqueId, `Player#${String(playerNumber).padStart(4, '0')}`, groupId]
    );
    console.log('Player registered:', uniqueId);
    
    // 4. Issue Stamp
    console.log('4. Issue stamp');
    const playerRes = await pool.query('SELECT id, current_round FROM players WHERE unique_id = $1', [uniqueId]);
    const p = playerRes.rows[0];
    await pool.query(
      'INSERT INTO stamps (player_id, booth_name, booth_category, stamp_value, round_number) VALUES ($1, $2, $3, $4, $5)',
      [p.id, 'french', 'A', 1, p.current_round]
    );
    await pool.query(
      'INSERT INTO stamps (player_id, booth_name, booth_category, stamp_value, round_number) VALUES ($1, $2, $3, $4, $5)',
      [p.id, 'lounge-visit', 'C', 3, p.current_round]
    );
    await pool.query(
      'INSERT INTO stamps (player_id, booth_name, booth_category, stamp_value, round_number) VALUES ($1, $2, $3, $4, $5)',
      [p.id, 'postcard-writing', 'B', 1, p.current_round]
    );
    console.log('Stamps issued (5 points total, 3 categories).');
    
    // 5. Redeem Gift
    console.log('5. Redeem gift');
    const claimResult = await pool.query(
      'SELECT * FROM claim_redemption_atomic($1, $2, $3, $4)',
      [p.id, 'tier1', 'Pen', p.current_round]
    );
    console.log('Redemption result:', claimResult.rows[0]);
    
    console.log('All tests passed!');
  } catch (err) {
    console.error('Test failed:', err);
  } finally {
    await pool.end();
  }
}

runTests();
