# LLCT Solutions

The full site: the public website (`public/`) and the subscription
API (`server.js` + `src/`) now run as **one Node app**, so there's a
single `npm install`, a single `npm run dev` to test locally, and a
single deploy.

## Project structure

```
llct-solutions/
├── server.js          ← starts everything: serves the site + the API
├── package.json
├── .env.example        ← copy to .env and fill in
├── src/
│   ├── config/plans.js  ← EDIT PRICES HERE
│   ├── lib/              (Supabase + PayFast helpers)
│   └── routes/            (plans, subscribe, payfast notify, form upload)
├── public/               ← the actual website
│   ├── index.html, style.css, script.js, subscribe.js
│   ├── subscribe-success.html, subscribe-cancelled.html
│   └── forms/            (downloadable membership forms — PDF + Word)
└── supabase/schema.sql   ← run this in Supabase's SQL editor
```

## 1. Set your real pricing

Already done for Organization/Client plans in `src/config/plans.js` —
edit there if pricing changes.

## 2. Set up Supabase (free)

1. supabase.com → New project.
2. SQL Editor → paste in all of `supabase/schema.sql` → Run.
3. Storage → New bucket → name it exactly `membership-forms` → Private.
4. Project Settings → API → copy the Project URL and the
   `service_role` secret key (not `anon`).

## 3. Configure environment variables

```
cp .env.example .env
```

Never commit `.env`. It is ignored by Git; add the real values in your
hosting provider's environment settings instead. `render.yaml` defines the
service and marks credential values for manual configuration in Render.

Fill in `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` from step 2. The
PayFast sandbox defaults already in `.env.example` work as-is for
testing — see step 5 for going live.

## 4. Run it locally

```
npm install
npm run dev
```

Open **http://localhost:4000** — that's it, one URL for the whole
site. No second terminal, no separate static server, no CORS setup.

## 5. Going live with PayFast

Sign up at payfast.co.za, verify your business, then in **Settings →
Integration** grab your live `merchant_id`/`merchant_key` and set a
**passphrase** (copy into `PAYFAST_PASSPHRASE`). Switch
`PAYFAST_MODE=live`.

## 6. Deploy (free tier)

Any Node host works — this pushes as a single app:

1. Push this whole `llct-solutions` folder to a GitHub repo.
2. On render.com → New → Web Service → connect the repo.
3. Build command: `npm install` — Start command: `npm start`.
4. Add all the variables from your `.env` in Render's Environment tab.
   Set `APP_URL` to the Render URL Render gives you (e.g.
   `https://llct-solutions.onrender.com`), then redeploy — PayFast's
   `notify_url` is built from it.
5. If you point a custom domain (e.g. llctsolutions.co.za) at this
   service later, update `APP_URL` to that domain instead and
   redeploy.

That's the whole deploy — one service, one URL, serving both the site
and the API.

## Admin dashboard, articles, and email notifications

1. Run the additional `articles` table SQL in `supabase/schema.sql` and create a private Supabase Storage bucket named `articles`.
2. Set `ADMIN_PASSWORD` in `.env` to a strong private password.
3. Set `SMTP_USER=llct.solutions@outlook.com` and `SMTP_PASSWORD` to the Outlook mailbox password or app password. The app uses Outlook SMTP (`smtp-mail.outlook.com`, port 587) and sends new subscriber and article notifications to `llct.solutions@outlook.com`.
4. Start the app and open `http://localhost:4000/admin`.

Admin users can upload text-based PDFs. The server extracts their text, stores the source PDF privately, and publishes the extracted article text in the public Resources section. Scanned/image-only PDFs need OCR before upload because they do not contain selectable text.

## Testing the subscribe flow end-to-end

1. `npm run dev`, open http://localhost:4000.
2. Subscribe section → pick a plan → fill in the form → submit.
3. Card: lands on PayFast's sandbox checkout — use a test card from
   https://developers.payfast.co.za/docs#testing.
   Debit order (organizations only): no redirect — banking details
   are saved for you to action manually.
4. For card payments, PayFast calls back to `/api/payfast/notify` to
   confirm — check Supabase's `subscribers` table for the row's
   `status` flipping to `active`. This callback needs `APP_URL` to be
   publicly reachable, so during local testing it won't fire unless
   you tunnel with something like `ngrok http 4000` and set
   `APP_URL` to the ngrok URL temporarily.

## Manual form uploads

People who download a form, fill it in by hand, and upload the signed
copy land in `form_submissions`, with the file itself in the
`membership-forms` Storage bucket. Supabase dashboard → Storage →
membership-forms → find the path in that row's `file_path` column.

## Debit order subscriptions

PayFast doesn't process bank debit orders directly — only cards/EFT.
So when someone picks "Debit order" for an organization plan, nothing
is charged automatically: their banking details are saved on the
subscriber row (`payment_method: 'debit_order'`, `status:
'pending_debit_order'`, full details in the `details` JSON column) for
you to action the actual debit order setup manually with your bank.

## Notes

- PayFast's sandbox ITN calls come from `sandbox.payfast.co.za`; the
  IP-check in `src/lib/payfast.js` resolves that (or the live
  hostnames) fresh on every request rather than hardcoding IPs, since
  PayFast's IPs can change.
- `cycles: 0` in `src/lib/payfast.js` means subscriptions bill
  indefinitely until the customer cancels. Manage/cancel subscriptions
  from the PayFast merchant dashboard, or build that out later via
  PayFast's subscription API.
