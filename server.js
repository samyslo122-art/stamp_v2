require('dotenv').config();

const express = require('express');
const path = require('path');
const fs = require('fs');
const http = require('http');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { doubleCsrf } = require('csrf-csrf');

const config = require('./config');
const db = require('./db');
const socketManager = require('./socket');

const app = express();
const server = http.createServer(app);
const PORT = parseInt(process.env.PORT, 10) || 3000;

// Initialize Socket.IO
socketManager.init(server);

// ─── Database Initialization ───────────────────────────────────────────────
async function startApp() {
  try {
    const sqlPath = path.join(__dirname, 'sql', 'init.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    await db.query(sql);

    const catCheck = await db.query('SELECT COUNT(*) FROM categories');
    if (parseInt(catCheck.rows[0].count) === 0) {
      console.log('Database empty. Seeding initial configuration from config.js...');
      for (const [key, cat] of Object.entries(config.CATEGORIES)) {
          await db.query('INSERT INTO categories (category_key, name) VALUES ($1, $2)', [key, cat.name]);
      }
      for (const b of config.BOOTHS) {
          await db.query('INSERT INTO booths (booth_key, name, category, stamp_value) VALUES ($1, $2, $3, $4)', [b.key, b.name, b.category, b.stampValue]);
      }
      for (const t of config.REDEMPTION_TIERS) {
          await db.query('INSERT INTO redemption_tiers (tier_key, name, required_stamps, min_categories, require_all_categories) VALUES ($1, $2, $3, $4, $5)', [t.key, t.name, t.requiredStamps, t.minCategories, t.requireAllCategories]);
      }
      const defaults = {
          EVENT_DETAILS: config.EVENT_DETAILS,
          RATE_LIMITS: config.RATE_LIMITS,
          MAX_ROUNDS: config.MAX_ROUNDS,
          TOTAL_BOOTHS: config.TOTAL_BOOTHS,
          SESSION_TIMEOUT_MS: config.SESSION_TIMEOUT_MS,
          LOW_STOCK_THRESHOLD: config.LOW_STOCK_THRESHOLD
      };
      for (const [key, val] of Object.entries(defaults)) {
          await db.query('INSERT INTO system_settings (setting_key, setting_value) VALUES ($1, $2)', [key, JSON.stringify(val)]);
      }
      for (const g of config.GROUPS) {
        await db.query('INSERT INTO groups (group_code, quota) VALUES ($1, $2) ON CONFLICT (group_code) DO NOTHING', [g.group_code, g.quota]);
      }
      for (const tier of config.REDEMPTION_TIERS) {
        for (const gift of tier.gifts) {
          await db.query('INSERT INTO gift_inventory (tier, gift_name, total_qty, remaining_qty) VALUES ($1, $2, $3, $3)', [tier.key, gift.name, gift.qty]);
        }
      }
    }

    server.listen(PORT, () => {
      console.log(`Event Passport server running on port ${PORT} with Socket.IO`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (err) {
    console.error('Failed to start application:', err);
    process.exit(1);
  }
}

// ─── Startup Validation ────────────────────────────────────────────────────────
const SESSION_SECRET = process.env.SESSION_SECRET || '';
if (process.env.NODE_ENV === 'production' && SESSION_SECRET.length < 32) {
  console.error('FATAL: SESSION_SECRET must be at least 32 characters in production.');
  process.exit(1);
}

// ─── Middleware ────────────────────────────────────────────────────────────────
app.set('trust proxy', 1);
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://cdn.tailwindcss.com", "https://unpkg.com", "https://cdn.socket.io"],
      scriptSrcAttr: ["'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.tailwindcss.com"],
      imgSrc: ["'self'", "data:", "blob:"],
      connectSrc: ["'self'", "ws:", "wss:"], // Added for Socket.IO
      mediaSrc: ["'self'", "blob:"],
      fontSrc: ["'self'"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(cookieParser(SESSION_SECRET));
app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  name: 'ep.sid',
  cookie: {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    maxAge: config.SESSION_TIMEOUT_MS,
  },
}));

const { generateToken, doubleCsrfProtection } = doubleCsrf({
  getSecret: () => SESSION_SECRET,
  cookieName: '__csrf',
  cookieOptions: { httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production', path: '/' },
  getTokenFromRequest: (req) => req.headers['x-csrf-token'] || req.body?._csrf || req.query?._csrf,
});

app.use((req, res, next) => {
  if (req.path === '/health') return next();
  doubleCsrfProtection(req, res, next);
});

app.use((req, res, next) => {
  try { req.csrfToken = generateToken(req, res); } catch (e) { req.csrfToken = ''; }
  next();
});

app.use(express.static(path.join(__dirname, 'public'), { maxAge: '1h' }));

// ─── Middleware to expose settings ──────────────────────────────────────────
app.use(async (req, res, next) => {
  try {
    req.appSettings = await db.loadSettings();
    next();
  } catch (err) {
    console.error('Settings load error:', err);
    next();
  }
});

// ─── Rate Limiting ──────────────────────────────────────────────────────────────
if (config.RATE_LIMITS.ENABLED) {
  app.use(rateLimit({
    windowMs: config.RATE_LIMITS.GENERAL.windowMs,
    limit: config.RATE_LIMITS.GENERAL.limit,
    message: { error: 'Too many requests.' }
  }));
}

// ─── Routes ─────────────────────────────────────────────────────────────────────
app.use('/', require('./routes/public'));
app.use('/', require('./routes/api-public'));
app.use('/', require('./routes/admin'));
app.use('/', require('./routes/api-admin'));
app.use('/', require('./routes/developer'));
app.use('/', require('./routes/api-developer'));

app.use((req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Not found' });
  res.status(404).render('error', { statusCode: 404, message: 'Page not found' });
});

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  if (err.code === 'EBADCSRFTOKEN') {
    if (req.path.startsWith('/api/')) return res.status(403).json({ error: 'Invalid CSRF' });
    return res.status(403).render('error', { statusCode: 403, message: 'CSRF error' });
  }
  res.status(500).render('error', { statusCode: 500, message: 'Internal error' });
});

startApp();

module.exports = app;