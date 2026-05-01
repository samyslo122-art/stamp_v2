const db = require('../db');
const config = require('../config');

/**
 * Seed the database from config.js
 * This is safe to run on every startup (idempotent)
 */
async function seedFromConfig() {
  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    console.log('Seeding groups from config.js...');
    for (const g of config.GROUPS) {
      await client.query(
        `INSERT INTO groups (group_code, quota)
         VALUES ($1, $2)
         ON CONFLICT (group_code) DO UPDATE SET quota = $2`,
        [g.group_code.toUpperCase(), g.quota]
      );
    }

    console.log('Seeding gift inventory from config.js...');
    for (const tier of config.REDEMPTION_TIERS) {
      for (const gift of tier.gifts) {
        await client.query(
          `INSERT INTO gift_inventory (tier, gift_name, total_qty, remaining_qty)
           VALUES ($1, $2, $3, $3)
           ON CONFLICT (tier, gift_name) DO UPDATE SET total_qty = $3`,
          [tier.key, gift.name, gift.qty]
        );
      }
    }

    await client.query('COMMIT');
    console.log('Database seeded successfully from config.js.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error seeding database:', err);
    throw err;
  } finally {
    client.release();
  }
}

module.exports = seedFromConfig;

if (require.main === module) {
  seedFromConfig().then(() => process.exit(0)).catch(() => process.exit(1));
}
