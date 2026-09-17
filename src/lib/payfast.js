const crypto = require('crypto');
const dns = require('dns').promises;
const https = require('https');

const FREQUENCY_MAP = {
  monthly: 3,
  quarterly: 4,
  biannual: 5,
  annual: 6,
};

function isSandbox() {
  return (process.env.PAYFAST_MODE || 'sandbox') !== 'live';
}

function paymentHost() {
  return isSandbox() ? 'sandbox.payfast.co.za' : 'www.payfast.co.za';
}

// PayFast requires values urlencoded with spaces as '+', matching
// standard application/x-www-form-urlencoded (not %20).
function pfEncode(value) {
  return encodeURIComponent(String(value).trim()).replace(/%20/g, '+');
}

// Build the md5 signature. `fields` must be a plain object; keys are
// used in the order they were inserted, which matches how we build
// the payment data below (PayFast is picky about field order).
function generateSignature(fields, passphrase) {
  let pairs = Object.entries(fields)
    .filter(([, v]) => v !== undefined && v !== null && String(v).length > 0)
    .map(([k, v]) => `${k}=${pfEncode(v)}`);

  let str = pairs.join('&');
  if (passphrase) {
    str += `&passphrase=${pfEncode(passphrase)}`;
  }
  return crypto.createHash('md5').update(str).digest('hex');
}

// Build the full set of form fields for a recurring subscription
// payment. Returns { action, fields } — `action` is the PayFast URL
// to POST/redirect the browser to.
function buildSubscriptionPaymentFields({ subscriber, plan }) {
  const { APP_URL, PAYFAST_MERCHANT_ID, PAYFAST_MERCHANT_KEY, PAYFAST_PASSPHRASE } =
    process.env;

  const fields = {
    merchant_id: PAYFAST_MERCHANT_ID,
    merchant_key: PAYFAST_MERCHANT_KEY,
    return_url: `${APP_URL}/subscribe-success.html`,
    cancel_url: `${APP_URL}/subscribe-cancelled.html`,
    notify_url: `${APP_URL}/api/payfast/notify`,

    name_first: subscriber.name,
    email_address: subscriber.email,

    m_payment_id: subscriber.id, // our subscriber row id — comes back on the ITN
    amount: Number(plan.price).toFixed(2),
    item_name: `LLCT Solutions – ${plan.name}`,
    item_description: plan.description || '',

    subscription_type: 1, // 1 = subscription
    billing_date: new Date().toISOString().slice(0, 10),
    recurring_amount: Number(plan.price).toFixed(2),
    frequency: FREQUENCY_MAP[plan.frequency] || 3,
    cycles: 0, // 0 = bill indefinitely until cancelled

    custom_str1: subscriber.type, // "employer" | "employee"
    custom_str2: plan.id,
  };

  const signature = generateSignature(fields, PAYFAST_PASSPHRASE);

  return {
    action: `https://${paymentHost()}/eng/process`,
    fields: { ...fields, signature },
  };
}

// Recompute the signature from a posted ITN body and compare.
function isSignatureValid(postedFields) {
  const { signature, ...rest } = postedFields;
  const expected = generateSignature(rest, process.env.PAYFAST_PASSPHRASE);
  return expected === signature;
}

// PayFast recommend confirming the source IP resolves to one of
// their hostnames, since their IPs can change. This resolves the
// known PayFast hostnames fresh on each check rather than hardcoding IPs.
async function isKnownPayfastIp(remoteIp) {
  const hosts = isSandbox()
    ? ['sandbox.payfast.co.za']
    : ['www.payfast.co.za', 'w1w.payfast.co.za', 'w2w.payfast.co.za'];

  const ip = (remoteIp || '').replace('::ffff:', '');

  for (const host of hosts) {
    try {
      const addresses = await dns.resolve4(host);
      if (addresses.includes(ip)) return true;
    } catch (err) {
      console.warn(`[payfast] could not resolve ${host}:`, err.message);
    }
  }
  return false;
}

// Server-to-server confirmation: POST the raw ITN body back to
// PayFast and check it echoes "VALID". This is the strongest check —
// do this in addition to the signature/IP checks, not instead of them.
function confirmWithPayfast(rawBody) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: paymentHost(),
        path: '/eng/query/validate',
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(rawBody),
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => resolve(data.trim() === 'VALID'));
      }
    );
    req.on('error', reject);
    req.write(rawBody);
    req.end();
  });
}

module.exports = {
  buildSubscriptionPaymentFields,
  isSignatureValid,
  isKnownPayfastIp,
  confirmWithPayfast,
};
