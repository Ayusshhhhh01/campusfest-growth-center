# CampusFest Bengaluru — Sponsorship Growth Center

**Live Demo:** https://campusfest-growth-center-fd98.vercel.app/

A full-stack Sponsorship Growth Command Center built for **CampusFest Bengaluru 2025** with **Next.js (App Router, TypeScript, Tailwind CSS), Recharts, Supabase (PostgreSQL), and Google Gemini API Function Calling**.

---

## 1. Executive Overview & Growth Thesis

CampusFest 2025 (Bengaluru, 12–13 April 2025) closed its sponsorship window with **60 qualified brands** (beating the revised goal of 55) but **24 confirmed partnerships** (missing the revised goal of 28), representing **₹22,40,000** in reported contract value (`₹20,00,000` cash across 20 deals + `₹2,40,000` in-kind across 4 deals).

- **Core Growth Thesis:** Sponsorship conversion is 100% driven by warm pathways (`introduction` + `web_inbound`), yet 87.0% of outreach effort (322 cold email + LinkedIn attempts) produced **₹0** in net confirmed revenue by 20 April 2025.
- **Pre-Fest Cash Target Envelope:** **₹27.2L Base** / **₹63.4L Stretch** incremental sponsorship targets across 5 RICE-prioritized strategic bets, enforced by a 5-signal Early Warning System and 48-hour Qualification SLA Monitor.
- **Live & Resettable Demo:** Every deal edit, stage transition, cash receipt log, activation approval, and growth task persists directly to Supabase PostgreSQL and immediately recalculates all dashboard KPIs and AI Copilot answers—with a 1-click **Reset to Baseline** button restoring `Sponsor Dataset.xlsx` cleanly.

---

## 2. Data Audit: Sourced Facts vs. Model Assumptions

To prevent executive decision errors, the system strictly separates verifiable facts in `Sponsor Dataset.xlsx` from strategic planning assumptions.

### Sourced Facts (`Sponsor Dataset.xlsx`, 15 Jan – 20 Apr 2025 IST)
- **Exact Import Retry Deduplication:** 6 exact duplicate source IDs removed on load (`SI00001`, `SI00019`, `SI00110` in `sponsor_interactions`; `BQ0003` in `brand_qualification_history`; `OH00001`, `OH00015` in `opportunity_history`), yielding 950 interactions, 433 qualification versions, and 228 opportunity history versions.
- **Channel Asymmetry (`2025-04-20`):**
  - **Outbound (`email` + `linkedin`):** 322 attempts (`87.0%` of effort) → **0 confirmed deals (`₹0`)**.
  - **Warm (`introduction` + `web_inbound`):** 48 attempts (`13.0%` of effort) → **24 confirmed deals (`₹22,40,000`)** (`17` from introductions = `₹15,70,000`; `7` from web inbound = `₹6,70,000`).
- **Point-in-Time Reversal (`O006`):** Opportunity `O006` (LinkedIn) was confirmed on `2025-02-25` (`₹80,000`) and appears as `partner_confirmed` on `2025-02-28`, then transitioned to `withdrawn` on `2025-03-20`.
- **Target Plan Shift:** `Sponsor launch plan` (`40` qualified / `20` confirmed) was active prior to `2025-03-15 09:00 IST`; `Sponsor revised plan` (`55` qualified / `28` confirmed) took effect on `2025-03-15 09:00 IST`.
- **Pipeline Leakage:** `14` brands replied positively without ever reaching `qualified` status; `15` brands have opportunities without being `qualified`; `8` opportunities remain in `negotiating` as of `2025-04-20`.
- **Concentration:** Largest single sponsor at baseline is `Beardo` (`A001`, `O001` confirmed `₹2,00,000`, `O002` lost) at `8.9%` of total confirmed value.
- **Missing Financial / Causal Fields:** `cash_collected_inr` is `NULL` for all baseline source rows; no marketing spend or CAC figures exist in the workbook; the 3 `sponsor_activations` (`L001` Beardo, `L002` Mosaic Mobility, `L003` Maple Devices) record post-confirmation associations and not causal attendee uplift.

### Model Assumptions (Strategy & Early Warning Layer)
- **Base / Stretch Cash Targets (`₹27.2L` / `₹63.4L`):** Planning envelopes modeled across the 5 ranked bets assuming SDR reallocation from cold email (`SC01`/`SC06`) to warm referrals (`SC02`/`SC05`), web inbound fast-track (`SC04`), and 48h SLA rescue.
- **RICE Scoring Inputs:** Reach, Impact, Confidence, and Effort scores reflect team capacity assumptions for CampusFest Bengaluru.
- **Early Warning Thresholds:** Qualified Meeting Rate `<30%` Red (`n >= 10`), Proposal → Negotiation `<25%` Red, Advance Collection `<70%` Amber/Red (or `"No bank receipt data"` when unlogged), Sponsor Concentration `>30%` Amber / `>40%` Red, and unapproved activations at `T-14` Red.

---

## 3. Funnel Calculations & RICE Prioritization Framework

### Separate-Population Funnel (`2025-04-20` Baseline)
Touches, contacts, brands, and opportunities are never mixed or summed across history versions:

| Stage / Population | Baseline Count (`2025-04-20`) | Step Conversion / Integrity Rule |
| :--- | :---: | :--- |
| Outreach Attempts | `370` | Distinct `attempt_id` (`268` email, `54` LinkedIn, `30` intro, `18` web inbound) |
| Unique Contacts Touched | `202` | Distinct `contact_id` across `sponsor_interactions` |
| Total / Contacted Brands | `180` / `180` | Distinct `brand_id` created / touched `<= cutoff` |
| Responding Brands | `109` (`60.6%`) | Distinct `brand_id` with `event_type = 'replied'` |
| Positive Reply Brands | `74` | Distinct `brand_id` with `outcome = 'positive'` |
| Qualified Brands | `60` (`55.0%` of responding) | Latest `brand_qualification_history` version `<= cutoff` (Goal: `55`) |
| Opportunities | `58` | Distinct `opportunity_id` created `<= cutoff` (e.g., Beardo has `O001` + `O002`) |
| Confirmed Partnerships | `24` (`41.4%` of opps) | Latest `opportunity_history` stage = `partner_confirmed` (Goal: `28`) |

### 5 Ranked Bets (RICE = `(Reach × Impact × Confidence) / Effort`)

| Rank | Bet / Lever | Decision | RICE | Base Target | Stretch Target |
| :---: | :--- | :---: | :---: | :---: | :---: |
| **#1** | Warm Partner & Creator Network Introductions (`SC02`, `SC05`) | **Double Down** | `92` | `₹14.0L` | `₹30.0L` |
| **#2** | Web Inbound Partner Interest Fast-Track (`SC04`) | **Double Down** | `84` | `₹6.5L` | `₹15.0L` |
| **#3** | 48-Hour Qualification SLA & Stalled Deal Rescue | **Double Down** | `76` | `₹5.2L` | `₹13.4L` |
| **#4** | LinkedIn Executive Outreach (`SC03`) | **Cap** | `34` | `₹1.5L` | `₹5.0L` |
| **#5** | Cold Email Volume Blasts (`SC01`, `SC06`) | **Kill** | `12` | `₹0.0L` | `₹0.0L` |
| — | **Total Incremental Target Envelope** | — | — | **`₹27.2L`** | **`₹63.4L`** |

---

## 4. Architecture & Data Integrity Guarantees

1. **IST Point-in-Time Snapshots (`Asia/Kolkata`):** Every `as_of_date` resolves to `YYYY-MM-DDT23:59:59+05:30`. Future interactions, qualification changes, opportunities, or stage edits never leak into earlier dates.
2. **Latest-Version History Resolution:** `brand_qualification_history` and `opportunity_history` are never summed; `lib/metrics.ts` selects only the latest version per entity with `effective_at <= cutoff`. Stage updates via `PATCH /api/opportunities/[id]` append new version rows rather than mutating history.
3. **Single Deterministic Analytics Engine (`lib/metrics.ts`):** Both the Dashboard (`GET /api/dashboard`) and the AI Copilot (`POST /api/copilot`) call the exact same TypeScript functions (`getSnapshotSummary`, `getChannelAndCampaignPerformance`, `diagnoseBottlenecks`, `queryOpportunities`, `listTasks`).
4. **Tool-Calling AI Copilot with Honest Uncertainty:**
   - Uses `@google/genai` server-side function calling with 6 grounded tools (`propose_create_task` stages UI confirmation cards instead of auto-writing to the DB).
   - Enforces explicit refusal/clarification on unrecorded bank receipts, missing spend/CAC/ROI data, non-causal activation links, and synthetic brand labels.
5. **Vercel Serverless File Tracing:** `next.config.ts` sets `outputFileTracingIncludes: { '/api/reset': ['./Sponsor Dataset.xlsx'] }` so `POST /api/reset` always has access to the baseline workbook in production serverless bundles.

---

## 5. Setup & Local Development

### Prerequisites
- Node.js 20+
- A Supabase project
- A Google AI Studio Gemini API key

### Steps
1. **Install dependencies:**
   ```bash
   npm install
   ```
2. **Configure environment variables (`.env.local`):**
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://<your-project-ref>.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
   SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
   GEMINI_API_KEY=<your-gemini-api-key>
   ```
3. **Create PostgreSQL tables in Supabase:**
   Paste and run [`supabase/schema.sql`](./supabase/schema.sql) in the Supabase SQL Editor.
4. **Seed baseline data & verify checksums:**
   ```bash
   npm run seed
   npm run verify-metrics
   ```
5. **Run the app:**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000).

---

## 6. Tools, Free-Tier Stack & Verification

### Stack & Tools Used
- **Framework & UI:** Next.js 16 (App Router, TypeScript), Tailwind CSS v4, Recharts, Lucide React
- **Database:** Supabase PostgreSQL (**Free Tier**)
- **AI Copilot:** Google AI Studio Gemini API (**Free Tier**, `@google/genai` SDK with Flash model fallback starting at `gemini-3.5-flash` / `GEMINI_MODEL` override)
- **Hosting:** Vercel (**Hobby Tier**)
- **Build & Design Workflow:** Google Antigravity, Claude Pro, Canva

### What Was Verified
- **Baseline Checksums (`npm run verify-metrics`):** 31/31 assertions `PASS` against live Supabase across `2025-04-20` (`60` qualified, `24` confirmed, `₹22,40,000` reported, `370` attempts, `202` contacts, `109` responding, `74` positive replies, `14` unqualified positive replies, `15` opps w/ unqualified brand, `0` outbound / `24` warm confirmed, `O006` withdrawn) and `2025-02-28` (Launch plan `40`/`20`, `O006` confirmed).
- **TypeScript & Lint:** `npx tsc --noEmit` and `npm run lint` pass with 0 errors and 0 warnings.
- **Production Build:** `npm run build` succeeds cleanly with all static and dynamic API routes compiled.
- **Live Copilot Smoke Tests:** Verified `POST /api/copilot` tool-calling guardrails (ROI/bank receipt uncertainty) and non-mutating `propose_create_task` staging against live Supabase + Gemini API.

---

## 7. Known Limitations

1. **Synthetic Dataset:** All brands (including `Beardo`), contacts, campaigns, and INR commitments are synthetic case-study records for CampusFest 2025 (`15 Jan – 20 Apr 2025`).
2. **No Spend or Source Bank Receipt Data:** The source Excel workbook does not include marketing/SDR spend or bank transfer timestamps (`cash_collected_inr` starts `NULL` on all 58 source deals), so CAC/ROI cannot be derived from source data and verified cash collected starts unrecorded until logged in Tab 2.
3. **Single-Tenant Shared Demo Database:** All visitors share one Supabase instance without per-user auth isolation; concurrent reviewers can restore a clean state at any time via the header **Reset to Baseline** button (`POST /api/reset`).
