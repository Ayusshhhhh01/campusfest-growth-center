import { NextRequest, NextResponse } from 'next/server';
import {
  DEFAULT_AS_OF_DATE,
  normalizeAsOfDate,
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

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: opportunityId } = await context.params;
    const body = (await request.json()) as {
      stage?: OpportunityStage;
      proposed_value_inr?: number;
      cash_collected_inr?: number | null;
      owner_name?: string;
      as_of_date?: string;
    };

    const supabase = getSupabaseAdmin();
    const { data: opp, error: oppErr } = await supabase
      .from('partner_opportunities')
      .select('*')
      .eq('opportunity_id', opportunityId)
      .single();

    if (oppErr || !opp) {
      return NextResponse.json(
        { error: `Opportunity "${opportunityId}" not found` },
        { status: 404 }
      );
    }

    const oppUpdates: Record<string, unknown> = {};
    if (body.cash_collected_inr !== undefined) {
      if (body.cash_collected_inr === null) {
        oppUpdates.cash_collected_inr = null;
        oppUpdates.cash_received_at = null;
      } else {
        const cashVal = Number(body.cash_collected_inr);
        if (!Number.isFinite(cashVal) || cashVal < 0) {
          return NextResponse.json(
            { error: 'cash_collected_inr must be null or >= 0' },
            { status: 400 }
          );
        }
        oppUpdates.cash_collected_inr = cashVal;
        oppUpdates.cash_received_at = body.as_of_date
          ? `${normalizeAsOfDate(body.as_of_date)}T23:59:59+05:30`
          : new Date().toISOString();
      }
    }

    let appendedHistoryId: string | null = null;
    let effectiveAtOut: string | null = null;

    if (body.stage !== undefined) {
      if (!VALID_STAGES.includes(body.stage)) {
        return NextResponse.json({ error: `Invalid stage "${body.stage}"` }, { status: 400 });
      }

      const asOfDate = normalizeAsOfDate(body.as_of_date ?? DEFAULT_AS_OF_DATE);
      const cutoffMs = Date.parse(`${asOfDate}T23:59:59+05:30`);

      const { data: historyRows, error: histErr } = await supabase
        .from('opportunity_history')
        .select('*')
        .eq('opportunity_id', opportunityId);

      if (histErr) {
        throw new Error(`Failed loading opportunity_history: ${histErr.message}`);
      }

      const sortedUpToCutoff = (historyRows ?? [])
        .filter((h) => Date.parse(h.effective_at) <= cutoffMs)
        .sort(
          (a, b) =>
            Date.parse(a.effective_at) - Date.parse(b.effective_at) ||
            a.history_id.localeCompare(b.history_id)
        );
      const latest = sortedUpToCutoff[sortedUpToCutoff.length - 1];

      const nowIst = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
      const candidateIso = `${asOfDate}T${padNumber(nowIst.getUTCHours(), 2)}:${padNumber(
        nowIst.getUTCMinutes(),
        2
      )}:${padNumber(nowIst.getUTCSeconds(), 2)}+05:30`;
      let effectiveMs = Date.parse(candidateIso);
      if (latest) {
        const latestMs = Date.parse(latest.effective_at);
        if (effectiveMs <= latestMs) {
          effectiveMs = Math.min(cutoffMs, latestMs + 1000);
        }
      }
      effectiveAtOut = formatIstFromMs(effectiveMs);

      // Generate next history_id
      const { data: allIds } = await supabase.from('opportunity_history').select('history_id');
      let maxNum = 0;
      for (const row of allIds ?? []) {
        if (typeof row.history_id === 'string' && row.history_id.startsWith('OH')) {
          const parsed = Number.parseInt(row.history_id.slice(2), 10);
          if (!Number.isNaN(parsed) && parsed > maxNum) maxNum = parsed;
        }
      }
      appendedHistoryId = `OH${padNumber(maxNum + 1, 5)}`;

      const proposedValue =
        body.proposed_value_inr !== undefined
          ? Number(body.proposed_value_inr)
          : Number(latest?.proposed_value_inr ?? opp.reported_value_inr ?? 0);

      if (!Number.isFinite(proposedValue) || proposedValue < 0) {
        return NextResponse.json({ error: 'proposed_value_inr must be >= 0' }, { status: 400 });
      }

      if (body.proposed_value_inr !== undefined) {
        oppUpdates.reported_value_inr = proposedValue;
      }

      const { error: insertHistErr } = await supabase.from('opportunity_history').insert({
        history_id: appendedHistoryId,
        opportunity_id: opportunityId,
        opportunity_name: opp.opportunity_name,
        brand_id: opp.brand_id,
        brand_name: opp.brand_name,
        owner_id: latest?.owner_id ?? null,
        owner_name: body.owner_name?.trim() || latest?.owner_name || null,
        stage: body.stage,
        proposed_value_inr: proposedValue,
        confirmed_value_inr: body.stage === 'partner_confirmed' ? proposedValue : 0,
        effective_at: effectiveAtOut,
      });

      if (insertHistErr) {
        throw new Error(`Failed appending opportunity_history: ${insertHistErr.message}`);
      }
    }

    if (Object.keys(oppUpdates).length > 0) {
      const { error: updErr } = await supabase
        .from('partner_opportunities')
        .update(oppUpdates)
        .eq('opportunity_id', opportunityId);

      if (updErr) {
        throw new Error(`Failed updating partner_opportunities: ${updErr.message}`);
      }
    }

    return NextResponse.json({
      ok: true,
      opportunity_id: opportunityId,
      history_id: appendedHistoryId,
      effective_at: effectiveAtOut,
      updated: oppUpdates,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed updating opportunity';
    console.error('[PATCH /api/opportunities/[id]] Error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
