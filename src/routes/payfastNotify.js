const express = require('express');
const { supabase } = require('../lib/supabase');
const { isSignatureValid, isKnownPayfastIp, confirmWithPayfast } = require('../lib/payfast');

const router = express.Router();

// PayFast calls this server-to-server after a payment (and on every
// recurring charge) to confirm status. Always respond 200 quickly —
// PayFast retries if it doesn't get one.
router.post('/payfast/notify', async (req, res) => {
  res.sendStatus(200); // acknowledge immediately, verify in the background

  try {
    const posted = req.body || {};
    const rawBody = req.rawBody || '';

    if (!isSignatureValid(posted)) {
      console.warn('[payfast-notify] signature mismatch — ignoring', posted.m_payment_id);
      return;
    }

    const sourceIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const ipOk = await isKnownPayfastIp(sourceIp);
    if (!ipOk) {
      console.warn('[payfast-notify] request did not come from a known PayFast host:', sourceIp);
      return;
    }

    const confirmed = await confirmWithPayfast(rawBody);
    if (!confirmed) {
      console.warn('[payfast-notify] PayFast server-to-server validation failed');
      return;
    }

    if (!supabase) return;

    const subscriberId = posted.m_payment_id;
    const paymentStatus = posted.payment_status; // COMPLETE | CANCELLED | ...

    const updates = {
      pf_token: posted.token || null,
      pf_payment_id: posted.pf_payment_id || null,
      last_payment_status: paymentStatus || null,
      updated_at: new Date().toISOString(),
    };

    if (paymentStatus === 'COMPLETE') {
      updates.status = 'active';
    } else if (paymentStatus === 'CANCELLED') {
      updates.status = 'cancelled';
    }

    const { error } = await supabase.from('subscribers').update(updates).eq('id', subscriberId);
    if (error) {
      console.error('[payfast-notify] failed to update subscriber:', error.message);
    }
  } catch (err) {
    console.error('[payfast-notify] unexpected error:', err);
  }
});

module.exports = router;
