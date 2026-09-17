const crypto = require('crypto');

const COOKIE_NAME = 'llct_admin';
const SESSION_TTL_SECONDS = 60 * 60 * 8;

function getSecret() {
  return process.env.ADMIN_PASSWORD || '';
}

function createToken() {
  const expires = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const payload = `admin.${expires}`;
  const signature = crypto.createHmac('sha256', getSecret()).update(payload).digest('hex');
  return `${payload}.${signature}`;
}

function isValidToken(token) {
  if (!getSecret() || !token) return false;
  const [scope, expiresText, signature] = token.split('.');
  const payload = `${scope}.${expiresText}`;
  const expected = crypto.createHmac('sha256', getSecret()).update(payload).digest('hex');
  if (scope !== 'admin' || !signature || !/^[0-9]+$/.test(expiresText)) return false;
  if (Number(expiresText) < Math.floor(Date.now() / 1000)) return false;
  if (signature.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

function requireAdmin(req, res, next) {
  if (!isValidToken(req.cookies && req.cookies[COOKIE_NAME])) {
    return res.status(401).json({ error: 'Admin login required.' });
  }
  next();
}

module.exports = { COOKIE_NAME, createToken, isValidToken, requireAdmin };