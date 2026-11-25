import fs from 'node:fs';
import path from 'node:path';
import * as XLSX from 'xlsx';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseAdmin } from './supabase';

export interface DuplicateAuditItem {
  table: string;
  idColumn: string;
  id: string;
}

export interface SeedSummary {
  duplicatesRemovedCount: number;
  duplicatesRemoved: DuplicateAuditItem[];
  duplicateIds: string[];
  counts: {
    event_meta: number;
    targets: number;
    brands: number;
    contacts: number;
    sponsor_campaigns: number;
    sponsor_interactions: number;
    brand_qualification_history: number;
    partner_opportunities: number;
    opportunity_history: number;
    sponsor_activations: number;
  };
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function parseExcelDateOnly(val: unknown): string {
  if (typeof val === 'number') {
    const d = XLSX.SSF.parse_date_code(val);
    return `${d.y}-${pad2(d.m)}-${pad2(d.d)}`;
  }
  if (val instanceof Date) {
    return val.toISOString().slice(0, 10);
  }
  if (typeof val === 'string') {
    return val.trim().slice(0, 10);
  }
  throw new Error(`Unsupported Excel date value: ${String(val)}`);
}

function parseExcelIstTimestamp(val: unknown): string {
  if (typeof val === 'number') {
    const d = XLSX.SSF.parse_date_code(val);
    return `${d.y}-${pad2(d.m)}-${pad2(d.d)}T${pad2(d.H)}:${pad2(d.M)}:${pad2(d.S)}+05:30`;
  }
  if (val instanceof Date) {
    const y = val.getUTCFullYear();
    const m = val.getUTCMonth() + 1;
    const d = val.getUTCDate();
    const H = val.getUTCHours();
    const M = val.getUTCMinutes();
    const S = val.getUTCSeconds();
    return `${y}-${pad2(m)}-${pad2(d)}T${pad2(H)}:${pad2(M)}:${pad2(S)}+05:30`;
  }
  if (typeof val === 'string') {
    const s = val.trim();
    if (/[+-]\d{2}:\d{2}|Z$/.test(s)) return s;
    return `${s.replace(' ', 'T')}+05:30`;
  }
  throw new Error(`Unsupported Excel datetime value: ${String(val)}`);
}

function readSheetRows<T extends Record<string, unknown>>(
  wb: XLSX.WorkBook,
  sheetName: string
): T[] {
  const sheet = wb.Sheets[sheetName];
  if (!sheet) {
    throw new Error(`Missing sheet "${sheetName}" in Sponsor Dataset.xlsx`);
  }
  return XLSX.utils.sheet_to_json<T>(sheet, { raw: true, defval: null });
}

function deduplicateById<T extends Record<string, unknown>>(
  rows: T[],
  idColumn: keyof T & string,
  tableName: string,
  duplicatesOut: DuplicateAuditItem[]
): T[] {
  const seen = new Set<string>();
  const deduped: T[] = [];
  for (const row of rows) {
    const rawId = row[idColumn];
    const id = String(rawId ?? '').trim();
    if (!id) continue;
    if (seen.has(id)) {
      duplicatesOut.push({ table: tableName, idColumn, id });
      continue;
    }
    seen.add(id);
    deduped.push(row);
  }
  return deduped;
}

async function clearTable(
  supabase: SupabaseClient,
  table: string,
  notNullColumn: string
): Promise<void> {
  const { error } = await supabase.from(table).delete().not(notNullColumn, 'is', null);
  if (error) {
    throw new Error(`Failed clearing table "${table}": ${error.message}`);
  }
}

async function insertInBatches(
  supabase: SupabaseClient,
  table: string,
  rows: Record<string, unknown>[],
  batchSize = 500
): Promise<void> {
  for (let i = 0; i < rows.length; i += batchSize) {
    const chunk = rows.slice(i, i + batchSize);
    const { error } = await supabase.from(table).insert(chunk);
    if (error) {
      throw new Error(`Failed inserting into "${table}" (batch ${i}): ${error.message}`);
    }
  }
}

export function loadBaselineFromWorkbook(xlsxPath?: string) {
  const resolvedPath = xlsxPath ?? path.join(process.cwd(), 'Sponsor Dataset.xlsx');
  if (!fs.existsSync(/*turbopackIgnore: true*/ resolvedPath)) {
    throw new Error(`Workbook not found at ${resolvedPath}`);
  }

  const fileBuffer = fs.readFileSync(/*turbopackIgnore: true*/ resolvedPath);
  const wb = XLSX.read(fileBuffer, { type: 'buffer', cellDates: false });
  const duplicates: DuplicateAuditItem[] = [];

  const eventRows = readSheetRows<Record<string, unknown>>(wb, 'Event');
  if (eventRows.length === 0) throw new Error('Event sheet is empty.');
  const ev = eventRows[0];

  const targetRows = readSheetRows<Record<string, unknown>>(wb, 'Targets').map((r) => ({
    effective_at: parseExcelIstTimestamp(r.effective_at),
    qualified_brands_goal: Number(r.qualified_brands_goal),
    confirmed_partnerships_goal: Number(r.confirmed_partnerships_goal),
    target_version: String(r.target_version),
  }));

  const brandRows = deduplicateById(
    readSheetRows<Record<string, unknown>>(wb, 'Brands'),
    'brand_id',
    'brands',
    duplicates
  ).map((r) => ({
    brand_id: String(r.brand_id),
    brand_name: String(r.brand_name),
    industry: String(r.industry),
    owner_id: String(r.owner_id),
    owner_name: String(r.owner_name),
    created_at: parseExcelIstTimestamp(r.created_at),
  }));

  const contactRows = deduplicateById(
    readSheetRows<Record<string, unknown>>(wb, 'Sponsor contacts'),
    'contact_id',
    'contacts',
    duplicates
  ).map((r) => ({
    contact_id: String(r.contact_id),
    contact_name: String(r.contact_name),
    job_title: String(r.job_title),
    brand_id: String(r.brand_id),
    brand_name: String(r.brand_name),
    created_at: parseExcelIstTimestamp(r.created_at),
  }));

  const campaignRows = deduplicateById(
    readSheetRows<Record<string, unknown>>(wb, 'Sponsor campaigns'),
    'sponsor_campaign_id',
    'sponsor_campaigns',
    duplicates
  ).map((r) => ({
    sponsor_campaign_id: String(r.sponsor_campaign_id),
    campaign_name: String(r.campaign_name),
    channel: String(r.channel),
    objective: r.objective ? String(r.objective) : null,
    audience: r.audience ? String(r.audience) : null,
    owner_id: String(r.owner_id),
    owner_name: String(r.owner_name),
    planned_start_at: r.planned_start_at ? parseExcelIstTimestamp(r.planned_start_at) : null,
    planned_end_at: r.planned_end_at ? parseExcelIstTimestamp(r.planned_end_at) : null,
    created_at: r.created_at ? parseExcelIstTimestamp(r.created_at) : null,
  }));

  const interactionRows = deduplicateById(
    readSheetRows<Record<string, unknown>>(wb, 'Sponsor interactions'),
    'interaction_id',
    'sponsor_interactions',
    duplicates
  ).map((r) => ({
    interaction_id: String(r.interaction_id),
    attempt_id: String(r.attempt_id),
    origin_interaction_id: r.origin_interaction_id ? String(r.origin_interaction_id) : null,
    brand_id: String(r.brand_id),
    brand_name: String(r.brand_name),
    contact_id: r.contact_id ? String(r.contact_id) : null,
    contact_name: r.contact_name ? String(r.contact_name) : null,
    sponsor_campaign_id: String(r.sponsor_campaign_id),
    campaign_name: r.campaign_name ? String(r.campaign_name) : null,
    channel: String(r.channel),
    owner_id: r.owner_id ? String(r.owner_id) : null,
    event_type: String(r.event_type),
    outcome: String(r.outcome),
    summary: r.summary ? String(r.summary) : null,
    occurred_at: parseExcelIstTimestamp(r.occurred_at),
  }));

  const bqhRows = deduplicateById(
    readSheetRows<Record<string, unknown>>(wb, 'Brand qualification'),
    'history_id',
    'brand_qualification_history',
    duplicates
  ).map((r) => ({
    history_id: String(r.history_id),
    brand_id: String(r.brand_id),
    brand_name: String(r.brand_name),
    sponsor_campaign_id: r.sponsor_campaign_id ? String(r.sponsor_campaign_id) : null,
    source_campaign_name: r.source_campaign_name ? String(r.source_campaign_name) : null,
    qualification_status: String(r.qualification_status),
    reason: r.reason ? String(r.reason) : null,
    effective_at: parseExcelIstTimestamp(r.effective_at),
  }));

  const oppHistoryRows = deduplicateById(
    readSheetRows<Record<string, unknown>>(wb, 'Opportunity history'),
    'history_id',
    'opportunity_history',
    duplicates
  ).map((r) => ({
    history_id: String(r.history_id),
    opportunity_id: String(r.opportunity_id),
    opportunity_name: r.opportunity_name ? String(r.opportunity_name) : null,
    brand_id: String(r.brand_id),
    brand_name: r.brand_name ? String(r.brand_name) : null,
    owner_id: r.owner_id ? String(r.owner_id) : null,
    owner_name: r.owner_name ? String(r.owner_name) : null,
    stage: String(r.stage),
    proposed_value_inr: Number(r.proposed_value_inr ?? 0),
    confirmed_value_inr: Number(r.confirmed_value_inr ?? 0),
    effective_at: parseExcelIstTimestamp(r.effective_at),
  }));

  // Derive latest proposed_value_inr per opportunity for partner_opportunities.reported_value_inr
  const latestOppHistory = new Map<string, (typeof oppHistoryRows)[number]>();
  const sortedHistory = [...oppHistoryRows].sort((a, b) =>
    a.effective_at.localeCompare(b.effective_at) || a.history_id.localeCompare(b.history_id)
  );
  for (const h of sortedHistory) {
    latestOppHistory.set(h.opportunity_id, h);
  }

  const opportunityRows = deduplicateById(
    readSheetRows<Record<string, unknown>>(wb, 'Partner opportunities'),
    'opportunity_id',
    'partner_opportunities',
    duplicates
  ).map((r) => {
    const oppId = String(r.opportunity_id);
    const latest = latestOppHistory.get(oppId);
    const reportedValue =
      latest && latest.confirmed_value_inr > 0
        ? latest.confirmed_value_inr
        : (latest?.proposed_value_inr ?? 0);

    return {
      opportunity_id: oppId,
      opportunity_name: String(r.opportunity_name),
      brand_id: String(r.brand_id),
      brand_name: String(r.brand_name),
      primary_contact_id: r.primary_contact_id ? String(r.primary_contact_id) : null,
      primary_contact_name: r.primary_contact_name ? String(r.primary_contact_name) : null,
      sponsor_campaign_id: r.sponsor_campaign_id ? String(r.sponsor_campaign_id) : null,
      originating_campaign_name: r.originating_campaign_name
        ? String(r.originating_campaign_name)
        : null,
      deal_type: String(r.support_type),
      reported_value_inr: reportedValue,
      // Explicitly NULL for all baseline source rows: reported INR is not bank receipt.
      // cash_received_at defaults to NULL in PostgreSQL for all baseline rows.
      cash_collected_inr: null as number | null,
      created_at: parseExcelIstTimestamp(r.created_at),
    };
  });

  const activationRows = deduplicateById(
    readSheetRows<Record<string, unknown>>(wb, 'Sponsor activations'),
    'activation_id',
    'sponsor_activations',
    duplicates
  ).map((r) => ({
    activation_id: String(r.activation_id),
    brand_id: String(r.brand_id),
    brand_name: r.brand_name ? String(r.brand_name) : null,
    opportunity_id: String(r.opportunity_id),
    opportunity_name: r.opportunity_name ? String(r.opportunity_name) : null,
    attendee_campaign_id: String(r.attendee_campaign_id),
    attendee_campaign_name: r.attendee_campaign_name ? String(r.attendee_campaign_name) : null,
    activation_note: r.activation_note ? String(r.activation_note) : null,
    linked_at: parseExcelIstTimestamp(r.linked_at),
    plan_approved: false,
  }));

  const duplicateIds = duplicates.map((d) => d.id).sort();

  const eventMetaRow = {
    id: 1,
    event_name: String(ev.event_name),
    history_start: parseExcelDateOnly(ev.history_start),
    history_end: parseExcelDateOnly(ev.history_end),
    event_starts_at: parseExcelIstTimestamp(ev.event_starts_at),
    event_ends_at: parseExcelIstTimestamp(ev.event_ends_at),
    timezone: String(ev.timezone ?? 'Asia/Kolkata'),
    currency: String(ev.currency ?? 'INR'),
    fictional: Boolean(ev.fictional ?? true),
    raw_duplicates_removed: duplicates.length,
    duplicate_ids_removed: duplicateIds,
  };

  return {
    duplicates,
    duplicateIds,
    eventMetaRow,
    targetRows,
    brandRows,
    contactRows,
    campaignRows,
    interactionRows,
    bqhRows,
    opportunityRows,
    oppHistoryRows,
    activationRows,
  };
}

export async function resetAndSeedDatabase(xlsxPath?: string): Promise<SeedSummary> {
  const supabase = getSupabaseAdmin();
  const data = loadBaselineFromWorkbook(xlsxPath);

  console.log(
    `[seed] Deduplicated ${data.duplicates.length} exact duplicate source IDs: ${data.duplicateIds.join(', ')}`
  );
  for (const d of data.duplicates) {
    console.log(`  - Removed duplicate ${d.table}.${d.idColumn} = ${d.id}`);
  }

  // Clear tables in reverse dependency order so foreign keys remain valid
  await clearTable(supabase, 'growth_tasks', 'task_id');
  await clearTable(supabase, 'sponsor_activations', 'activation_id');
  await clearTable(supabase, 'opportunity_history', 'history_id');
  await clearTable(supabase, 'partner_opportunities', 'opportunity_id');
  await clearTable(supabase, 'brand_qualification_history', 'history_id');
  await clearTable(supabase, 'sponsor_interactions', 'interaction_id');
  await clearTable(supabase, 'contacts', 'contact_id');
  await clearTable(supabase, 'sponsor_campaigns', 'sponsor_campaign_id');
  await clearTable(supabase, 'brands', 'brand_id');
  await clearTable(supabase, 'targets', 'id');
  await clearTable(supabase, 'event_meta', 'id');

  // Insert in dependency order
  await insertInBatches(supabase, 'event_meta', [data.eventMetaRow]);
  await insertInBatches(supabase, 'targets', data.targetRows);
  await insertInBatches(supabase, 'brands', data.brandRows);
  await insertInBatches(supabase, 'contacts', data.contactRows);
  await insertInBatches(supabase, 'sponsor_campaigns', data.campaignRows);
  await insertInBatches(supabase, 'sponsor_interactions', data.interactionRows);
  await insertInBatches(supabase, 'brand_qualification_history', data.bqhRows);
  await insertInBatches(supabase, 'partner_opportunities', data.opportunityRows);
  await insertInBatches(supabase, 'opportunity_history', data.oppHistoryRows);
  await insertInBatches(supabase, 'sponsor_activations', data.activationRows);

  return {
    duplicatesRemovedCount: data.duplicates.length,
    duplicatesRemoved: data.duplicates,
    duplicateIds: data.duplicateIds,
    counts: {
      event_meta: 1,
      targets: data.targetRows.length,
      brands: data.brandRows.length,
      contacts: data.contactRows.length,
      sponsor_campaigns: data.campaignRows.length,
      sponsor_interactions: data.interactionRows.length,
      brand_qualification_history: data.bqhRows.length,
      partner_opportunities: data.opportunityRows.length,
      opportunity_history: data.oppHistoryRows.length,
      sponsor_activations: data.activationRows.length,
    },
  };
}
