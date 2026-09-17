const express = require('express');
const { PLANS } = require('../config/plans');

const router = express.Router();

// Public — the frontend calls this to render plan cards, so pricing
// always matches what this server will actually charge.
router.get('/plans', (req, res) => {
  res.json(PLANS);
});

module.exports = router;
