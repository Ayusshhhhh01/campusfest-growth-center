import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseAdmin } from './supabase';

export const DEFAULT_AS_OF_DATE = '2025-04-20';

export type Channel = 'email' | 'linkedin' | 'introduction' | 'web_inbound';
export type QualificationStatus =
  | 'unreviewed'
  | 'engaged'
  | 'qualified'
  | 'unqualified'
  | 'dormant';
export type OpportunityStage =
  | 'prospecting'
  | 'contacted'
  | 'proposal_sent'
  | 'negotiating'
  | 'partner_confirmed'
  | 'lost'
  | 'withdrawn';
export type DealType = 'cash' | 'in_kind';
export type SignalStatus = 'green' | 'amber' | 'red';

export interface EventMetaRow {
  id: number;
  event_name: string;
  history_start: string;
  history_end: string;
  event_starts_at: string;
  event_ends_at: string;
  timezone: string;
  currency: string;
  fictional: boolean;
  raw_duplicates_removed: number;
  duplicate_ids_removed: string[];
}

export interface TargetRow {
  id: number;
  effective_at: string;
  qualified_brands_goal: number;
  confirmed_partnerships_goal: number;
  target_version: string;
}

export interface BrandRow {
  brand_id: string;
  brand_name: string;
  industry: string;
  owner_id: string;
  owner_name: string;
  created_at: string;
}

export interface ContactRow {
  contact_id: string;
  contact_name: string;
  job_title: string;
  brand_id: string;
  brand_name: string;
  created_at: string;
}

export interface SponsorCampaignRow {
  sponsor_campaign_id: string;
  campaign_name: string;
  channel: Channel;
  objective: string | null;
  audience: string | null;
  owner_id: string;
  owner_name: string;
  planned_start_at: string | null;
  planned_end_at: string | null;
  created_at: string | null;
}

export interface SponsorInteractionRow {
  interaction_id: string;
  attempt_id: string;
  origin_interaction_id: string | null;
  brand_id: string;
  brand_name: string;
  contact_id: string | null;
  contact_name: string | null;
  sponsor_campaign_id: string;
  campaign_name: string | null;
  channel: Channel;
  owner_id: string | null;
  event_type: string;
  outcome: string;
  summary: string | null;
  occurred_at: string;
}

export interface BrandQualificationHistoryRow {
  history_id: string;
  brand_id: string;
  brand_name: string;
  sponsor_campaign_id: string | null;
  source_campaign_name: string | null;
  qualification_status: QualificationStatus;
  reason: string | null;
  effective_at: string;
}

export interface PartnerOpportunityRow {
  opportunity_id: string;
  opportunity_name: string;
  brand_id: string;
  brand_name: string;
  primary_contact_id: string | null;
  primary_contact_name: string | null;
  sponsor_campaign_id: string | null;
  originating_campaign_name: string | null;
  deal_type: DealType;
  reported_value_inr: number;
  cash_collected_inr: number | null;
  cash_received_at: string | null;
  created_at: string;
}

export interface OpportunityHistoryRow {
  history_id: string;
  opportunity_id: string;
  opportunity_name: string | null;
  brand_id: string;
  brand_name: string | null;
  owner_id: string | null;
  owner_name: string | null;
  stage: OpportunityStage;
  proposed_value_inr: number;
  confirmed_value_inr: number;
  effective_at: string;
}

export interface SponsorActivationRow {
  activation_id: string;
  brand_id: string;
  brand_name: string | null;
  opportunity_id: string;
  opportunity_name: string | null;
  attendee_campaign_id: string;
  attendee_campaign_name: string | null;
  activation_note: string | null;
  linked_at: string;
  plan_approved: boolean;
}

export interface GrowthTaskRow {
  task_id: string;
  title: string;
  description: string | null;
  owner_name: string;
  status: 'todo' | 'in_progress' | 'done';
  priority: 'high' | 'medium' | 'low';
  due_date: string | null;
  linked_brand_id: string | null;
  linked_opportunity_id: string | null;
  source: 'manual' | 'copilot';
  created_at: string;
}

export interface SnapshotContext {
  as_of_date: string;
  cutoff_iso: string;
  cutoff_ms: number;
  event_meta: EventMetaRow | null;
  active_target: TargetRow | null;
  brands: BrandRow[];
  brandMap: Map<string, BrandRow>;
  campaigns: SponsorCampaignRow[];
  campaignMap: Map<string, SponsorCampaignRow>;
  interactions: SponsorInteractionRow[];
  latestBrandQualifications: Map<string, BrandQualificationHistoryRow>;
  opportunities: PartnerOpportunityRow[];
  allOpportunityHistoryUpToCutoff: OpportunityHistoryRow[];
  latestOpportunityHistory: Map<string, OpportunityHistoryRow>;
  activations: SponsorActivationRow[];
}

const CHANNELS: Channel[] = ['email', 'linkedin', 'introduction', 'web_inbound'];

export function normalizeAsOfDate(asOfDate?: string): string {
  const raw = (asOfDate ?? DEFAULT_AS_OF_DATE).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    throw new Error(`Invalid as_of_date "${raw}". Expected YYYY-MM-DD.`);
  }
  return raw;
}

export function getIstCutoffIso(asOfDate?: string): string {
  const dateStr = normalizeAsOfDate(asOfDate);
  return `${dateStr}T23:59:59+05:30`;
}

export function getIstCutoffMs(asOfDate?: string): number {
  return Date.parse(getIstCutoffIso(asOfDate));
}

function toMs(ts: string | null | undefined): number {
  if (!ts) return Number.NaN;
  return Date.parse(ts);
}

function dedupeRowsById<T>(rows: T[], getId: (row: T) => string): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const row of rows) {
    const id = getId(row);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(row);
  }
  return out;
}

async function fetchAllRows<T>(supabase: SupabaseClient, table: string): Promise<T[]> {
  const pageSize = 1000;
  const rows: T[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .range(from, from + pageSize - 1);

    if (error) {
      throw new Error(`Failed reading "${table}": ${error.message}`);
    }
    if (!data || data.length === 0) break;
    rows.push(...(data as T[]));
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return rows;
}

/**
 * Loads all tables from Supabase and applies strict IST point-in-time cutoff
 * and latest-version history resolution.
 */
export async function loadSnapshotContext(asOfDate?: string): Promise<SnapshotContext> {
  const dateStr = normalizeAsOfDate(asOfDate);
  const cutoffIso = getIstCutoffIso(dateStr);
  const cutoffMs = Date.parse(cutoffIso);
  const supabase = getSupabaseAdmin();

  const [
    eventMetaRows,
    targets,
    brandsRaw,
    campaigns,
    interactionsRaw,
    bqhRaw,
    opportunitiesRaw,
    ohRaw,
    activationsRaw,
  ] = await Promise.all([
    fetchAllRows<EventMetaRow>(supabase, 'event_meta'),
    fetchAllRows<TargetRow>(supabase, 'targets'),
    fetchAllRows<BrandRow>(supabase, 'brands'),
    fetchAllRows<SponsorCampaignRow>(supabase, 'sponsor_campaigns'),
    fetchAllRows<SponsorInteractionRow>(supabase, 'sponsor_interactions'),
    fetchAllRows<BrandQualificationHistoryRow>(supabase, 'brand_qualification_history'),
    fetchAllRows<PartnerOpportunityRow>(supabase, 'partner_opportunities'),
    fetchAllRows<OpportunityHistoryRow>(supabase, 'opportunity_history'),
    fetchAllRows<SponsorActivationRow>(supabase, 'sponsor_activations'),
  ]);

  const validTargets = targets
    .filter((t) => toMs(t.effective_at) <= cutoffMs)
    .sort((a, b) => toMs(a.effective_at) - toMs(b.effective_at));
  const activeTarget = validTargets.length > 0 ? validTargets[validTargets.length - 1] : null;

  const brands = brandsRaw.filter((b) => toMs(b.created_at) <= cutoffMs);
  const brandMap = new Map(brandsRaw.map((b) => [b.brand_id, b]));
  const campaignMap = new Map(campaigns.map((c) => [c.sponsor_campaign_id, c]));

  const interactions = dedupeRowsById(interactionsRaw, (r) => r.interaction_id).filter(
    (i) => toMs(i.occurred_at) <= cutoffMs
  );

  const bqhUpToCutoff = dedupeRowsById(bqhRaw, (r) => r.history_id)
    .filter((q) => toMs(q.effective_at) <= cutoffMs)
    .sort(
      (a, b) => toMs(a.effective_at) - toMs(b.effective_at) || a.history_id.localeCompare(b.history_id)
    );
  const latestBrandQualifications = new Map<string, BrandQualificationHistoryRow>();
  for (const q of bqhUpToCutoff) {
    latestBrandQualifications.set(q.brand_id, q);
  }

  const opportunities = opportunitiesRaw
    .filter((o) => toMs(o.created_at) <= cutoffMs)
    .map((o) => ({
      ...o,
      reported_value_inr: Number(o.reported_value_inr ?? 0),
      cash_collected_inr: o.cash_collected_inr === null ? null : Number(o.cash_collected_inr),
      cash_received_at: o.cash_received_at ?? null,
    }));

  const allOpportunityHistoryUpToCutoff = dedupeRowsById(ohRaw, (r) => r.history_id)
    .filter((h) => toMs(h.effective_at) <= cutoffMs)
    .map((h) => ({
      ...h,
      proposed_value_inr: Number(h.proposed_value_inr ?? 0),
      confirmed_value_inr: Number(h.confirmed_value_inr ?? 0),
    }))
    .sort(
      (a, b) => toMs(a.effective_at) - toMs(b.effective_at) || a.history_id.localeCompare(b.history_id)
    );

  const latestOpportunityHistory = new Map<string, OpportunityHistoryRow>();
  for (const h of allOpportunityHistoryUpToCutoff) {
    latestOpportunityHistory.set(h.opportunity_id, h);
  }

  const activations = activationsRaw.filter((a) => toMs(a.linked_at) <= cutoffMs);

  return {
    as_of_date: dateStr,
    cutoff_iso: cutoffIso,
    cutoff_ms: cutoffMs,
    event_meta: eventMetaRows[0] ?? null,
    active_target: activeTarget,
    brands,
    brandMap,
    campaigns,
    campaignMap,
    interactions,
    latestBrandQualifications,
    opportunities,
    allOpportunityHistoryUpToCutoff,
    latestOpportunityHistory,
    activations,
  };
}

function isCashReceivedByCutoff(opp: PartnerOpportunityRow, cutoffMs: number): boolean {
  if (opp.cash_collected_inr === null) return false;
  if (!opp.cash_received_at) return false;
  const receivedMs = toMs(opp.cash_received_at);
  return !Number.isNaN(receivedMs) && receivedMs <= cutoffMs;
}

function getEffectiveOpportunityValue(
  opp: PartnerOpportunityRow,
  latestHist: OpportunityHistoryRow | undefined
): number {
  if (!latestHist) return opp.reported_value_inr;
  if (latestHist.stage === 'partner_confirmed') {
    return latestHist.confirmed_value_inr > 0
      ? latestHist.confirmed_value_inr
      : opp.reported_value_inr;
  }
  return latestHist.proposed_value_inr > 0 ? latestHist.proposed_value_inr : opp.reported_value_inr;
}

export async function getSnapshotSummary(asOfDate?: string, preloadedCtx?: SnapshotContext) {
  const ctx = preloadedCtx ?? (await loadSnapshotContext(asOfDate));

  const attemptIds = new Set<string>();
  const contactIds = new Set<string>();
  const contactedBrandIds = new Set<string>();
  const respondingBrandIds = new Set<string>();
  const positiveReplyBrandIds = new Set<string>();

  for (const i of ctx.interactions) {
    attemptIds.add(i.attempt_id);
    if (i.contact_id) contactIds.add(i.contact_id);
    contactedBrandIds.add(i.brand_id);
    if (i.event_type === 'replied') {
      respondingBrandIds.add(i.brand_id);
      if (i.outcome === 'positive') {
        positiveReplyBrandIds.add(i.brand_id);
      }
    }
  }

  const qualifiedBrandIds = new Set<string>();
  const qualificationBreakdown: Record<QualificationStatus, number> = {
    unreviewed: 0,
    engaged: 0,
    qualified: 0,
    unqualified: 0,
    dormant: 0,
  };

  for (const [brandId, q] of ctx.latestBrandQualifications.entries()) {
    qualificationBreakdown[q.qualification_status] += 1;
    if (q.qualification_status === 'qualified') {
      qualifiedBrandIds.add(brandId);
    }
  }

  const opportunityBrandIds = new Set<string>();
  const stageBreakdown: Record<OpportunityStage, number> = {
    prospecting: 0,
    contacted: 0,
    proposal_sent: 0,
    negotiating: 0,
    partner_confirmed: 0,
    lost: 0,
    withdrawn: 0,
  };

  let confirmedCount = 0;
  let confirmedCashDeals = 0;
  let confirmedInKindDeals = 0;
  let confirmedCashValueInr = 0;
  let confirmedInKindValueInr = 0;
  let totalPipelineProposedInr = 0;
  let cashCollectedSum = 0;
  let cashReceiptsLoggedCount = 0;

  for (const opp of ctx.opportunities) {
    opportunityBrandIds.add(opp.brand_id);
    const latest = ctx.latestOpportunityHistory.get(opp.opportunity_id);
    const stage = latest?.stage ?? 'prospecting';
    stageBreakdown[stage] += 1;

    const val = getEffectiveOpportunityValue(opp, latest);
    if (stage !== 'lost' && stage !== 'withdrawn') {
      totalPipelineProposedInr += val;
    }

    if (isCashReceivedByCutoff(opp, ctx.cutoff_ms) && opp.cash_collected_inr !== null) {
      cashReceiptsLoggedCount += 1;
      cashCollectedSum += opp.cash_collected_inr;
    }

    if (stage === 'partner_confirmed') {
      confirmedCount += 1;
      if (opp.deal_type === 'cash') {
        confirmedCashDeals += 1;
        confirmedCashValueInr += val;
      } else {
        confirmedInKindDeals += 1;
        confirmedInKindValueInr += val;
      }
    }
  }

  let unqualifiedPositiveReplyCount = 0;
  for (const brandId of positiveReplyBrandIds) {
    if (!qualifiedBrandIds.has(brandId)) {
      unqualifiedPositiveReplyCount += 1;
    }
  }

  let brandsWithOpportunitiesNotQualified = 0;
  for (const brandId of opportunityBrandIds) {
    if (!qualifiedBrandIds.has(brandId)) {
      brandsWithOpportunitiesNotQualified += 1;
    }
  }

  const totalConfirmedValueInr = confirmedCashValueInr + confirmedInKindValueInr;

  const funnelSteps = [
    {
      step: 'Brands',
      count: ctx.brands.length,
      conversion_from_prev_pct: null as number | null,
    },
    {
      step: 'Contacted Brands',
      count: contactedBrandIds.size,
      conversion_from_prev_pct:
        ctx.brands.length > 0
          ? Number(((contactedBrandIds.size / ctx.brands.length) * 100).toFixed(1))
          : 0,
    },
    {
      step: 'Responding Brands',
      count: respondingBrandIds.size,
      conversion_from_prev_pct:
        contactedBrandIds.size > 0
          ? Number(((respondingBrandIds.size / contactedBrandIds.size) * 100).toFixed(1))
          : 0,
    },
    {
      step: 'Qualified Brands',
      count: qualifiedBrandIds.size,
      conversion_from_prev_pct:
        respondingBrandIds.size > 0
          ? Number(((qualifiedBrandIds.size / respondingBrandIds.size) * 100).toFixed(1))
          : 0,
    },
    {
      step: 'Opportunities',
      count: ctx.opportunities.length,
      conversion_from_prev_pct:
        qualifiedBrandIds.size > 0
          ? Number(((ctx.opportunities.length / qualifiedBrandIds.size) * 100).toFixed(1))
          : 0,
    },
    {
      step: 'Confirmed Deals',
      count: confirmedCount,
      conversion_from_prev_pct:
        ctx.opportunities.length > 0
          ? Number(((confirmedCount / ctx.opportunities.length) * 100).toFixed(1))
          : 0,
    },
  ];

  return {
    as_of_date: ctx.as_of_date,
    cutoff_iso: ctx.cutoff_iso,
    event_meta: ctx.event_meta,
    raw_duplicates_removed: ctx.event_meta?.raw_duplicates_removed ?? 0,
    duplicate_ids_removed: ctx.event_meta?.duplicate_ids_removed ?? [],
    targets: {
      target_version: ctx.active_target?.target_version ?? null,
      effective_at: ctx.active_target?.effective_at ?? null,
      qualified_brands_goal: ctx.active_target?.qualified_brands_goal ?? 0,
      confirmed_partnerships_goal: ctx.active_target?.confirmed_partnerships_goal ?? 0,
    },
    populations: {
      total_brands: ctx.brands.length,
      attempts: attemptIds.size,
      unique_contacts_touched: contactIds.size,
      contacted_brands: contactedBrandIds.size,
      responding_brands: respondingBrandIds.size,
      positive_reply_brands: positiveReplyBrandIds.size,
      qualified_brands: qualifiedBrandIds.size,
      opportunities: ctx.opportunities.length,
      confirmed_opportunities: confirmedCount,
    },
    financials: {
      confirmed_reported_value_inr: totalConfirmedValueInr,
      confirmed_cash_deals: confirmedCashDeals,
      confirmed_cash_value_inr: confirmedCashValueInr,
      confirmed_in_kind_deals: confirmedInKindDeals,
      confirmed_in_kind_value_inr: confirmedInKindValueInr,
      active_pipeline_proposed_inr: totalPipelineProposedInr,
      has_recorded_cash_receipts: cashReceiptsLoggedCount > 0,
      cash_receipts_logged_deals: cashReceiptsLoggedCount,
      verified_cash_collected_inr: cashReceiptsLoggedCount > 0 ? cashCollectedSum : null,
      cash_receipt_note:
        cashReceiptsLoggedCount > 0
          ? `Verified cash receipts logged across ${cashReceiptsLoggedCount} deal(s).`
          : 'Not recorded in source data — reported INR values are not proof of bank receipt.',
    },
    integrity_checks: {
      unqualified_positive_reply_brands: unqualifiedPositiveReplyCount,
      brands_with_opportunities_not_qualified: brandsWithOpportunitiesNotQualified,
      qualification_breakdown: qualificationBreakdown,
      stage_breakdown: stageBreakdown,
    },
    funnel: funnelSteps,
  };
}

export async function getChannelAndCampaignPerformance(
  asOfDate?: string,
  preloadedCtx?: SnapshotContext
) {
  const ctx = preloadedCtx ?? (await loadSnapshotContext(asOfDate));

  const qualifiedByCampaign = new Map<string, number>();
  const qualifiedByChannel = new Map<Channel, number>();
  for (const q of ctx.latestBrandQualifications.values()) {
    if (q.qualification_status !== 'qualified' || !q.sponsor_campaign_id) continue;
    qualifiedByCampaign.set(
      q.sponsor_campaign_id,
      (qualifiedByCampaign.get(q.sponsor_campaign_id) ?? 0) + 1
    );
    const camp = ctx.campaignMap.get(q.sponsor_campaign_id);
    if (camp) {
      qualifiedByChannel.set(camp.channel, (qualifiedByChannel.get(camp.channel) ?? 0) + 1);
    }
  }

  const oppsByCampaign = new Map<string, PartnerOpportunityRow[]>();
  const oppsByChannel = new Map<Channel, PartnerOpportunityRow[]>();
  for (const opp of ctx.opportunities) {
    if (!opp.sponsor_campaign_id) continue;
    const campList = oppsByCampaign.get(opp.sponsor_campaign_id) ?? [];
    campList.push(opp);
    oppsByCampaign.set(opp.sponsor_campaign_id, campList);

    const camp = ctx.campaignMap.get(opp.sponsor_campaign_id);
    if (camp) {
      const chList = oppsByChannel.get(camp.channel) ?? [];
      chList.push(opp);
      oppsByChannel.set(camp.channel, chList);
    }
  }

  function summarizeInteractions(rows: SponsorInteractionRow[]) {
    const attempts = new Set<string>();
    const contacts = new Set<string>();
    const brands = new Set<string>();
    const replyAttempts = new Set<string>();
    const positiveAttempts = new Set<string>();
    const replyBrands = new Set<string>();
    const positiveBrands = new Set<string>();
    let meetingsBooked = 0;
    let meetingsHeld = 0;

    for (const r of rows) {
      attempts.add(r.attempt_id);
      if (r.contact_id) contacts.add(r.contact_id);
      brands.add(r.brand_id);
      if (r.event_type === 'replied') {
        replyAttempts.add(r.attempt_id);
        replyBrands.add(r.brand_id);
        if (r.outcome === 'positive') {
          positiveAttempts.add(r.attempt_id);
          positiveBrands.add(r.brand_id);
        }
      } else if (r.event_type === 'meeting_booked') {
        meetingsBooked += 1;
      } else if (r.event_type === 'meeting_held') {
        meetingsHeld += 1;
      }
    }

    return {
      attempts: attempts.size,
      unique_contacts_touched: contacts.size,
      brands_touched: brands.size,
      reply_attempts: replyAttempts.size,
      positive_reply_attempts: positiveAttempts.size,
      responding_brands: replyBrands.size,
      positive_reply_brands: positiveBrands.size,
      reply_rate_pct:
        attempts.size > 0 ? Number(((replyAttempts.size / attempts.size) * 100).toFixed(1)) : 0,
      positive_reply_rate_pct:
        attempts.size > 0 ? Number(((positiveAttempts.size / attempts.size) * 100).toFixed(1)) : 0,
      meetings_booked: meetingsBooked,
      meetings_held: meetingsHeld,
    };
  }

  function summarizeOpps(oppRows: PartnerOpportunityRow[]) {
    let confirmedDeals = 0;
    let confirmedValueInr = 0;
    let cashDeals = 0;
    let inKindDeals = 0;
    for (const o of oppRows) {
      const latest = ctx.latestOpportunityHistory.get(o.opportunity_id);
      if (latest?.stage === 'partner_confirmed') {
        confirmedDeals += 1;
        confirmedValueInr += getEffectiveOpportunityValue(o, latest);
        if (o.deal_type === 'cash') cashDeals += 1;
        else inKindDeals += 1;
      }
    }
    return {
      opportunities: oppRows.length,
      confirmed_deals: confirmedDeals,
      confirmed_cash_deals: cashDeals,
      confirmed_in_kind_deals: inKindDeals,
      confirmed_value_inr: confirmedValueInr,
    };
  }

  const channels = CHANNELS.map((channel) => {
    const intStats = summarizeInteractions(ctx.interactions.filter((i) => i.channel === channel));
    const oppStats = summarizeOpps(oppsByChannel.get(channel) ?? []);
    return {
      channel,
      ...intStats,
      qualified_brands: qualifiedByChannel.get(channel) ?? 0,
      ...oppStats,
    };
  });

  const campaigns = ctx.campaigns.map((c) => {
    const intStats = summarizeInteractions(
      ctx.interactions.filter((i) => i.sponsor_campaign_id === c.sponsor_campaign_id)
    );
    const oppStats = summarizeOpps(oppsByCampaign.get(c.sponsor_campaign_id) ?? []);
    return {
      sponsor_campaign_id: c.sponsor_campaign_id,
      campaign_name: c.campaign_name,
      channel: c.channel,
      owner_name: c.owner_name,
      ...intStats,
      qualified_brands: qualifiedByCampaign.get(c.sponsor_campaign_id) ?? 0,
      ...oppStats,
    };
  });

  const outbound = channels.filter((c) => c.channel === 'email' || c.channel === 'linkedin');
  const warm = channels.filter((c) => c.channel === 'introduction' || c.channel === 'web_inbound');

  const totalAttempts = channels.reduce((s, c) => s + c.attempts, 0);
  const outboundAttempts = outbound.reduce((s, c) => s + c.attempts, 0);
  const outboundConfirmed = outbound.reduce((s, c) => s + c.confirmed_deals, 0);
  const outboundValue = outbound.reduce((s, c) => s + c.confirmed_value_inr, 0);
  const warmAttempts = warm.reduce((s, c) => s + c.attempts, 0);
  const warmConfirmed = warm.reduce((s, c) => s + c.confirmed_deals, 0);
  const warmValue = warm.reduce((s, c) => s + c.confirmed_value_inr, 0);

  return {
    as_of_date: ctx.as_of_date,
    channels,
    campaigns,
    outbound_vs_warm: {
      outbound_attempts: outboundAttempts,
      outbound_effort_share_pct:
        totalAttempts > 0 ? Number(((outboundAttempts / totalAttempts) * 100).toFixed(1)) : 0,
      outbound_confirmed_deals: outboundConfirmed,
      outbound_confirmed_value_inr: outboundValue,
      warm_attempts: warmAttempts,
      warm_effort_share_pct:
        totalAttempts > 0 ? Number(((warmAttempts / totalAttempts) * 100).toFixed(1)) : 0,
      warm_confirmed_deals: warmConfirmed,
      warm_confirmed_value_inr: warmValue,
    },
  };
}

export async function getIndustryAndConcentration(
  asOfDate?: string,
  preloadedCtx?: SnapshotContext
) {
  const ctx = preloadedCtx ?? (await loadSnapshotContext(asOfDate));

  const byIndustry = new Map<
    string,
    { industry: string; confirmed_deals: number; confirmed_value_inr: number }
  >();
  const bySponsor = new Map<
    string,
    {
      brand_id: string;
      brand_name: string;
      industry: string;
      confirmed_deals: number;
      confirmed_value_inr: number;
    }
  >();

  let totalConfirmedValue = 0;

  for (const opp of ctx.opportunities) {
    const latest = ctx.latestOpportunityHistory.get(opp.opportunity_id);
    if (latest?.stage !== 'partner_confirmed') continue;
    const val = getEffectiveOpportunityValue(opp, latest);
    totalConfirmedValue += val;

    const brand = ctx.brandMap.get(opp.brand_id);
    const industry = brand?.industry ?? 'Unknown';

    const indEntry = byIndustry.get(industry) ?? {
      industry,
      confirmed_deals: 0,
      confirmed_value_inr: 0,
    };
    indEntry.confirmed_deals += 1;
    indEntry.confirmed_value_inr += val;
    byIndustry.set(industry, indEntry);

    const spEntry = bySponsor.get(opp.brand_id) ?? {
      brand_id: opp.brand_id,
      brand_name: opp.brand_name,
      industry,
      confirmed_deals: 0,
      confirmed_value_inr: 0,
    };
    spEntry.confirmed_deals += 1;
    spEntry.confirmed_value_inr += val;
    bySponsor.set(opp.brand_id, spEntry);
  }

  const industries = Array.from(byIndustry.values())
    .map((item) => ({
      ...item,
      share_pct:
        totalConfirmedValue > 0
          ? Number(((item.confirmed_value_inr / totalConfirmedValue) * 100).toFixed(1))
          : 0,
    }))
    .sort((a, b) => b.confirmed_value_inr - a.confirmed_value_inr);

  const sponsors = Array.from(bySponsor.values())
    .map((item) => ({
      ...item,
      share_pct:
        totalConfirmedValue > 0
          ? Number(((item.confirmed_value_inr / totalConfirmedValue) * 100).toFixed(1))
          : 0,
    }))
    .sort((a, b) => b.confirmed_value_inr - a.confirmed_value_inr);

  const largestSponsor = sponsors[0] ?? null;
  const largestIndustry = industries[0] ?? null;
  const maxSharePct = Math.max(largestSponsor?.share_pct ?? 0, largestIndustry?.share_pct ?? 0);

  return {
    as_of_date: ctx.as_of_date,
    total_confirmed_value_inr: totalConfirmedValue,
    industries,
    top_sponsors: sponsors.slice(0, 10),
    largest_sponsor: largestSponsor,
    largest_industry: largestIndustry,
    concentration_risk_level:
      maxSharePct > 40
        ? ('red' as SignalStatus)
        : maxSharePct > 20
          ? ('amber' as SignalStatus)
          : ('green' as SignalStatus),
  };
}

export async function getEarlyWarningSignals(
  asOfDate?: string,
  preloadedCtx?: SnapshotContext
) {
  const ctx = preloadedCtx ?? (await loadSnapshotContext(asOfDate));
  const summary = await getSnapshotSummary(ctx.as_of_date, ctx);
  const concentration = await getIndustryAndConcentration(ctx.as_of_date, ctx);

  // 1. Qualified Meeting Rate — Warm channels only (introduction, web_inbound)
  // Green >=65%, Amber 30%-64%, Red <30% (requires n >= 10)
  const warmInteractions = ctx.interactions.filter(
    (i) => i.channel === 'introduction' || i.channel === 'web_inbound'
  );
  const warmAttemptIds = new Set(warmInteractions.map((i) => i.attempt_id));
  const warmAttempts = warmAttemptIds.size;
  const warmMeetingsHeld = warmInteractions.filter((i) => i.event_type === 'meeting_held').length;
  const meetingRatePct =
    warmAttempts > 0 ? Number(((warmMeetingsHeld / warmAttempts) * 100).toFixed(1)) : 0;
  const meetingStatus: SignalStatus =
    warmAttempts < 10
      ? 'amber'
      : meetingRatePct >= 65
        ? 'green'
        : meetingRatePct >= 30
          ? 'amber'
          : 'red';

  // 2. Proposal -> Negotiation Rate (Green >=80%, Amber 25%-79%, Red <25%)
  const proposalOpps = new Set<string>();
  const negotiatingOpps = new Set<string>();
  for (const h of ctx.allOpportunityHistoryUpToCutoff) {
    if (h.stage === 'proposal_sent') proposalOpps.add(h.opportunity_id);
    if (h.stage === 'negotiating') negotiatingOpps.add(h.opportunity_id);
  }
  let progressedToNeg = 0;
  for (const oid of proposalOpps) {
    if (negotiatingOpps.has(oid)) progressedToNeg += 1;
  }
  const proposalToNegPct =
    proposalOpps.size > 0 ? Number(((progressedToNeg / proposalOpps.size) * 100).toFixed(1)) : 0;
  const proposalToNegStatus: SignalStatus =
    proposalOpps.size === 0
      ? 'amber'
      : proposalToNegPct >= 80
        ? 'green'
        : proposalToNegPct >= 25
          ? 'amber'
          : 'red';

  // 3. Advance Collection Rate (<70% of due Amber/Red, or "No bank receipt data" if unlogged)
  const confirmedCashVal = summary.financials.confirmed_cash_value_inr;
  const cashCollected = summary.financials.verified_cash_collected_inr;
  const collectionPct =
    cashCollected !== null && confirmedCashVal > 0
      ? Number(((cashCollected / confirmedCashVal) * 100).toFixed(1))
      : null;
  const collectionStatus: SignalStatus =
    collectionPct === null
      ? 'amber'
      : collectionPct < 50
        ? 'red'
        : collectionPct < 70
          ? 'amber'
          : 'green';

  // 4. Sponsor & Category Concentration (Green <=20%, Amber >20%-40%, Red >40%)
  const largestSponsorSharePct = concentration.largest_sponsor?.share_pct ?? 0;
  const largestIndustrySharePct = concentration.largest_industry?.share_pct ?? 0;
  const maxConcentrationSharePct = Math.max(largestSponsorSharePct, largestIndustrySharePct);
  const concentrationStatus = concentration.concentration_risk_level;

  // 5. Activation Readiness (Unapproved plans at T-14)
  const unapprovedActivations = ctx.activations.filter((a) => !a.plan_approved);
  const eventStartMs = ctx.event_meta ? toMs(ctx.event_meta.event_starts_at) : Number.NaN;
  const daysToEvent = Number.isNaN(eventStartMs)
    ? null
    : Math.ceil((eventStartMs - ctx.cutoff_ms) / (1000 * 60 * 60 * 24));
  const withinT14 = daysToEvent !== null && daysToEvent <= 14;
  const activationStatus: SignalStatus =
    unapprovedActivations.length === 0 ? 'green' : withinT14 ? 'red' : 'amber';

  return {
    as_of_date: ctx.as_of_date,
    signals: [
      {
        id: 'qualified_meeting_rate',
        name: 'Qualified Meeting Rate',
        status: meetingStatus,
        value_pct: meetingRatePct,
        numerator: warmMeetingsHeld,
        denominator: warmAttempts,
        threshold_rule: 'Warm channels: Green ≥65%, Amber 30%–64%, Red <30% (n ≥ 10)',
        detail: `${warmMeetingsHeld} warm meetings held across ${warmAttempts} warm attempts (${meetingRatePct}%).`,
      },
      {
        id: 'proposal_to_negotiation',
        name: 'Proposal → Negotiation Rate',
        status: proposalToNegStatus,
        value_pct: proposalToNegPct,
        numerator: progressedToNeg,
        denominator: proposalOpps.size,
        threshold_rule: 'Green ≥80%, Amber 25%–79%, Red <25%',
        detail: `${progressedToNeg} of ${proposalOpps.size} proposals advanced to negotiating (${proposalToNegPct}%).`,
      },
      {
        id: 'advance_collection_rate',
        name: 'Advance Collection Rate',
        status: collectionStatus,
        value_pct: collectionPct,
        numerator: cashCollected,
        denominator: confirmedCashVal,
        threshold_rule: '<70% Amber/Red, or No bank receipt data if unlogged',
        detail:
          collectionPct === null
            ? 'No bank receipt data (cash_collected_inr is NULL on source deals).'
            : `₹${cashCollected?.toLocaleString('en-IN')} collected of ₹${confirmedCashVal.toLocaleString('en-IN')} cash deals (${collectionPct}%).`,
      },
      {
        id: 'sponsor_concentration',
        name: 'Sponsor & Category Concentration',
        status: concentrationStatus,
        value_pct: maxConcentrationSharePct,
        numerator:
          largestIndustrySharePct >= largestSponsorSharePct
            ? (concentration.largest_industry?.confirmed_value_inr ?? 0)
            : (concentration.largest_sponsor?.confirmed_value_inr ?? 0),
        denominator: concentration.total_confirmed_value_inr,
        threshold_rule: 'Top sponsor or category: Green ≤20%, Amber >20%–40%, Red >40%',
        detail:
          concentration.largest_sponsor && concentration.largest_industry
            ? `Top sponsor: ${concentration.largest_sponsor.brand_name} (${concentration.largest_sponsor.brand_id}) at ${largestSponsorSharePct}%; top category: ${concentration.largest_industry.industry} at ${largestIndustrySharePct}% of confirmed value.`
            : 'No confirmed sponsors yet.',
      },
      {
        id: 'activation_readiness',
        name: 'Activation Readiness',
        status: activationStatus,
        value_pct:
          ctx.activations.length > 0
            ? Number(
                (
                  ((ctx.activations.length - unapprovedActivations.length) /
                    ctx.activations.length) *
                  100
                ).toFixed(1)
              )
            : 100,
        numerator: unapprovedActivations.length,
        denominator: ctx.activations.length,
        threshold_rule: 'Unapproved activation plans at T-14',
        detail: `${unapprovedActivations.length} of ${ctx.activations.length} linked sponsor activations are unapproved (${daysToEvent !== null ? `T${daysToEvent >= 0 ? `-${daysToEvent}` : `+${Math.abs(daysToEvent)}`}d` : 'N/A'}).`,
      },
    ],
  };
}

export async function diagnoseBottlenecks(asOfDate?: string, preloadedCtx?: SnapshotContext) {
  const ctx = preloadedCtx ?? (await loadSnapshotContext(asOfDate));
  const warnings = await getEarlyWarningSignals(ctx.as_of_date, ctx);

  // Positive-reply brands never qualified
  const latestPosReplyByBrand = new Map<string, SponsorInteractionRow>();
  for (const i of ctx.interactions) {
    if (i.event_type === 'replied' && i.outcome === 'positive') {
      const existing = latestPosReplyByBrand.get(i.brand_id);
      if (!existing || toMs(i.occurred_at) > toMs(existing.occurred_at)) {
        latestPosReplyByBrand.set(i.brand_id, i);
      }
    }
  }

  const unqualifiedPositiveReplies = [];
  for (const [brandId, interaction] of latestPosReplyByBrand.entries()) {
    const qual = ctx.latestBrandQualifications.get(brandId);
    if (qual?.qualification_status === 'qualified') continue;
    const brand = ctx.brandMap.get(brandId);
    const hoursSinceReply = Math.max(
      0,
      Math.round((ctx.cutoff_ms - toMs(interaction.occurred_at)) / (1000 * 60 * 60))
    );
    unqualifiedPositiveReplies.push({
      brand_id: brandId,
      brand_name: brand?.brand_name ?? interaction.brand_name,
      industry: brand?.industry ?? 'Unknown',
      owner_name: brand?.owner_name ?? 'Unassigned',
      sponsor_campaign_id: interaction.sponsor_campaign_id,
      channel: interaction.channel,
      latest_qualification_status: qual?.qualification_status ?? 'none',
      last_positive_reply_at: interaction.occurred_at,
      hours_since_positive_reply: hoursSinceReply,
      sla_breached_48h: hoursSinceReply > 48,
    });
  }
  unqualifiedPositiveReplies.sort((a, b) => b.hours_since_positive_reply - a.hours_since_positive_reply);

  const stalledNegotiations = [];
  const withdrawnDeals = [];
  const lostDeals = [];

  for (const opp of ctx.opportunities) {
    const latest = ctx.latestOpportunityHistory.get(opp.opportunity_id);
    if (!latest) continue;
    const daysInStage = Math.max(
      0,
      Math.round((ctx.cutoff_ms - toMs(latest.effective_at)) / (1000 * 60 * 60 * 24))
    );
    const item = {
      opportunity_id: opp.opportunity_id,
      opportunity_name: opp.opportunity_name,
      brand_id: opp.brand_id,
      brand_name: opp.brand_name,
      owner_name: latest.owner_name ?? ctx.brandMap.get(opp.brand_id)?.owner_name ?? 'Unknown',
      sponsor_campaign_id: opp.sponsor_campaign_id,
      deal_type: opp.deal_type,
      value_inr: getEffectiveOpportunityValue(opp, latest),
      stage: latest.stage,
      stage_effective_at: latest.effective_at,
      days_in_stage: daysInStage,
    };

    if (latest.stage === 'negotiating') stalledNegotiations.push(item);
    else if (latest.stage === 'withdrawn') withdrawnDeals.push(item);
    else if (latest.stage === 'lost') lostDeals.push(item);
  }

  stalledNegotiations.sort((a, b) => b.days_in_stage - a.days_in_stage);

  return {
    as_of_date: ctx.as_of_date,
    unqualified_positive_replies: unqualifiedPositiveReplies,
    stalled_negotiations: stalledNegotiations,
    withdrawn_deals: withdrawnDeals,
    lost_deals: lostDeals,
    early_warning_signals: warnings.signals,
    breached_signals: warnings.signals.filter((s) => s.status !== 'green'),
  };
}

export async function queryOpportunities(
  filters?: {
    stage?: string;
    industry?: string;
    brand_name?: string;
    channel?: string;
    owner_name?: string;
    as_of_date?: string;
  },
  preloadedCtx?: SnapshotContext
) {
  const ctx = preloadedCtx ?? (await loadSnapshotContext(filters?.as_of_date));

  const stageFilter = filters?.stage?.trim().toLowerCase();
  const industryFilter = filters?.industry?.trim().toLowerCase();
  const brandFilter = filters?.brand_name?.trim().toLowerCase();
  const channelFilter = filters?.channel?.trim().toLowerCase();
  const ownerFilter = filters?.owner_name?.trim().toLowerCase();

  const results = ctx.opportunities
    .map((opp) => {
      const latest = ctx.latestOpportunityHistory.get(opp.opportunity_id);
      const brand = ctx.brandMap.get(opp.brand_id);
      const campaign = opp.sponsor_campaign_id
        ? ctx.campaignMap.get(opp.sponsor_campaign_id)
        : undefined;
      const qual = ctx.latestBrandQualifications.get(opp.brand_id);

      const stage = latest?.stage ?? 'prospecting';
      const ownerName = latest?.owner_name ?? brand?.owner_name ?? 'Unknown';
      const industry = brand?.industry ?? 'Unknown';
      const channel = campaign?.channel ?? 'unknown';
      const valueInr = getEffectiveOpportunityValue(opp, latest);

      return {
        opportunity_id: opp.opportunity_id,
        opportunity_name: opp.opportunity_name,
        brand_id: opp.brand_id,
        brand_name: opp.brand_name,
        industry,
        brand_qualification_status: qual?.qualification_status ?? 'none',
        primary_contact_id: opp.primary_contact_id,
        primary_contact_name: opp.primary_contact_name,
        sponsor_campaign_id: opp.sponsor_campaign_id,
        originating_campaign_name: opp.originating_campaign_name,
        channel,
        owner_name: ownerName,
        deal_type: opp.deal_type,
        stage,
        reported_value_inr: valueInr,
        cash_collected_inr: isCashReceivedByCutoff(opp, ctx.cutoff_ms)
          ? opp.cash_collected_inr
          : null,
        cash_received_at: isCashReceivedByCutoff(opp, ctx.cutoff_ms)
          ? opp.cash_received_at
          : null,
        stage_effective_at: latest?.effective_at ?? opp.created_at,
        created_at: opp.created_at,
      };
    })
    .filter((row) => {
      if (stageFilter && row.stage.toLowerCase() !== stageFilter) return false;
      if (industryFilter && !row.industry.toLowerCase().includes(industryFilter)) return false;
      if (brandFilter && !row.brand_name.toLowerCase().includes(brandFilter)) return false;
      if (channelFilter && row.channel.toLowerCase() !== channelFilter) return false;
      if (ownerFilter && !row.owner_name.toLowerCase().includes(ownerFilter)) return false;
      return true;
    })
    .sort((a, b) => b.reported_value_inr - a.reported_value_inr);

  return {
    as_of_date: ctx.as_of_date,
    count: results.length,
    opportunities: results,
  };
}

export async function listTasks(status?: string) {
  const supabase = getSupabaseAdmin();
  let query = supabase.from('growth_tasks').select('*').order('created_at', { ascending: false });
  if (status && status.trim()) {
    query = query.eq('status', status.trim());
  }
  const { data, error } = await query;
  if (error) {
    throw new Error(`Failed listing growth_tasks: ${error.message}`);
  }
  return (data ?? []) as GrowthTaskRow[];
}

export async function getFullDashboardPayload(asOfDate?: string) {
  const supabase = getSupabaseAdmin();
  const [ctx, tasks, contacts, allBrands] = await Promise.all([
    loadSnapshotContext(asOfDate),
    listTasks(),
    fetchAllRows<ContactRow>(supabase, 'contacts'),
    fetchAllRows<BrandRow>(supabase, 'brands'),
  ]);

  const [summary, channelPerformance, industryConcentration, earlyWarning, bottlenecks, opps] =
    await Promise.all([
      getSnapshotSummary(ctx.as_of_date, ctx),
      getChannelAndCampaignPerformance(ctx.as_of_date, ctx),
      getIndustryAndConcentration(ctx.as_of_date, ctx),
      getEarlyWarningSignals(ctx.as_of_date, ctx),
      diagnoseBottlenecks(ctx.as_of_date, ctx),
      queryOpportunities({ as_of_date: ctx.as_of_date }, ctx),
    ]);

  const ownerSet = new Set<string>();
  for (const b of allBrands) ownerSet.add(b.owner_name);
  for (const c of ctx.campaigns) ownerSet.add(c.owner_name);

  return {
    as_of_date: ctx.as_of_date,
    summary,
    channel_performance: channelPerformance,
    industry_concentration: industryConcentration,
    early_warning: earlyWarning,
    bottlenecks,
    opportunities: opps.opportunities,
    tasks,
    activations: ctx.activations,
    reference: {
      brands: [...allBrands].sort((a, b) => a.brand_name.localeCompare(b.brand_name)),
      campaigns: [...ctx.campaigns].sort((a, b) =>
        a.sponsor_campaign_id.localeCompare(b.sponsor_campaign_id)
      ),
      contacts: [...contacts].sort((a, b) => a.contact_name.localeCompare(b.contact_name)),
      owners: Array.from(ownerSet).sort(),
    },
  };
}
