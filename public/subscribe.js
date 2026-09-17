// ============================================================
// SUBSCRIBE — fetches live plans/pricing from the backend, collects
// the full membership-form details, and either redirects to PayFast
// (card) or saves banking details for a manual debit order.
//
// The API is served from this same app (see server.js), so this is
// just a relative path — no URL to edit, works the same locally and
// once deployed.
// ============================================================
const isLocalStaticPreview =
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') &&
  window.location.port !== '4000';
const SUBSCRIBE_API_BASE = isLocalStaticPreview ? 'http://localhost:4000/api' : '/api';

const FREQUENCY_LABEL = {
  monthly: '/month',
  quarterly: '/quarter',
  biannual: '/6 months',
  annual: '/year',
};

let currentType = 'organization';
let plansByType = null;
let selectedPlan = null;

const plansGrid = document.getElementById('plansGrid');
const toggleButtons = document.querySelectorAll('.subscribe-toggle .toggle-btn');

const modalOverlay = document.getElementById('subscribeModalOverlay');
const modalClose = document.getElementById('subscribeModalClose');
const subscribeForm = document.getElementById('subscribeForm');
const subscribePlanName = document.getElementById('subscribePlanName');
const subscribePlanPrice = document.getElementById('subscribePlanPrice');
const subscribeError = document.getElementById('subscribeError');
const subscribeSuccess = document.getElementById('subscribeSuccess');
const subscribeSubmitBtn = document.getElementById('subscribeSubmitBtn');
const subscribePaymentNote = document.getElementById('subscribePaymentNote');

const orgFieldsGroup = document.getElementById('orgFieldsGroup');
const clientFieldsGroup = document.getElementById('clientFieldsGroup');
const bankDetailsGroup = document.getElementById('bankDetailsGroup');
const paymentMethodSelect = document.getElementById('sub-payment-method');

function formatZAR(amount) {
  return `R${Number(amount).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Headline price is VAT-inclusive; we also show the excl.-VAT
// breakdown underneath for transparency (matches the membership
// application forms, which state fees excl. VAT).
function formatPrice(plan) {
  const freq = FREQUENCY_LABEL[plan.frequency] || '';
  return `${formatZAR(plan.price)}${freq}`;
}

function formatPriceBreakdown(plan) {
  if (plan.priceExclVat === undefined) return '';
  return `${formatZAR(plan.priceExclVat)} + VAT — incl. VAT`;
}

function renderPlans() {
  if (!plansByType) return;
  const plans = plansByType[currentType] || [];

  if (!plans.length) {
    plansGrid.innerHTML = '<p class="plans-loading">No plans available right now — please check back soon.</p>';
    return;
  }

  plansGrid.innerHTML = plans
    .map(
      (plan) => `
      <div class="plan-card ${plan.featured ? 'featured' : ''}" data-plan-id="${plan.id}">
        ${plan.featured ? '<span class="plan-badge">Most Popular</span>' : ''}
        <h3>${plan.name}</h3>
        ${plan.band ? `<p class="plan-band">${plan.band}</p>` : ''}
        <div class="plan-price">${formatPrice(plan)}</div>
        <p class="plan-price-note">${formatPriceBreakdown(plan)}</p>
        <p class="plan-description">${plan.description || ''}</p>
        <ul class="plan-features">
          ${(plan.features || []).map((f) => `<li><i class="fas fa-check"></i> ${f}</li>`).join('')}
        </ul>
        <button type="button" class="btn-primary btn-full plan-subscribe-btn" data-plan-id="${plan.id}">
          Subscribe
        </button>
      </div>
    `
    )
    .join('');

  plansGrid.querySelectorAll('.plan-subscribe-btn').forEach((btn) => {
    btn.addEventListener('click', () => openModal(btn.getAttribute('data-plan-id')));
  });
}

async function loadPlans() {
  try {
    const res = await fetch(`${SUBSCRIBE_API_BASE}/plans`);
    if (!res.ok) throw new Error('Failed to load plans');
    plansByType = await res.json();
    renderPlans();
  } catch (err) {
    plansGrid.innerHTML =
      '<p class="plans-loading">Plans are temporarily unavailable. Please WhatsApp us or try again shortly.</p>';
    console.error('[subscribe] could not load plans:', err);
  }
}

toggleButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    toggleButtons.forEach((b) => {
      b.classList.remove('active');
      b.setAttribute('aria-selected', 'false');
    });
    btn.classList.add('active');
    btn.setAttribute('aria-selected', 'true');
    currentType = btn.getAttribute('data-type');
    renderPlans();
  });
});

function updatePaymentNote() {
  if (currentType === 'organization' && paymentMethodSelect.value === 'debit_order') {
    subscribePaymentNote.innerHTML =
      '<i class="fas fa-file-signature"></i> We\'ll save your banking details and contact you to set up the debit order — no online payment now.';
  } else {
    subscribePaymentNote.innerHTML =
      '<i class="fas fa-lock"></i> You\'ll be redirected to PayFast to complete payment securely.';
  }
}

paymentMethodSelect.addEventListener('change', () => {
  bankDetailsGroup.hidden = paymentMethodSelect.value !== 'debit_order';
  updatePaymentNote();
});

function openModal(planId) {
  const plans = plansByType[currentType] || [];
  selectedPlan = plans.find((p) => p.id === planId);
  if (!selectedPlan) return;

  subscribePlanName.textContent = selectedPlan.name;
  subscribePlanPrice.textContent = formatPrice(selectedPlan);
  subscribeError.hidden = true;
  subscribeSuccess.hidden = true;
  subscribeForm.hidden = false;
  subscribeForm.reset();

  orgFieldsGroup.hidden = currentType !== 'organization';
  clientFieldsGroup.hidden = currentType !== 'client';
  bankDetailsGroup.hidden = true;
  paymentMethodSelect.value = 'card';
  updatePaymentNote();

  subscribeSubmitBtn.disabled = false;
  subscribeSubmitBtn.querySelector('span').textContent = 'Continue to Secure Payment';

  modalOverlay.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  modalOverlay.classList.remove('open');
  document.body.style.overflow = '';
}

modalClose.addEventListener('click', closeModal);
modalOverlay.addEventListener('click', (e) => {
  if (e.target === modalOverlay) closeModal();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && modalOverlay.classList.contains('open')) closeModal();
});

function val(id) {
  const el = document.getElementById(id);
  return el ? el.value.trim() : '';
}

subscribeForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!selectedPlan) return;

  subscribeError.hidden = true;
  subscribeSubmitBtn.disabled = true;
  subscribeSubmitBtn.querySelector('span').textContent = 'Please wait…';

  const paymentMethod = currentType === 'organization' ? paymentMethodSelect.value : 'card';

  const details =
    currentType === 'organization'
      ? {
          idNumber: val('sub-id-number'),
          jobTitle: val('sub-job-title'),
          residentialAddress: val('sub-residential-address'),
          industry: val('sub-industry'),
          workplaceAddress: val('sub-workplace-address'),
          employmentStatus: val('sub-employment-status'),
          ...(paymentMethod === 'debit_order'
            ? {
                bankDetails: {
                  bankName: val('sub-bank-name'),
                  accountHolder: val('sub-account-holder'),
                  accountNumber: val('sub-account-number'),
                  branchCode: val('sub-branch-code'),
                },
              }
            : {}),
        }
      : {
          tradingName: val('sub-trading-name'),
          companyRegNumber: val('sub-company-reg-number'),
          vatNumber: val('sub-vat-number'),
          physicalAddress: val('sub-physical-address'),
          postalAddress: val('sub-postal-address'),
          contactDesignation: val('sub-contact-designation'),
          contactMobile: val('sub-contact-mobile'),
          billingContact: val('sub-billing-contact'),
          billingEmail: val('sub-billing-email'),
          billingPhone: val('sub-billing-phone'),
        };

  const payload = {
    type: currentType,
    planId: selectedPlan.id,
    name: val('sub-name'),
    email: val('sub-email'),
    phone: val('sub-phone'),
    company: val('sub-company'),
    paymentMethod,
    popiaConsent: document.getElementById('sub-popia').checked,
    details,
  };

  try {
    const res = await fetch(`${SUBSCRIBE_API_BASE}/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();

    if (!res.ok) throw new Error(data.error || 'Something went wrong');

    if (data.mode === 'manual') {
      subscribeForm.hidden = true;
      subscribeSuccess.textContent = data.message;
      subscribeSuccess.hidden = false;
      return;
    }

    // Build and submit a hidden form to redirect the browser to
    // PayFast with all required fields (PayFast expects a POST).
    subscribeSubmitBtn.querySelector('span').textContent = 'Redirecting…';
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = data.action;
    Object.entries(data.fields).forEach(([key, value]) => {
      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = key;
      input.value = value;
      form.appendChild(input);
    });
    document.body.appendChild(form);
    form.submit();
  } catch (err) {
    subscribeError.textContent = err.message || 'Could not start checkout. Please try again.';
    subscribeError.hidden = false;
    subscribeSubmitBtn.disabled = false;
    subscribeSubmitBtn.querySelector('span').textContent = 'Continue to Secure Payment';
  }
});

loadPlans();

// ============================================================
// MANUAL FORM UPLOAD — download-and-fill-in-by-hand path
// ============================================================
const formUploadForm = document.getElementById('formUploadForm');
const uploadError = document.getElementById('uploadError');
const uploadSuccess = document.getElementById('uploadSuccess');
const uploadSubmitBtn = document.getElementById('uploadSubmitBtn');

if (formUploadForm) {
  formUploadForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    uploadError.hidden = true;
    uploadSuccess.hidden = true;
    uploadSubmitBtn.disabled = true;
    uploadSubmitBtn.querySelector('span').textContent = 'Uploading…';

    const fileInput = document.getElementById('upload-file');
    const formData = new FormData();
    formData.append('type', document.getElementById('upload-type').value);
    formData.append('name', val('upload-name'));
    formData.append('email', val('upload-email'));
    formData.append('phone', val('upload-phone'));
    if (fileInput.files[0]) formData.append('file', fileInput.files[0]);

    try {
      const res = await fetch(`${SUBSCRIBE_API_BASE}/form-upload`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');

      uploadSuccess.textContent = "Thanks — we've received your form and will be in touch shortly.";
      uploadSuccess.hidden = false;
      formUploadForm.reset();
    } catch (err) {
      uploadError.textContent = err.message || 'Could not upload the file. Please try again.';
      uploadError.hidden = false;
    } finally {
      uploadSubmitBtn.disabled = false;
      uploadSubmitBtn.querySelector('span').textContent = 'Submit Form';
    }
  });
}
