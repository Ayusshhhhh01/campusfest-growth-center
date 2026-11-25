'use client';

import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Info,
  PlusCircle,
  ShieldAlert,
  Sparkles,
  Target,
  XCircle,
} from 'lucide-react';
import type { DashboardPayload, SignalStatus, UnqualifiedPositiveReply } from '@/lib/types';
import { CHANNEL_LABELS, formatInr, formatLakhs } from '@/lib/format';

interface StrategyTabProps {
  data: DashboardPayload;
  onRefresh: () => Promise<void>;
}

interface StrategyBet {
  rank: number;
  title: string;
  campaigns: string;
  decision: 'Double Down' | 'Cap' | 'Kill';
  riceScore: number;
  riceFormula: string;
  baseTargetLakhs: number;
  stretchTargetLakhs: number;
  rationale: string;
}

const RANKED_BETS: StrategyBet[] = [
  {
    rank: 1,
    title: 'Warm Partner & Creator Network Introductions',
    campaigns: 'SC02, SC05',
    decision: 'Double Down',
    riceScore: 92,
    riceFormula: 'R: 30 • I: 3.0 • C: 95% • E: 1.0',
    baseTargetLakhs: 14.0,
    stretchTargetLakhs: 30.0,
    rationale:
      'Delivers 17 of 24 baseline confirmed deals (₹15.7L) from just 30 attempts (56.7% deal yield). Expand alumni & creator referral pods.',
  },
  {
    rank: 2,
    title: 'Web Inbound Partner Interest Fast-Track',
    campaigns: 'SC04',
    decision: 'Double Down',
    riceScore: 84,
    riceFormula: 'R: 25 • I: 2.5 • C: 90% • E: 0.7',
    baseTargetLakhs: 6.5,
    stretchTargetLakhs: 15.0,
    rationale:
      '7 confirmed deals (₹6.7L) from 18 inbound submissions (38.9% deal yield). Automate 24h discovery scheduling on form submit.',
  },
  {
    rank: 3,
    title: '48-Hour Qualification SLA & Stalled Deal Rescue',
    campaigns: 'Pipeline Hygiene',
    decision: 'Double Down',
    riceScore: 76,
    riceFormula: 'R: 22 • I: 2.0 • C: 85% • E: 0.5',
    baseTargetLakhs: 5.2,
    stretchTargetLakhs: 13.4,
    rationale:
      '14 positive-reply brands never completed qualification and 8 deals sit in negotiating. Enforcing SLA unlocks existing warm demand.',
  },
  {
    rank: 4,
    title: 'LinkedIn Executive Outreach',
    campaigns: 'SC03',
    decision: 'Cap',
    riceScore: 34,
    riceFormula: 'R: 54 • I: 1.0 • C: 50% • E: 0.8',
    baseTargetLakhs: 1.5,
    stretchTargetLakhs: 5.0,
    rationale:
      '25.9% positive reply rate across 54 attempts, but only 1 early confirmed deal (O006) which later withdrew. Cap to warm mutual-connects.',
  },
  {
    rank: 5,
    title: 'Cold Email Volume Blasts',
    campaigns: 'SC01, SC06',
    decision: 'Kill',
    riceScore: 12,
    riceFormula: 'R: 268 • I: 0.25 • C: 40% • E: 2.2',
    baseTargetLakhs: 0.0,
    stretchTargetLakhs: 0.0,
    rationale:
      '268 attempts (72.4% of total outreach volume) produced ₹0 confirmed sponsorship. Reallocate SDR hours directly to Bets 1–3.',
  },
];

const DECISION_BADGE: Record<StrategyBet['decision'], string> = {
  'Double Down': 'bg-emerald-100 text-emerald-800 border-emerald-200',
  Cap: 'bg-amber-100 text-amber-800 border-amber-200',
  Kill: 'bg-rose-100 text-rose-800 border-rose-200',
};

const SIGNAL_STYLES: Record<
  SignalStatus,
  { border: string; bg: string; badge: string; label: string }
> = {
  green: {
    border: 'border-emerald-200',
    bg: 'bg-emerald-50/40',
    badge: 'bg-emerald-100 text-emerald-800',
    label: 'GREEN',
  },
  amber: {
    border: 'border-amber-200',
    bg: 'bg-amber-50/40',
    badge: 'bg-amber-100 text-amber-800',
    label: 'AMBER',
  },
  red: {
    border: 'border-rose-200',
    bg: 'bg-rose-50/50',
    badge: 'bg-rose-100 text-rose-800',
    label: 'RED',
  },
};

export function StrategyTab({ data, onRefresh }: StrategyTabProps) {
  const { early_warning, bottlenecks, tasks, activations, summary, as_of_date } = data;
  const [assigningBrandId, setAssigningBrandId] = useState<string | null>(null);
  const [togglingActivationId, setTogglingActivationId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const assignedBrandIds = useMemo(() => {
    const set = new Set<string>();
    for (const t of tasks) {
      if (t.linked_brand_id) set.add(t.linked_brand_id);
    }
    return set;
  }, [tasks]);

  async function handleAssignFollowUp(row: UnqualifiedPositiveReply) {
    setErrorMsg(null);
    setAssigningBrandId(row.brand_id);
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `Qualify positive reply: ${row.brand_name} (${row.brand_id})`,
          description: `Positive reply received via ${CHANNEL_LABELS[row.channel] ?? row.channel} (${row.hours_since_positive_reply}h elapsed as of ${as_of_date}). Current qualification status: ${row.latest_qualification_status}.`,
          owner_name: row.owner_name,
          priority: 'high',
          due_date: as_of_date,
          linked_brand_id: row.brand_id,
          source: 'manual',
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed creating follow-up task');
      await onRefresh();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed assigning task');
    } finally {
      setAssigningBrandId(null);
    }
  }

  async function handleToggleActivation(activationId: string, nextApproved: boolean) {
    setErrorMsg(null);
    setTogglingActivationId(activationId);
    try {
      const res = await fetch(`/api/activations/${activationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan_approved: nextApproved }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed updating activation approval');
      await onRefresh();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed updating activation');
    } finally {
      setTogglingActivationId(null);
    }
  }

  return (
    <div className="space-y-6">
      {errorMsg && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {errorMsg}
        </div>
      )}

      {/* 5-Signal Early Warning Monitor */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              5-Signal Early Warning System (Live as of {as_of_date})
            </h2>
            <p className="text-xs text-slate-500">
              Traffic-light thresholds recalculated live from Supabase via{' '}
              <code className="font-mono">lib/metrics.ts</code>
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
            <ShieldAlert className="h-3.5 w-3.5 text-slate-500" />
            {bottlenecks.breached_signals.length} signal(s) requiring attention
          </span>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
          {early_warning.signals.map((sig) => {
            const style = SIGNAL_STYLES[sig.status];
            return (
              <div
                key={sig.id}
                className={`flex flex-col justify-between rounded-xl border p-4 ${style.border} ${style.bg}`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-semibold text-slate-900">{sig.name}</h3>
                    <span
                      className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wider ${style.badge}`}
                    >
                      {sig.status === 'green' && <CheckCircle2 className="h-3 w-3" />}
                      {sig.status === 'amber' && <AlertTriangle className="h-3 w-3" />}
                      {sig.status === 'red' && <XCircle className="h-3 w-3" />}
                      {style.label}
                    </span>
                  </div>

                  <div className="mt-3 text-2xl font-bold tracking-tight text-slate-900">
                    {sig.value_pct !== null ? `${sig.value_pct}%` : 'No data'}
                  </div>
                  <p className="mt-1.5 text-xs leading-relaxed text-slate-700">{sig.detail}</p>
                </div>

                <div className="mt-3 border-t border-slate-200/70 pt-2 text-[11px] font-medium text-slate-500">
                  Rule: {sig.threshold_rule}
                </div>
              </div>
            );
          })}
        </div>

        {/* Linked Sponsor Activations Approval Strip */}
        <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                Linked Partner Activations ({activations.length} as of {as_of_date})
              </h3>
              <p className="flex items-center gap-1 text-xs text-slate-500">
                <Info className="h-3.5 w-3.5 text-slate-400" />
                Observational post-confirmation associations only — do not establish causal
                attendee uplift.
              </p>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-2.5 md:grid-cols-3">
            {activations.map((act) => (
              <div
                key={act.activation_id}
                className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5"
              >
                <div className="min-w-0">
                  <div className="truncate text-xs font-semibold text-slate-900">
                    {act.brand_name}{' '}
                    <span className="font-mono text-slate-400">({act.activation_id})</span>
                  </div>
                  <div className="truncate text-[11px] text-slate-500">
                    {act.attendee_campaign_name} ({act.attendee_campaign_id})
                  </div>
                </div>
                <button
                  type="button"
                  disabled={togglingActivationId === act.activation_id}
                  onClick={() => handleToggleActivation(act.activation_id, !act.plan_approved)}
                  className={`shrink-0 rounded-md px-2.5 py-1 text-[11px] font-semibold transition ${
                    act.plan_approved
                      ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                      : 'bg-rose-100 text-rose-800 hover:bg-rose-200'
                  }`}
                >
                  {act.plan_approved ? 'Approved' : 'Approve Plan'}
                </button>
              </div>
            ))}
            {activations.length === 0 && (
              <div className="text-xs text-slate-500">
                No sponsor activations linked on or before {as_of_date}.
              </div>
            )}
          </div>
        </div>
      </section>

      {/* 5 Ranked CampusFest Bengaluru Strategy Bets */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              5 Ranked Strategy Bets (CampusFest Bengaluru)
            </h2>
            <p className="text-xs text-slate-500">
              Prioritized by RICE score with incremental cash targets and capital allocation calls
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 font-medium text-slate-700">
              <Target className="h-3.5 w-3.5 text-indigo-600" />
              Base Target: <strong className="text-slate-900">₹27.2L</strong>
            </span>
            <span className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 font-medium text-indigo-800">
              <Sparkles className="h-3.5 w-3.5 text-indigo-600" />
              Stretch Target: <strong className="text-indigo-950">₹63.4L</strong>
            </span>
            <span className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 font-medium text-emerald-800">
              Live Confirmed:{' '}
              <strong>{formatLakhs(summary.financials.confirmed_reported_value_inr)}</strong>
            </span>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-xs">
            <thead>
              <tr className="bg-slate-50 text-left font-semibold uppercase tracking-wider text-slate-500">
                <th className="px-3 py-3">Rank</th>
                <th className="px-3 py-3">Bet / Lever</th>
                <th className="px-3 py-3">Decision</th>
                <th className="px-3 py-3 text-right">RICE Score</th>
                <th className="px-3 py-3 text-right">Base Target</th>
                <th className="px-3 py-3 text-right">Stretch Target</th>
                <th className="px-3 py-3">Evidence &amp; Execution Focus</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {RANKED_BETS.map((bet) => (
                <tr key={bet.rank} className="hover:bg-slate-50/70">
                  <td className="px-3 py-3 font-mono font-bold text-slate-700">#{bet.rank}</td>
                  <td className="px-3 py-3">
                    <div className="font-semibold text-slate-900">{bet.title}</div>
                    <div className="font-mono text-[11px] text-slate-400">{bet.campaigns}</div>
                  </td>
                  <td className="px-3 py-3">
                    <span
                      className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${
                        DECISION_BADGE[bet.decision]
                      }`}
                    >
                      {bet.decision}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-right">
                    <div className="font-mono text-sm font-bold text-slate-900">
                      {bet.riceScore}
                    </div>
                    <div className="text-[10px] text-slate-400">{bet.riceFormula}</div>
                  </td>
                  <td className="px-3 py-3 text-right font-mono font-semibold text-slate-800">
                    ₹{bet.baseTargetLakhs.toFixed(1)}L
                  </td>
                  <td className="px-3 py-3 text-right font-mono font-semibold text-indigo-700">
                    ₹{bet.stretchTargetLakhs.toFixed(1)}L
                  </td>
                  <td className="max-w-md px-3 py-3 text-slate-600">{bet.rationale}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* 48-Hour Qualification SLA Monitor */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              48-Hour Qualification SLA Monitor (
              {bottlenecks.unqualified_positive_replies.length} Unqualified Positive Replies)
            </h2>
            <p className="text-xs text-slate-500">
              Brands that replied positively to outreach as of {as_of_date} whose latest
              qualification state is not <code className="font-mono">qualified</code>.
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900">
            <Clock className="h-3.5 w-3.5" />
            {bottlenecks.unqualified_positive_replies.filter((r) => r.sla_breached_48h).length}{' '}
            breaching 48h SLA
          </span>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-xs">
            <thead>
              <tr className="bg-slate-50 text-left font-semibold uppercase tracking-wider text-slate-500">
                <th className="px-3 py-3">Brand</th>
                <th className="px-3 py-3">Industry</th>
                <th className="px-3 py-3">Channel</th>
                <th className="px-3 py-3">Owner</th>
                <th className="px-3 py-3">Current Qual. State</th>
                <th className="px-3 py-3 text-right">Elapsed Since Positive Reply</th>
                <th className="px-3 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {bottlenecks.unqualified_positive_replies.map((row) => {
                const alreadyAssigned = assignedBrandIds.has(row.brand_id);
                const isAssigning = assigningBrandId === row.brand_id;
                return (
                  <tr key={row.brand_id} className="hover:bg-slate-50/70">
                    <td className="px-3 py-2.5">
                      <span className="font-mono font-semibold text-indigo-700">
                        {row.brand_id}
                      </span>{' '}
                      <span className="font-medium text-slate-900">{row.brand_name}</span>
                    </td>
                    <td className="px-3 py-2.5 text-slate-600">{row.industry}</td>
                    <td className="px-3 py-2.5 text-slate-700">
                      {CHANNEL_LABELS[row.channel] ?? row.channel}
                    </td>
                    <td className="px-3 py-2.5 text-slate-700">{row.owner_name}</td>
                    <td className="px-3 py-2.5">
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 font-mono text-[11px] font-medium text-slate-700">
                        {row.latest_qualification_status}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 font-mono text-[11px] font-semibold ${
                          row.sla_breached_48h
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {row.hours_since_positive_reply}h
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      {alreadyAssigned ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Task Assigned
                        </span>
                      ) : (
                        <button
                          type="button"
                          disabled={isAssigning}
                          onClick={() => handleAssignFollowUp(row)}
                          className="inline-flex items-center gap-1 rounded-md bg-indigo-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                        >
                          <PlusCircle className="h-3.5 w-3.5" />
                          {isAssigning ? 'Assigning...' : 'Assign Follow-up Task'}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {bottlenecks.unqualified_positive_replies.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                    All positive-reply brands are qualified as of {as_of_date}.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Stalled Negotiations Quick List */}
        {bottlenecks.stalled_negotiations.length > 0 && (
          <div className="mt-5 border-t border-slate-100 pt-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Active Negotiations ({bottlenecks.stalled_negotiations.length})
            </h3>
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {bottlenecks.stalled_negotiations.map((neg) => (
                <div
                  key={neg.opportunity_id}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-semibold text-indigo-700">
                      {neg.opportunity_id}
                    </span>
                    <span className="rounded bg-amber-100 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-amber-800">
                      {neg.days_in_stage}d in stage
                    </span>
                  </div>
                  <div className="mt-0.5 truncate font-medium text-slate-900">{neg.brand_name}</div>
                  <div className="flex items-center justify-between text-[11px] text-slate-500">
                    <span>{neg.owner_name}</span>
                    <span className="font-mono font-semibold text-slate-800">
                      {formatInr(neg.value_inr)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
