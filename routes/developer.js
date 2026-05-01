const express = require('express');
const router = express.Router();
const requireDeveloper = require('../middleware/requireDeveloper');
const config = require('../config');

// GET /developer/login
router.get('/developer/login', (req, res) => {
  res.render('developer-login', { csrfToken: req.csrfToken, error: null });
});

// POST /developer/login
router.post('/developer/login', (req, res) => {
  const { pin } = req.body;
  if (pin === process.env.DEVELOPER_PIN) {
    req.session.isDeveloper = true;
    return res.redirect('/developer/dashboard');
  }
  const db = require('../db');
  db.query(
    'INSERT INTO security_logs (event_type, ip_address, details) VALUES ($1, $2, $3)',
    ['developer_login_failed', req.ip, 'Invalid PIN attempt']
  ).catch(() => {});
  res.render('developer-login', { csrfToken: req.csrfToken, error: 'Invalid PIN' });
});

// POST /developer/logout
router.post('/developer/logout', (req, res) => {
  req.session.isDeveloper = false;
  res.redirect('/developer/login');
});

// GET /developer/dashboard
router.get('/developer/dashboard', requireDeveloper, (req, res) => {
  res.render('developer-dashboard', {
    csrfToken: req.csrfToken,
    lowStockThreshold: config.LOW_STOCK_THRESHOLD,
  });
});

module.exports = router;
