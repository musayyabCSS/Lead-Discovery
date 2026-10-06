/*
# Lead Discovery — Schema & Seed Data

## Overview
Creates the full data model for the Lead Discovery internal tool: ICP configs,
discovery runs, signals, and leads. Seeds two ICP configs (CSS and Med Bills).

## New Tables

### icp_configs
- id (uuid PK)
- name (text) — display name for the ICP config
- owner_business (text) — "CSS" or "Med Bills"
- target_verticals (text[]) — list of target verticals
- exclusions (text[]) — list of exclusion criteria
- company_size_stage (text) — company size/stage description
- kdm_titles (text[]) — key decision-maker titles
- geography (text) — geographic targeting
- signal_rotation (jsonb) — day-of-week to signal type map
- email_requirement (text) — email verification requirement text
- scoring_bands (jsonb) — scoring band thresholds
- is_active (bool, default true)
- created_at (timestamptz, default now())

### runs
- id (uuid PK)
- icp_config_id (uuid FK -> icp_configs.id)
- triggered_by (text) — "manual" or "scheduled"
- status (text) — "running" | "complete" | "failed"
- started_at (timestamptz)
- finished_at (timestamptz, nullable)
- leads_found (int, default 0)
- leads_qualified (int, default 0)

### signals
- id (uuid PK)
- run_id (uuid FK -> runs.id)
- signal_type (text)
- source_url (text)
- raw_snippet (text)
- discovered_company_name (text)
- created_at (timestamptz, default now())

### leads
- id (uuid PK)
- run_id (uuid FK -> runs.id)
- icp_config_id (uuid FK -> icp_configs.id)
- company_name (text)
- contact_name (text)
- contact_title (text)
- email (text)
- email_verified (bool)
- email_verification_status (text)
- source_signal_id (uuid FK -> signals.id)
- confidence_score (int)
- score_reasoning (text)
- qualification_status (text) — "pending_review" | "approved" | "rejected" | "duplicate"
- reviewed_by (text, nullable)
- reviewed_at (timestamptz, nullable)
- exported_to_sheet (bool, default false)
- created_at (timestamptz, default now())

## Security
- RLS enabled on all tables.
- This is an internal tool for 2-3 named users behind Supabase Auth.
- All tables use `TO authenticated` with `USING (true)` / `WITH CHECK (true)`
  because every authenticated user is a trusted internal operator who should
  see and manage all lead discovery data. There is no per-user data isolation —
  all authenticated users share the same dataset.

## Seed Data
- Two ICP configs inserted: "CSS" and "Med Bills" with exact field values.
*/

-- ============================================================
-- icp_configs
-- ============================================================
CREATE TABLE IF NOT EXISTS icp_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  owner_business text NOT NULL CHECK (owner_business IN ('CSS', 'Med Bills')),
  target_verticals text[] NOT NULL DEFAULT '{}',
  exclusions text[] NOT NULL DEFAULT '{}',
  company_size_stage text NOT NULL DEFAULT '',
  kdm_titles text[] NOT NULL DEFAULT '{}',
  geography text NOT NULL DEFAULT '',
  signal_rotation jsonb NOT NULL DEFAULT '{}'::jsonb,
  email_requirement text NOT NULL DEFAULT '',
  scoring_bands jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE icp_configs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "icp_select_authenticated" ON icp_configs;
CREATE POLICY "icp_select_authenticated" ON icp_configs FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "icp_insert_authenticated" ON icp_configs;
CREATE POLICY "icp_insert_authenticated" ON icp_configs FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "icp_update_authenticated" ON icp_configs;
CREATE POLICY "icp_update_authenticated" ON icp_configs FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "icp_delete_authenticated" ON icp_configs;
CREATE POLICY "icp_delete_authenticated" ON icp_configs FOR DELETE
  TO authenticated USING (true);

-- ============================================================
-- runs
-- ============================================================
CREATE TABLE IF NOT EXISTS runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  icp_config_id uuid NOT NULL REFERENCES icp_configs(id) ON DELETE CASCADE,
  triggered_by text NOT NULL DEFAULT 'manual' CHECK (triggered_by IN ('manual', 'scheduled')),
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'complete', 'failed')),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  leads_found integer NOT NULL DEFAULT 0,
  leads_qualified integer NOT NULL DEFAULT 0
);

ALTER TABLE runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "runs_select_authenticated" ON runs;
CREATE POLICY "runs_select_authenticated" ON runs FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "runs_insert_authenticated" ON runs;
CREATE POLICY "runs_insert_authenticated" ON runs FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "runs_update_authenticated" ON runs;
CREATE POLICY "runs_update_authenticated" ON runs FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "runs_delete_authenticated" ON runs;
CREATE POLICY "runs_delete_authenticated" ON runs FOR DELETE
  TO authenticated USING (true);

-- ============================================================
-- signals
-- ============================================================
CREATE TABLE IF NOT EXISTS signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  signal_type text NOT NULL DEFAULT '',
  source_url text NOT NULL DEFAULT '',
  raw_snippet text NOT NULL DEFAULT '',
  discovered_company_name text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE signals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "signals_select_authenticated" ON signals;
CREATE POLICY "signals_select_authenticated" ON signals FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "signals_insert_authenticated" ON signals;
CREATE POLICY "signals_insert_authenticated" ON signals FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "signals_update_authenticated" ON signals;
CREATE POLICY "signals_update_authenticated" ON signals FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "signals_delete_authenticated" ON signals;
CREATE POLICY "signals_delete_authenticated" ON signals FOR DELETE
  TO authenticated USING (true);

-- ============================================================
-- leads
-- ============================================================
CREATE TABLE IF NOT EXISTS leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  icp_config_id uuid NOT NULL REFERENCES icp_configs(id) ON DELETE CASCADE,
  company_name text NOT NULL DEFAULT '',
  contact_name text NOT NULL DEFAULT '',
  contact_title text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  email_verified boolean NOT NULL DEFAULT false,
  email_verification_status text NOT NULL DEFAULT 'unverified',
  source_signal_id uuid REFERENCES signals(id) ON DELETE SET NULL,
  confidence_score integer NOT NULL DEFAULT 0,
  score_reasoning text NOT NULL DEFAULT '',
  qualification_status text NOT NULL DEFAULT 'pending_review' CHECK (qualification_status IN ('pending_review', 'approved', 'rejected', 'duplicate')),
  reviewed_by text,
  reviewed_at timestamptz,
  exported_to_sheet boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "leads_select_authenticated" ON leads;
CREATE POLICY "leads_select_authenticated" ON leads FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "leads_insert_authenticated" ON leads;
CREATE POLICY "leads_insert_authenticated" ON leads FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "leads_update_authenticated" ON leads;
CREATE POLICY "leads_update_authenticated" ON leads FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "leads_delete_authenticated" ON leads;
CREATE POLICY "leads_delete_authenticated" ON leads FOR DELETE
  TO authenticated USING (true);

-- ============================================================
-- Indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_runs_icp_config_id ON runs(icp_config_id);
CREATE INDEX IF NOT EXISTS idx_runs_status ON runs(status);
CREATE INDEX IF NOT EXISTS idx_signals_run_id ON signals(run_id);
CREATE INDEX IF NOT EXISTS idx_leads_run_id ON leads(run_id);
CREATE INDEX IF NOT EXISTS idx_leads_icp_config_id ON leads(icp_config_id);
CREATE INDEX IF NOT EXISTS idx_leads_qualification_status ON leads(qualification_status);
CREATE INDEX IF NOT EXISTS idx_leads_source_signal_id ON leads(source_signal_id);

-- ============================================================
-- Seed Data: ICP Configs
-- ============================================================
INSERT INTO icp_configs (name, owner_business, target_verticals, exclusions, company_size_stage, kdm_titles, geography, signal_rotation, email_requirement, scoring_bands, is_active)
VALUES
(
  'CSS',
  'CSS',
  ARRAY['eCommerce/DTC', 'SaaS (<$5M ARR)', 'Logistics/Freight Tech', 'Consumer Hardware', 'Health/Wellness Products'],
  ARRAY['Series B+', '50+ employees', 'existing Head of Support', 'non-Five-Eyes HQ with no US operations'],
  'Privately held, 5-50 employees',
  ARRAY['Founder', 'CEO', 'COO', 'Head of Ops', 'VP Customer Success'],
  'US, Five Eyes secondary',
  '{"mon": "funding", "tue": "hiring", "wed": "reviews", "thu": "expansion", "fri": "mixed"}'::jsonb,
  'Verified personal email, no exceptions',
  '{"strong": [9, 10], "qualified": [7, 8], "reject_below": 7}'::jsonb,
  true
),
(
  'Med Bills',
  'Med Bills',
  ARRAY['Urgent care', 'Dermatology', 'Podiatry', 'Rheumatology', 'Family/internal medicine', 'Ophthalmology/optometry', 'Functional medicine', 'DSMT/nutrition counseling', 'Specialty clinics', 'CHCs/FQHCs', 'Behavioral health'],
  ARRAY['Dental', 'Audiology', 'Pharmacies', 'Labs', 'DME', 'Staffing agencies', 'Hospital-owned groups', 'Health-tech startups', '200+ employee companies'],
  '$1-3M revenue band',
  ARRAY['Practice owner/administrator', 'Office manager', 'Billing manager'],
  'Priority states: CA, PA, WY, TX, FL, NY, NJ, MD, VA',
  '{"mon": "front-desk hiring", "tue": "billing-pain reviews", "wed": "biller/scribe hiring", "thu": "multi-location", "fri": "CHC/FQHC/specialty"}'::jsonb,
  'Verified personal email required; narrow exception for very small solo practices using a generic inbox found directly on their own site',
  '{"strong": [9, 10], "qualified": [7, 8], "borderline": [6, 6], "reject_below": 6}'::jsonb,
  true
)
ON CONFLICT DO NOTHING;