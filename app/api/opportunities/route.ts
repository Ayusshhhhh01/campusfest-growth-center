import { connection, NextRequest, NextResponse } from 'next/server';
import {
  DEFAULT_AS_OF_DATE,
  normalizeAsOfDate,
  queryOpportunities,
  type DealType,
  type OpportunityStage,
} from '@/lib/metrics';
import { getSupabaseAdmin } from '@/lib/supabase';

const VALID_STAGES: OpportunityStage[] = [
  'prospecting',
  'contacted',
  'proposal_sent',
  'negotiating',
  'partner_confirmed',
  'lost',
  'withdrawn',
];

function padNumber(n: number, width: number): string {
  return String(n).padStart(width, '0');
}

function formatIstFromMs(ms: number): string {
  const ist = new Date(ms + 5.5 * 60 * 60 * 1000);
  const y = ist.getUTCFullYear();
  const m = padNumber(ist.getUTCMonth() + 1, 2);
  const d = padNumber(ist.getUTCDate(), 2);
  const h = padNumber(ist.getUTCHours(), 2);
  const min = padNumber(ist.getUTCMinutes(), 2);
  const s = padNumber(ist.getUTCSeconds(), 2);
  return `${y}-${m}-${d}T${h}:${min}:${s}+05:30`;
}

function currentIstTimeOnDate(asOfDate: string): string {
  const nowIst = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
  const h = padNumber(nowIst.getUTCHours(), 2);
  const m = padNumber(nowIst.getUTCMinutes(), 2);
  const s = padNumber(nowIst.getUTCSeconds(), 2);
  return `${asOfDate}T${h}:${m}:${s}+05:30`;
}

async function generateNextId(
  table: string,
  column: string,
  prefix: string,
  padLength: number
): Promise<string> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from(table).select(column);
  if (error) {
    throw new Error(`Failed reading ${table}.${column}: ${error.message}`);
  }
  let maxNum = 0;
  for (const row of (data ?? []) as unknown as Array<Record<string, string>>) {
    const val = row[column];
    if (typeof val === 'string' && val.startsWith(prefix)) {
      const parsed = Number.parseInt(val.slice(prefix.length), 10);
      if (!Number.isNaN(parsed) && parsed > maxNum) {
        maxNum = parsed;
      }
    }
  }
  return `${prefix}${padNumber(maxNum + 1, padLength)}`;
}

export async function GET(request: NextRequest) {
  await connection();
  try {
    const sp = request.nextUrl.searchParams;
    const result = await queryOpportunities({
      as_of_date: sp.get('as_of_date') ?? DEFAULT_AS_OF_DATE,
      stage: sp.get('stage') ?? undefined,
      industry: sp.get('industry') ?? undefined,
      brand_name: sp.get('brand_name') ?? undefined,
      channel: sp.get('channel') ?? undefined,
      owner_name: sp.get('owner_name') ?? undefined,
    });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to query opportunities';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      opportunity_name?: string;
      brand_id: string;
      primary_contact_id?: string | null;
      sponsor_campaign_id?: string | null;
      deal_type: DealType;
      reported_value_inr: number;
      stage?: OpportunityStage;
      owner_name?: string;
      as_of_date?: string;
    };

    if (!body.brand_id) {
      return NextResponse.json({ error: 'brand_id is required' }, { status: 400 });
    }
    if (body.deal_type !== 'cash' && body.deal_type !== 'in_kind') {
      return NextResponse.json({ error: 'deal_type must be cash or in_kind' }, { status: 400 });
    }
    const reportedValue = Number(body.reported_value_inr);
    if (!Number.isFinite(reportedValue) || reportedValue < 0) {
      return NextResponse.json({ error: 'reported_value_inr must be >= 0' }, { status: 400 });
    }
    const stage: OpportunityStage = body.stage ?? 'prospecting';
    if (!VALID_STAGES.includes(stage)) {
      return NextResponse.json({ error: `Invalid stage "${stage}"` }, { status: 400 });
    }

    const asOfDate = normalizeAsOfDate(body.as_of_date ?? DEFAULT_AS_OF_DATE);
    const supabase = getSupabaseAdmin();

    const { data: brand, error: brandErr } = await supabase
      .from('brands')
      .select('*')
      .eq('brand_id', body.brand_id)
      .single();
    if (brandErr || !brand) {
      return NextResponse.json({ error: `Brand "${body.brand_id}" not found` }, { status: 404 });
    }

    let contactName: string | null = null;
    if (body.primary_contact_id) {
      const { data: contact } = await supabase
        .from('contacts')
        .select('contact_name')
        .eq('contact_id', body.primary_contact_id)
        .maybeSingle();
      contactName = contact?.contact_name ?? null;
    }

    let campaignName: string | null = null;
    if (body.sponsor_campaign_id) {
      const { data: campaign } = await supabase
        .from('sponsor_campaigns')
        .select('campaign_name')
        .eq('sponsor_campaign_id', body.sponsor_campaign_id)
        .maybeSingle();
      campaignName = campaign?.campaign_name ?? null;
    }

    const [opportunityId, historyId] = await Promise.all([
      generateNextId('partner_opportunities', 'opportunity_id', 'O', 3),
      generateNextId('opportunity_history', 'history_id', 'OH', 5),
    ]);

    const opportunityName =
      body.opportunity_name?.trim() || `${brand.brand_name} festival partnership`;
    const ownerName = body.owner_name?.trim() || brand.owner_name;
    const effectiveAt = currentIstTimeOnDate(asOfDate);
    const createdAt = formatIstFromMs(
      Math.min(Date.parse(effectiveAt), Date.parse(`${asOfDate}T09:00:00+05:30`))
    );

    const { error: oppInsertErr } = await supabase.from('partner_opportunities').insert({
      opportunity_id: opportunityId,
      opportunity_name: opportunityName,
      brand_id: brand.brand_id,
      brand_name: brand.brand_name,
      primary_contact_id: body.primary_contact_id || null,
      primary_contact_name: contactName,
      sponsor_campaign_id: body.sponsor_campaign_id || null,
      originating_campaign_name: campaignName,
      deal_type: body.deal_type,
      reported_value_inr: reportedValue,
      cash_collected_inr: null,
      created_at: createdAt,
    });

    if (oppInsertErr) {
      throw new Error(`Failed inserting partner_opportunities: ${oppInsertErr.message}`);
    }

    const { error: histInsertErr } = await supabase.from('opportunity_history').insert({
      history_id: historyId,
      opportunity_id: opportunityId,
      opportunity_name: opportunityName,
      brand_id: brand.brand_id,
      brand_name: brand.brand_name,
      owner_id: brand.owner_id,
      owner_name: ownerName,
      stage,
      proposed_value_inr: reportedValue,
      confirmed_value_inr: stage === 'partner_confirmed' ? reportedValue : 0,
      effective_at: effectiveAt,
    });

    if (histInsertErr) {
      throw new Error(`Failed inserting opportunity_history: ${histInsertErr.message}`);
    }

    return NextResponse.json(
      {
        ok: true,
        opportunity_id: opportunityId,
        history_id: historyId,
        effective_at: effectiveAt,
      },
      { status: 201 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed creating opportunity';
    console.error('[POST /api/opportunities] Error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
