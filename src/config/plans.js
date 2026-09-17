// ============================================================
// SUBSCRIPTION PLANS — EDIT PRICES HERE ONLY
// ============================================================
// This file is the single source of truth for plan names, prices
// and features. The frontend fetches this list from GET /api/plans
// so it always matches what this server will actually charge —
// nothing about price ever comes from the browser.
//
// Sourced from LLCT's membership application forms. Those forms
// state fees as VAT-exclusive; `priceExclVat` below is that stated
// fee, and `price` is the VAT-inclusive total (what's actually
// charged via PayFast and shown as the headline price). VAT_RATE
// is the one thing to change if the VAT rate ever changes.
//
// frequency: "monthly" | "quarterly" | "biannual" | "annual"
// ============================================================

const VAT_RATE = 0.15;

function withVat(priceExclVat) {
  return Math.round(priceExclVat * (1 + VAT_RATE) * 100) / 100;
}

const PLANS = {
  organization: [
    {
      id: 'org-small',
      name: 'Small Business',
      band: '1–20 employees',
      priceExclVat: 3500,
      price: withVat(3500),
      frequency: 'monthly',
      description: 'Fixed monthly package for small employers.',
      features: [
        'Ongoing labour law compliance support',
        'HR policy & procedure guidance',
        'Disciplinary & grievance support',
        'Incapacity, probation & retrenchment procedure support',
        '15% discount on out-of-scope work',
      ],
    },
    {
      id: 'org-growth',
      name: 'Organization in Growth',
      band: '20–50 employees',
      priceExclVat: 7000,
      price: withVat(7000),
      frequency: 'monthly',
      description: 'For growing teams that need more hands-on support.',
      features: [
        'Everything in Small Business',
        'Priority response times',
        'Quarterly HR policy review',
        'Incapacity, probation & retrenchment procedure support',
        '15% discount on out-of-scope work',
      ],
      featured: true,
    },
    {
      id: 'org-large',
      name: 'Large Organization / Corporate',
      band: '50–150 employees',
      priceExclVat: 19000,
      price: withVat(19000),
      frequency: 'monthly',
      description: 'Comprehensive compliance support at scale.',
      features: [
        'Everything in Organization in Growth',
        'Dedicated compliance advisor',
        'Employment Equity plan support',
        'Incapacity, probation & retrenchment procedure support',
        '15% discount on out-of-scope work',
      ],
    },
    {
      id: 'org-open-window',
      name: 'Open Window Plan',
      band: '150+ employees',
      priceExclVat: 43500,
      price: withVat(43500),
      frequency: 'monthly',
      description: 'Full-scale compliance partnership for large corporates.',
      features: [
        'Everything in Large Organization / Corporate',
        'On-demand access across all HR & compliance matters',
        'Custom reporting & audits',
        'Incapacity, probation & retrenchment procedure support',
        '15% discount on out-of-scope work',
      ],
    },
  ],
  client: [
    {
      id: 'client-standard',
      name: 'Standard',
      priceExclVat: 79,
      price: withVat(79),
      frequency: 'monthly',
      description: 'Unlimited workplace-rights advice and practical support for individual employees.',
      features: [
        'Unlimited phone & email advice on workplace rights',
        'Basic employment contract review',
        'Drafting of standard grievance letters',
        'Draft arguments and evidence preparation for disciplinary hearings',
        'Personal advice on contracts, disputes and statutory rights',
      ],
    },
    {
      id: 'client-premium',
      name: 'Premium',
      priceExclVat: 145,
      price: withVat(145),
      frequency: 'monthly',
      description: 'Enhanced employee support for negotiations, CCMA preparation and disputes.',
      features: [
        'Everything in Standard',
        'Direct negotiation assistance with employers',
        'CCMA referrals for conciliation, mediation and arbitration',
        'Drafting of arguments and affidavits for CCMA proceedings',
        'Full preparation for employees attending con-arb processes at the CCMA',
        'Informal representation and dispute consultation',
      ],
      featured: true,
    },
  ],
};

function findPlan(type, planId) {
  const list = PLANS[type];
  if (!list) return null;
  return list.find((p) => p.id === planId) || null;
}

module.exports = { PLANS, findPlan, VAT_RATE };
