const db = require('../db');
const config = require('../config');

async function issueAllStamps() {
  const uniqueId = 'BZ8106';

  const playerResult = await db.query(
    'SELECT id, current_round FROM players WHERE unique_id = $1',
    [uniqueId]
  );
  if (playerResult.rows.length === 0) {
    console.error(`Player with unique_id "${uniqueId}" not found.`);
    process.exit(1);
  }

  const player = playerResult.rows[0];
  console.log(`Player found: id=${player.id}, round=${player.current_round}`);
  console.log(`Issuing ${config.BOOTHS.length} stamps...`);

  let issued = 0;
  let skipped = 0;
  for (const booth of config.BOOTHS) {
    const result = await db.query(
      `INSERT INTO stamps (player_id, booth_name, booth_category, stamp_value, round_number)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (player_id, booth_name, round_number) DO NOTHING`,
      [player.id, booth.key, booth.category, booth.stampValue, player.current_round]
    );
    if (result.rowCount > 0) {
      console.log(`  Issued: ${booth.key}`);
      issued++;
    } else {
      console.log(`  Skipped (already exists): ${booth.key}`);
      skipped++;
    }
  }

  console.log(`\nDone: ${issued} issued, ${skipped} skipped`);
  process.exit(0);
}

issueAllStamps().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
