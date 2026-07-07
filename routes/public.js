const express = require('express');
const router = express.Router();
const db = require('../db');
const config = require('../config');
const QRCode = require('qrcode');
const { buildPassportByCategory, calculateStampTotal } = require('../helpers/config-helpers');

// GET / — redirect to /register
router.get('/', (req, res) => {
  res.redirect('/register');
});

// GET /register
router.get('/register', (req, res) => {
  res.render('register', {
    eventDetails: req.appSettings.EVENT_DETAILS,
    csrfToken: req.csrfToken,
  });
});

// GET /self-reg — Public page showing big QR code for self-registration URL
router.get('/self-reg', async (req, res, next) => {
  try {
    const QRCode = require('qrcode');
    const regUrl = `${req.protocol}://${req.get('host')}/register`;
    const qrDataUrl = await QRCode.toDataURL(regUrl, { width: 500, margin: 2 });
    res.render('self-reg', {
      eventDetails: req.appSettings.EVENT_DETAILS,
      qrDataUrl,
      regUrl,
    });
  } catch (err) {
    next(err);
  }
});

// GET /player/:uniqueId — Player Portal
router.get('/player/:uniqueId', async (req, res, next) => {
  try {
    const { uniqueId } = req.params;
    const playerResult = await db.query(
      'SELECT * FROM players WHERE unique_id = $1',
      [uniqueId.toUpperCase()]
    );
    if (playerResult.rows.length === 0) {
      return res.status(404).render('error', { statusCode: 404, message: 'Player not found' });
    }
    const player = playerResult.rows[0];

    // Get stamps for current round
    const stampsResult = await db.query(
      'SELECT * FROM stamps WHERE player_id = $1 AND round_number = $2',
      [player.id, player.current_round]
    );
    const stamps = stampsResult.rows;

    const passportByCategory = await buildPassportByCategory(stamps);
    const stampCount = await calculateStampTotal(stamps);

    // Check if round is complete (all booths stamped)
    const totalBoothsRes = await db.query('SELECT COUNT(*) FROM booths');
    const totalBooths = parseInt(totalBoothsRes.rows[0].count);
    const isComplete = stamps.length >= totalBooths;

    const roundStatus = {
      currentRound: player.current_round,
      maxRound: req.appSettings.MAX_ROUNDS,
      isComplete,
    };

    // Generate QR code for player portal URL
    const portalUrl = `${req.protocol}://${req.get('host')}/player/${player.unique_id}`;
    const qrDataUrl = await QRCode.toDataURL(portalUrl, { width: 300, margin: 2 });

    res.render('player-portal', {
      title: 'Event Passport',
      player,
      stamps,
      stampCount,
      passportByCategory,
      roundStatus,
      qrDataUrl,
    });
  } catch (err) {
    next(err);
  }
});

// GET /health
router.get('/health', async (req, res) => {
  const sse = require('../sse');
  const dbHealth = await db.healthCheck();
  res.json({
    status: dbHealth.status === 'ok' ? 'healthy' : 'unhealthy',
    db: dbHealth,
    sseClients: sse.getClientCount(),
    uptime: process.uptime(),
  });
});

module.exports = router;
