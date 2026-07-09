const express = require("express");
const router = express.Router();
const db = require("../db");
const config = require("../config");
const requireAdmin = require("../middleware/requireAdmin");

// GET /admin/login
router.get("/admin/login", (req, res) => {
    res.render("admin-login", { csrfToken: req.csrfToken, error: null });
});

// POST /admin/login
router.post("/admin/login", (req, res) => {
    const { pin } = req.body;
    if (pin === process.env.ADMIN_PIN) {
        req.session.isAdmin = true;
        return res.redirect("/admin/counter");
    }
    db.query(
        "INSERT INTO security_logs (event_type, ip_address, details) VALUES ($1, $2, $3)",
        ["admin_login_failed", req.ip, "Invalid PIN attempt"],
    ).catch(() => {});
    res.render("admin-login", {
        csrfToken: req.csrfToken,
        error: "Invalid PIN.",
    });
});

// POST /admin/logout
router.post("/admin/logout", (req, res) => {
    req.session.isAdmin = false;
    res.redirect("/admin/login");
});

// UI Routes — apply requireAdmin middleware to each
router.get("/admin/group-checkin", requireAdmin, (req, res) => {
    res.render("admin-group-checkin", { csrfToken: req.csrfToken });
});

router.get("/admin/counter", requireAdmin, (req, res) => {
    res.render("admin-counter", { csrfToken: req.csrfToken });
});

router.get("/admin/booth", requireAdmin, (req, res) => {
    res.render("admin-booth", {
        csrfToken: req.csrfToken,
        booths: config.BOOTHS,
    });
});

router.get("/admin/redeem", requireAdmin, (req, res) => {
    res.render("admin-redeem", { csrfToken: req.csrfToken });
});

module.exports = router;
