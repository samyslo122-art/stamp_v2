const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const config = require('./config');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT, 10) || 5432,
  database: process.env.DB_NAME || 'school_event',
  user: process.env.DB_USER || 'event_user',
  password: process.env.DB_PASSWORD || 'strong_password_here',
  max: config.DB_POOL_MAX || 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('Unexpected pool error:', err.message);
});

async function query(text, params) {
  const client = await pool.connect();
  try {
    return await client.query(text, params);
  } finally {
    client.release();
  }
}

async function getClient() {
  return pool.connect();
}

async function initSchema() {
  const sqlPath = path.join(__dirname, 'sql', 'init.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');
  try {
    await pool.query(sql);
    console.log('Database schema initialized successfully.');
    process.exit(0);
  } catch (err) {
    console.error('Schema init error:', err.message);
    process.exit(1);
  }
}

async function healthCheck() {
  try {
    const result = await pool.query('SELECT 1 AS ok');
    return { status: 'ok', connections: pool.totalCount, idle: pool.idleCount };
  } catch (err) {
    return { status: 'error', message: err.message };
  }
}

async function loadSettings() {
  try {
    const res = await pool.query('SELECT setting_key, setting_value FROM system_settings');
    const settings = {};
    res.rows.forEach(r => {
      settings[r.setting_key] = r.setting_value;
    });
    return settings;
  } catch (err) {
    console.error('Failed to load settings:', err);
    return {};
  }
}

module.exports = {
  pool,
  query,
  getClient,
  initSchema,
  healthCheck,
  loadSettings,
};

// Allow running directly: node -e "require('./db').initSchema()"
if (require.main === module) {
  initSchema();
}
