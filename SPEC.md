# CampusFest Bengaluru — Sponsorship Growth Center (SPEC.md)

## 1. Product Goal
Build a full-stack Sponsorship Growth Command Center for **CampusFest Bengaluru** using **Next.js (App Router), TypeScript, Tailwind CSS, Recharts, Supabase (PostgreSQL), and Google Gemini API (`gemini-2.5-flash`)**.

The app must:
1. Load and preserve the exact original **`Sponsor Dataset.xlsx`** in Supabase, with a **"Reset to Baseline"** button so reviewers can always restore original data.
2. Enforce strict data-integrity rules (deduplication, point-in-time IST snapshots, separate entity populations).
3. Allow live CRUD edits (deals, stages, payment receipts, tasks) that persist in Supabase and **immediately recalculate** all dashboard metrics and AI Copilot answers.
4. Provide an **Embedded AI Growth Analyst & Copilot** powered by server-side **function calling** (never dump raw tables into a prompt or let the LLM guess math).

---

## 2. Database Schema (Supabase PostgreSQL)
Seed all tables directly from `Sponsor Dataset.xlsx` (deduplicating exact duplicate source IDs on load, while also storing a `raw_duplicates_removed` count in metadata so the Copilot can report it):

1. `event_meta` — `event_name`, `history_start`, `history_end`, `event_starts_at`, `event_ends_at`, `timezone`, `currency`, `fictional`.
2. `targets` — `effective_at`, `qualified_brands_goal`, `confirmed_partnerships_goal`, `target_version`.
3. `brands` — `brand_id` (PK), `brand_name`, `industry`, `owner_id`, `owner_name`, `created_at`.
4. `contacts` — `contact_id` (PK), `contact_name`, `job_title`, `brand_id` (FK), `brand_name`, `created_at`.
5. `sponsor_campaigns` — `sponsor_campaign_id` (PK), `campaign_name`, `channel` (`email`|`linkedin`|`introduction`|`web_inbound`), `objective`, `audience`, `owner_id`, `owner_name`, `planned_start_at`, `planned_end_at`.
6. `sponsor_interactions` — `interaction_id` (PK, deduplicated), `attempt_id`, `origin_interaction_id`, `brand_id`, `contact_id`, `sponsor_campaign_id`, `owner_id`, `interaction_type`, `occurred_at`, `outcome`, etc. (exact columns from sheet).
7. `brand_qualification_history` — `history_id` (PK, deduplicated), `brand_id`, `sponsor_campaign_id`, `qualification_status`, `effective_at`.
8. `partner_opportunities` — `opportunity_id` (PK), `brand_id`, `primary_contact_id`, `sponsor_campaign_id`, `deal_type` (`cash`|`in_kind`), `reported_value_inr`, `cash_collected_inr` (nullable numeric — `NULL` for all original source rows to preserve the "reported INR is not bank receipt" rule; editable by users for live tracking), `created_at`.
9. `opportunity_history` — `history_id` (PK, deduplicated), `opportunity_id`, `brand_id`, `owner_id`, `stage`, `effective_at`.
10. `sponsor_activations` — `activation_id` (PK), `brand_id`, `opportunity_id`, `attendee_campaign_id`, `linked_at`, `plan_approved` (boolean, default false).
11. `growth_tasks` (App Execution Table) — `task_id` (UUID PK), `title`, `description`, `owner_name`, `status` (`todo`|`in_progress`|`done`), `priority` (`high`|`medium`|`low`), `due_date`, `linked_brand_id` (nullable), `linked_opportunity_id` (nullable), `source` (`manual`|`copilot`), `created_at`.

---

## 3. Non-Negotiable Analytics & Data Integrity Rules (Server-Side `lib/metrics.ts`)
Both the Dashboard API and the AI Copilot MUST call the exact same deterministic functions in `lib/metrics.ts`:

1. **Deduplication:** Deduplicate on stable IDs (`interaction_id`, `history_id`). Exact baseline has 6 duplicate rows removed: `SI00001`, `SI00019`, `SI00110`, `BQ0003`, `OH00001`, `OH00015`.
2. **Point-in-Time Snapshot (`as_of_date`, default `2025-04-20`):**
   - Treat `as_of_date` as `23:59:59+05:30` (Asia/Kolkata).
   - For `brand_qualification_history` and `opportunity_history`, select ONLY the **latest version** per entity with `effective_at <= cutoff`. Never sum history rows. Never leak future stage changes into earlier dates.
   - Use the `targets` version in force on `as_of_date` (Launch plan 40/20 before `2025-03-15 09:00 IST`; Revised plan 55/28 after).
3. **Separate Populations (Never Mix):**
   - `attempts` (source touches: 370 baseline), `unique_contacts_touched` (202), `responding_brands` (109), `positive_reply_brands` (74), `qualified_brands` (60), `opportunities` (58), `confirmed_opportunities` (24).
   - Confirmed goal counts **opportunities**, not brands (e.g., Beardo has 2 opportunities: `O001` confirmed, `O002` lost).
   - `O006` was confirmed on 25 Feb and withdrawn on 20 Mar — must appear confirmed on `2025-02-28` and withdrawn on `2025-04-20`.
4. **Verified Baseline Checksums (as of `2025-04-20`):**
   - Qualified brands: `60` (Target: `55`)
   - Confirmed partnerships: `24` (Target: `28`), Reported Value: `₹22,40,000` (`₹20,00,000` cash across 20 deals + `₹2,40,000` in-kind across 4 deals)
   - Email + LinkedIn confirmed deals: `0` (from 322 attempts); Introductions + Web Inbound: `24` deals (17 + 7)
   - Unqualified positive replies: `14` brands; Brands with opportunities but not qualified: `15`.

---

## 4. UI Architecture (Clean, Executive, 3 Main Tabs + Persistent Copilot Drawer)
Include a top header bar with: **Date Snapshot Picker** (`as_of_date`), **Reset to Baseline Data** button, and **Open AI Copilot** toggle.

### Tab 1: Executive Funnel & Diagnostics
- **4 Hero KPI Cards:** Qualified Brands (vs. Target), Confirmed Deals (vs. Target), Reported Deal Value (Cash vs. In-Kind split), **Verified Cash Collected** (clearly flagging `"Not recorded in source data"` when `NULL`, and updating live when users log receipts).
- **Funnel Chart (Recharts):** Brands → Contacted → Responding → Qualified → Opportunities → Confirmed, with step conversion rates.
- **Channel Performance Table:** `email`, `linkedin`, `introduction`, `web_inbound` showing Attempts, Reply %, Positive Reply %, Qualified, Confirmed Deals, Reported Value, and a bold diagnostic callout (*"87% outbound effort = ₹0; 13% warm effort = 100% of deals"*).
- **Industry & Concentration Breakdown:** Bar/donut chart showing share by industry and largest single sponsor share (flagging >30% concentration risk).

### Tab 2: Pipeline, Campaigns & Execution (Editable — Persists to Supabase)
- **Interactive Opportunities Table:** Filter by stage/channel/owner. Users can:
  - **Add New Opportunity**
  - **Change Stage** (appends a new row to `opportunity_history` with current/selected timestamp so snapshot history stays intact!)
  - **Log Cash Collected (₹)** (updates `cash_collected_inr` and immediately updates Hero KPI + Advance Collection signal)
- **Tasks & Action Items Board:** Create, edit, assign owner, set due date, and toggle status (`todo` / `in_progress` / `done`). Shows a badge for tasks created by the AI Copilot.

### Tab 3: Strategy Bets & Early Warning System
- **5 Ranked Bets Tracker (from Slide 2):** Displays the 5 CampusFest Bengaluru bets with RICE scores, Base/Stretch targets (₹27.2L / ₹63.4L), and Double Down / Cap / Kill badges.
- **5-Signal Early Warning Monitor (from Slide 3):** Live traffic-light cards (Green / Amber / Red) computed from live DB data:
  1. Qualified Meeting Rate (`<30%` Red, requires `n >= 10`)
  2. Proposal → Negotiation Rate (`<25%` Red)
  3. Advance Collection Rate (`<70%` of due Amber/Red, or `"No bank receipt data"` if unlogged)
  4. Sponsor Concentration (`>30%` Amber, `>40%` Red)
  5. Activation Readiness (Unapproved plans at T-14)
  - Plus **48-Hour Qualification SLA Monitor** listing the 14 positive-reply brands never qualified, with a 1-click **"Assign Follow-up Task"** action.

---

## 5. Embedded AI Growth Analyst & Copilot (`app/api/copilot/route.ts`)
- Model: **`gemini-2.5-flash`** via `@google/genai` SDK using **Function Calling**.
- **Server-Side Tools (all query live Supabase via `lib/metrics.ts`):**
  1. `get_snapshot_summary(as_of_date?: string)` — returns targets, funnel counts, confirmed value, cash vs. in-kind, and verified cash collected.
  2. `get_channel_and_campaign_performance(as_of_date?: string)` — returns channel & campaign breakdown.
  3. `diagnose_bottlenecks(as_of_date?: string)` — returns stalled negotiations, unqualified positive replies, withdrawn deals (`O006`), and breached Early Warning thresholds.
  4. `query_opportunities(stage?: string, industry?: string, brand_name?: string)` — lists matching opportunities with IDs, values, owners, and stages.
  5. `list_tasks(status?: string)` — returns current tasks in `growth_tasks`.
  6. `propose_create_task(title: string, owner_name: string, due_date: string, priority: string, reason: string, linked_brand_id?: string)` — **DOES NOT write immediately.** Returns a structured action card to the chat UI with **Confirm & Create Task** / **Cancel** buttons. Clicking Confirm writes to `growth_tasks` via `POST /api/tasks` and refreshes the UI.
- **Strict System Prompt Guardrails (Honest Uncertainty):**
  - Always cite exact IDs (`brand_id`, `opportunity_id`, `sponsor_campaign_id`) and the `as_of_date` used.
  - NEVER invent numbers. Every metric must come from a tool call.
  - **Mandatory "Data Cannot Answer" Rules:**
    - If asked for **actual bank receipts / cash collected** on original source deals where `cash_collected_inr` is `NULL`: explicitly state that reported INR values in the source dataset are not proof of bank receipt, and distinguish between reported cash deals (₹20L) and logged receipts.
    - If asked for **marketing spend, CAC, or channel ROI**: explicitly state that the source dataset records no spend figures, so ROI/CAC cannot be computed.
    - If asked whether **Partner Activations caused attendee uplift**: explicitly state that activation links (`Beardo`, `Mosaic Mobility`, `Maple Devices`) are observational associations linked 1–2 days post-confirmation and do not establish causal uplift.
    - Note that `Beardo` and all records are fictional/synthetic if asked about real-world company claims.