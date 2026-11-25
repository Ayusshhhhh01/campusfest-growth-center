-- CampusFest Bengaluru — Sponsorship Growth Center
-- Supabase PostgreSQL Schema (SPEC.md Section 2)
-- Paste and run this script in the Supabase SQL Editor.

-- Enable pgcrypto for gen_random_uuid() if not already enabled
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Event Metadata (includes deduplication audit fields)
CREATE TABLE IF NOT EXISTS event_meta (
  id integer PRIMARY KEY DEFAULT 1,
  event_name text NOT NULL,
  history_start date NOT NULL,
  history_end date NOT NULL,
  event_starts_at timestamptz NOT NULL,
  event_ends_at timestamptz NOT NULL,
  timezone text NOT NULL DEFAULT 'Asia/Kolkata',
  currency text NOT NULL DEFAULT 'INR',
  fictional boolean NOT NULL DEFAULT true,
  raw_duplicates_removed integer NOT NULL DEFAULT 0,
  duplicate_ids_removed text[] NOT NULL DEFAULT '{}'
);

-- 2. Targets (versioned goals effective at specific IST timestamps)
CREATE TABLE IF NOT EXISTS targets (
  id serial PRIMARY KEY,
  effective_at timestamptz NOT NULL,
  qualified_brands_goal integer NOT NULL,
  confirmed_partnerships_goal integer NOT NULL,
  target_version text NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_targets_effective_at ON targets (effective_at DESC);

-- 3. Brands
CREATE TABLE IF NOT EXISTS brands (
  brand_id text PRIMARY KEY,
  brand_name text NOT NULL,
  industry text NOT NULL,
  owner_id text NOT NULL,
  owner_name text NOT NULL,
  created_at timestamptz NOT NULL
);

-- 4. Contacts
CREATE TABLE IF NOT EXISTS contacts (
  contact_id text PRIMARY KEY,
  contact_name text NOT NULL,
  job_title text NOT NULL,
  brand_id text NOT NULL REFERENCES brands(brand_id) ON DELETE CASCADE,
  brand_name text NOT NULL,
  created_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_contacts_brand_id ON contacts (brand_id);

-- 5. Sponsor Campaigns
CREATE TABLE IF NOT EXISTS sponsor_campaigns (
  sponsor_campaign_id text PRIMARY KEY,
  campaign_name text NOT NULL,
  channel text NOT NULL CHECK (channel IN ('email', 'linkedin', 'introduction', 'web_inbound')),
  objective text,
  audience text,
  owner_id text NOT NULL,
  owner_name text NOT NULL,
  planned_start_at timestamptz,
  planned_end_at timestamptz,
  created_at timestamptz
);

-- 6. Sponsor Interactions (deduplicated on interaction_id)
CREATE TABLE IF NOT EXISTS sponsor_interactions (
  interaction_id text PRIMARY KEY,
  attempt_id text NOT NULL,
  origin_interaction_id text,
  brand_id text NOT NULL REFERENCES brands(brand_id) ON DELETE CASCADE,
  brand_name text NOT NULL,
  contact_id text REFERENCES contacts(contact_id) ON DELETE SET NULL,
  contact_name text,
  sponsor_campaign_id text NOT NULL REFERENCES sponsor_campaigns(sponsor_campaign_id) ON DELETE CASCADE,
  campaign_name text,
  channel text NOT NULL CHECK (channel IN ('email', 'linkedin', 'introduction', 'web_inbound')),
  owner_id text,
  event_type text NOT NULL,
  outcome text NOT NULL,
  summary text,
  occurred_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_interactions_occurred_at ON sponsor_interactions (occurred_at);
CREATE INDEX IF NOT EXISTS idx_interactions_brand_id ON sponsor_interactions (brand_id);
CREATE INDEX IF NOT EXISTS idx_interactions_attempt_id ON sponsor_interactions (attempt_id);
CREATE INDEX IF NOT EXISTS idx_interactions_campaign_id ON sponsor_interactions (sponsor_campaign_id);

-- 7. Brand Qualification History (deduplicated on history_id)
CREATE TABLE IF NOT EXISTS brand_qualification_history (
  history_id text PRIMARY KEY,
  brand_id text NOT NULL REFERENCES brands(brand_id) ON DELETE CASCADE,
  brand_name text NOT NULL,
  sponsor_campaign_id text REFERENCES sponsor_campaigns(sponsor_campaign_id) ON DELETE SET NULL,
  source_campaign_name text,
  qualification_status text NOT NULL CHECK (qualification_status IN ('unreviewed', 'engaged', 'qualified', 'unqualified', 'dormant')),
  reason text,
  effective_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_bqh_brand_effective ON brand_qualification_history (brand_id, effective_at DESC);

-- 8. Partner Opportunities (cash_collected_inr stays NULL for all original source rows)
CREATE TABLE IF NOT EXISTS partner_opportunities (
  opportunity_id text PRIMARY KEY,
  opportunity_name text NOT NULL,
  brand_id text NOT NULL REFERENCES brands(brand_id) ON DELETE CASCADE,
  brand_name text NOT NULL,
  primary_contact_id text REFERENCES contacts(contact_id) ON DELETE SET NULL,
  primary_contact_name text,
  sponsor_campaign_id text REFERENCES sponsor_campaigns(sponsor_campaign_id) ON DELETE SET NULL,
  originating_campaign_name text,
  deal_type text NOT NULL CHECK (deal_type IN ('cash', 'in_kind')),
  reported_value_inr numeric NOT NULL DEFAULT 0,
  cash_collected_inr numeric NULL,
  created_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_opps_brand_id ON partner_opportunities (brand_id);
CREATE INDEX IF NOT EXISTS idx_opps_created_at ON partner_opportunities (created_at);

-- 9. Opportunity History (deduplicated on history_id)
CREATE TABLE IF NOT EXISTS opportunity_history (
  history_id text PRIMARY KEY,
  opportunity_id text NOT NULL REFERENCES partner_opportunities(opportunity_id) ON DELETE CASCADE,
  opportunity_name text,
  brand_id text NOT NULL REFERENCES brands(brand_id) ON DELETE CASCADE,
  brand_name text,
  owner_id text,
  owner_name text,
  stage text NOT NULL CHECK (stage IN ('prospecting', 'contacted', 'proposal_sent', 'negotiating', 'partner_confirmed', 'lost', 'withdrawn')),
  proposed_value_inr numeric NOT NULL DEFAULT 0,
  confirmed_value_inr numeric NOT NULL DEFAULT 0,
  effective_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_oh_opp_effective ON opportunity_history (opportunity_id, effective_at DESC);

-- 10. Sponsor Activations
CREATE TABLE IF NOT EXISTS sponsor_activations (
  activation_id text PRIMARY KEY,
  brand_id text NOT NULL REFERENCES brands(brand_id) ON DELETE CASCADE,
  brand_name text,
  opportunity_id text NOT NULL REFERENCES partner_opportunities(opportunity_id) ON DELETE CASCADE,
  opportunity_name text,
  attendee_campaign_id text NOT NULL,
  attendee_campaign_name text,
  activation_note text,
  linked_at timestamptz NOT NULL,
  plan_approved boolean NOT NULL DEFAULT false
);

-- 11. Growth Tasks (App Execution Table)
CREATE TABLE IF NOT EXISTS growth_tasks (
  task_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  owner_name text NOT NULL,
  status text NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'done')),
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low')),
  due_date date,
  linked_brand_id text REFERENCES brands(brand_id) ON DELETE SET NULL,
  linked_opportunity_id text REFERENCES partner_opportunities(opportunity_id) ON DELETE SET NULL,
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'copilot')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_growth_tasks_status ON growth_tasks (status);

-- Ensure API roles can access all tables & sequences (avoids 42501 permission denied)
ALTER TABLE event_meta DISABLE ROW LEVEL SECURITY;
ALTER TABLE targets DISABLE ROW LEVEL SECURITY;
ALTER TABLE brands DISABLE ROW LEVEL SECURITY;
ALTER TABLE contacts DISABLE ROW LEVEL SECURITY;
ALTER TABLE sponsor_campaigns DISABLE ROW LEVEL SECURITY;
ALTER TABLE sponsor_interactions DISABLE ROW LEVEL SECURITY;
ALTER TABLE brand_qualification_history DISABLE ROW LEVEL SECURITY;
ALTER TABLE partner_opportunities DISABLE ROW LEVEL SECURITY;
ALTER TABLE opportunity_history DISABLE ROW LEVEL SECURITY;
ALTER TABLE sponsor_activations DISABLE ROW LEVEL SECURITY;
ALTER TABLE growth_tasks DISABLE ROW LEVEL SECURITY;

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
