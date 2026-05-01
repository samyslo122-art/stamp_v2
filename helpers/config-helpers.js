const db = require('../db');

/**
 * Generate a 6-character uppercase alphanumeric unique ID
 */
function generateUniqueId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Format player number as Player#XXXX
 */
function formatPlayerName(num) {
  return `Player#${String(num).padStart(4, '0')}`;
}

/**
 * Get booth from DB
 */
async function getBoothByKey(key) {
  const res = await db.query('SELECT * FROM booths WHERE booth_key = $1', [key]);
  if (res.rows.length === 0) return null;
  const b = res.rows[0];
  return { key: b.booth_key, name: b.name, category: b.category, stampValue: b.stamp_value };
}

/**
 * Build passport grid for a player's current round
 * Returns booths grouped by category with collected status
 */
async function buildPassportByCategory(stamps) {
  const stampSet = new Set(stamps.map((s) => s.booth_name));
  
  const boothRes = await db.query('SELECT * FROM booths ORDER BY name');
  const catRes = await db.query('SELECT * FROM categories ORDER BY category_key');
  
  const categoryMap = {};
  catRes.rows.forEach(c => {
      categoryMap[c.category_key] = {
          categoryKey: c.category_key,
          categoryName: c.name,
          booths: []
      };
  });

  boothRes.rows.forEach(b => {
      if (categoryMap[b.category]) {
          categoryMap[b.category].booths.push({
              key: b.booth_key,
              name: b.name,
              category: b.category,
              stampValue: b.stamp_value,
              collected: stampSet.has(b.booth_key)
          });
      }
  });

  return Object.values(categoryMap).sort((a, b) => a.categoryKey.localeCompare(b.categoryKey));
}

/**
 * Calculate stamp total
 */
async function calculateStampTotal(stamps) {
  const boothRes = await db.query('SELECT booth_key, stamp_value FROM booths');
  const boothMap = {};
  boothRes.rows.forEach(b => boothMap[b.booth_key] = b.stamp_value);
  return stamps.reduce((sum, s) => sum + (boothMap[s.booth_name] || s.stamp_value || 1), 0);
}

/**
 * Check redemption eligibility for a player
 */
async function checkRedemptionEligibility(stampTotal, categoriesCollected, redeemedTiers) {
  const redeemedSet = new Set(redeemedTiers);
  const catCount = categoriesCollected ? categoriesCollected.length : 0;
  
  const catRes = await db.query('SELECT COUNT(*) FROM categories');
  const totalCategories = parseInt(catRes.rows[0].count);
  
  const tierRes = await db.query('SELECT * FROM redemption_tiers ORDER BY required_stamps');

  return tierRes.rows.map((tier) => {
    const hasStamps = stampTotal >= tier.required_stamps;
    const hasCats = tier.require_all_categories
      ? catCount >= totalCategories
      : catCount >= tier.min_categories;
    const alreadyRedeemed = redeemedSet.has(tier.tier_key);

    return {
      key: tier.tier_key,
      name: tier.name,
      requiredStamps: tier.required_stamps,
      minCategories: tier.min_categories,
      requireAllCategories: tier.require_all_categories,
      eligible: hasStamps && hasCats && !alreadyRedeemed,
      alreadyRedeemed,
      hasStamps,
      hasCats,
    };
  });
}

module.exports = {
  generateUniqueId,
  formatPlayerName,
  getBoothByKey,
  buildPassportByCategory,
  calculateStampTotal,
  checkRedemptionEligibility,
};
