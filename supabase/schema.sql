-- Run this once in the Supabase SQL editor for your project.
-- (If you already ran an earlier version of this file, drop the
-- tables first — `drop table if exists subscribers, form_submissions;`
-- — before re-running this, since Postgres won't let you silently
-- change a check constraint on an existing table.)

-- ============================================================
-- SUBSCRIBERS — people/companies who subscribed via the online
-- checkout flow (card via PayFast, or debit order captured for
-- manual setup).
-- ============================================================
create table if not exists subscribers (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('organization', 'client')),
  plan_id text not null,
  name text not null,
  email text not null,
  phone text,
  company text,
  payment_method text not null default 'card' check (payment_method in ('card', 'debit_order')),
  popia_consent boolean not null default false,
  -- Everything from the membership application forms that isn't a
  -- core field above (ID number, addresses, industry, employment
  -- status, banking details for debit order, etc). Kept as JSON so
  -- the form can evolve without a schema migration each time.
  details jsonb,
  status text not null default 'pending'
    check (status in ('pending', 'active', 'cancelled', 'pending_debit_order')),
  pf_token text,
  pf_payment_id text,
  last_payment_status text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists subscribers_email_idx on subscribers (email);
create index if not exists subscribers_status_idx on subscribers (status);

-- ============================================================
-- FORM SUBMISSIONS — people who downloaded a form, filled it in
-- by hand, and uploaded the signed copy through the site instead
-- of subscribing online.
-- ============================================================
create table if not exists form_submissions (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('organization', 'client')),
  name text not null,
  email text not null,
  phone text,
  file_path text not null, -- path within the 'membership-forms' storage bucket
  created_at timestamptz not null default now()
);

create index if not exists form_submissions_email_idx on form_submissions (email);

-- Row Level Security: both tables are only ever written to by the
-- backend using the service_role key, which bypasses RLS. Enabling
-- RLS with no policies means the anon/public key can't read or write
-- them at all, which is what we want.
alter table subscribers enable row level security;
alter table form_submissions enable row level security;

-- ============================================================
-- ARTICLES — PDF-backed articles with extracted text for the
-- public reader. Only the backend service role can write/read rows.
-- ============================================================
create table if not exists articles (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  summary text not null,
  content text not null,
  pdf_path text not null,
  published boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists articles_published_idx on articles (published, created_at desc);
alter table articles enable row level security;

-- ============================================================
-- STORAGE — create a bucket for uploaded signed forms.
-- Do this in the Supabase dashboard (Storage tab) rather than SQL:
--   1. Storage > New bucket > name it exactly: membership-forms
--   2. Set it to PRIVATE (not public) — the backend uses the
--      service_role key to read/write it regardless of this
--      setting, and you don't want signed PDFs with people's
--      banking details publicly listable.
--
-- Also create a private bucket named `articles` for source PDFs.
-- ============================================================
