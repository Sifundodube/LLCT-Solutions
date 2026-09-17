const express = require('express');
const crypto = require('crypto');
const { COOKIE_NAME, createToken, requireAdmin } = require('../lib/adminAuth');

const router = express.Router();

router.use('/admin', (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

function passwordsMatch(password, expectedPassword) {
  const actual = Buffer.from(password || '');
  const expected = Buffer.from(expectedPassword || '');
  return (
    actual.length === expected.length &&
    crypto.timingSafeEqual(actual, expected)
  );
}

router.post('/admin/login', (req, res) => {
  const { password } = req.body || {};
  if (
    !process.env.ADMIN_PASSWORD ||
    !password ||
    !passwordsMatch(password, process.env.ADMIN_PASSWORD)
  ) {
    return res.status(401).json({ error: 'Invalid admin password.' });
  }

  res.cookie(COOKIE_NAME, createToken(), {
    httpOnly: true,
    sameSite: 'lax',
    secure: req.secure || req.headers['x-forwarded-proto'] === 'https',
  });
  res.json({ ok: true });
});

router.post('/admin/logout', (req, res) => {
  res.clearCookie(COOKIE_NAME);
  res.json({ ok: true });
});

router.get('/admin/session', requireAdmin, (req, res) => res.json({ authenticated: true }));

module.exports = { router, requireAdmin };