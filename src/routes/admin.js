const express = require('express');
const { COOKIE_NAME, createToken, requireAdmin } = require('../lib/adminAuth');

const router = express.Router();

router.post('/admin/login', (req, res) => {
  const { password } = req.body || {};
  if (!process.env.ADMIN_PASSWORD || !password || password !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Invalid admin password.' });
  }

  res.cookie(COOKIE_NAME, createToken(), {
    httpOnly: true,
    sameSite: 'lax',
    secure: req.secure || req.headers['x-forwarded-proto'] === 'https',
    maxAge: 1000 * 60 * 60 * 8,
  });
  res.json({ ok: true });
});

router.post('/admin/logout', (req, res) => {
  res.clearCookie(COOKIE_NAME);
  res.json({ ok: true });
});

router.get('/admin/session', requireAdmin, (req, res) => res.json({ authenticated: true }));

module.exports = { router, requireAdmin };