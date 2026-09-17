const express = require('express');
const { findPlan } = require('../config/plans');
const { supabase } = require('../lib/supabase');
const { buildSubscriptionPaymentFields } = require('../lib/payfast');
const { sendAdminNotification } = require('../lib/email');

const router = express.Router();

router.post('/subscribe', async (req, res) => {
  try {
    const {
      type,
      planId,
      name,
      email,
      phone,
      company,
      paymentMethod, // 'card' | 'debit_order'
      popiaConsent,
      details, // { ...everything else from the membership form }
    } = req.body || {};

    if (!type || !['organization', 'client'].includes(type)) {
      return res.status(400).json({ error: 'type must be "organization" or "client"' });
    }
    if (!name || !email || !planId || !company) {
      return res.status(400).json({ error: 'name, email, company and planId are required' });
    }
    if (!popiaConsent) {
      return res.status(400).json({ error: 'You must agree to the POPIA consent to subscribe.' });
    }

    const method = paymentMethod === 'debit_order' ? 'debit_order' : 'card';
    if (method === 'debit_order' && type !== 'organization') {
      return res.status(400).json({ error: 'Debit order is only available for organization memberships.' });
    }
    if (method === 'debit_order') {
      const bank = (details && details.bankDetails) || {};
      if (!bank.bankName || !bank.accountHolder || !bank.accountNumber || !bank.branchCode) {
        return res.status(400).json({ error: 'Full banking details are required for debit order.' });
      }
    }

    // Price/plan details are looked up server-side — never trust
    // anything about the amount from the request body.
    const plan = findPlan(type, planId);
    if (!plan) {
      return res.status(400).json({ error: 'Unknown plan for that subscriber type' });
    }

    if (!supabase) {
      return res.status(500).json({ error: 'Server is not configured (Supabase env vars missing).' });
    }

    const { data: subscriber, error } = await supabase
      .from('subscribers')
      .insert({
        type,
        plan_id: plan.id,
        name,
        email,
        phone: phone || null,
        company,
        payment_method: method,
        popia_consent: true,
        details: details || {},
        status: method === 'debit_order' ? 'pending_debit_order' : 'pending',
      })
      .select()
      .single();

    if (error) {
      console.error('[subscribe] Supabase insert failed:', error.message);
      return res.status(500).json({ error: 'Could not create subscriber record.' });
    }

    sendAdminNotification(
      `New ${type} subscription: ${name}`,
      `A new subscription was received.\n\nName: ${name}\nEmail: ${email}\nCompany: ${company}\nPlan: ${plan.name}\nPayment method: ${method}\nStatus: ${subscriber.status}`
    ).catch((mailError) => console.error('[subscribe] notification email failed:', mailError.message));

    if (method === 'debit_order') {
      // No payment gateway involved — LLCT sets up the actual debit
      // order manually using the banking details just captured.
      return res.json({
        mode: 'manual',
        message:
          "Thanks — we've received your details. LLCT will set up your debit order and confirm with you shortly.",
      });
    }

    const { action, fields } = buildSubscriptionPaymentFields({ subscriber, plan });
    res.json({ mode: 'redirect', action, fields });
  } catch (err) {
    console.error('[subscribe] unexpected error:', err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

module.exports = router;
