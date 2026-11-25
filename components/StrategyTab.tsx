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
  rank: string;
  title: string;
  campaigns: string;
  decisionCategory: 'Double Down' | 'Pilot / Cap' | 'Reject / Kill';
  verdictLabel: string;
  riceScore: string;
  riceFormula: string;
  baseTargetLakhs: number;
  stretchTargetLakhs: number;
  budgetDisplay: string;
  cashDisplay?: string;
}

const RANKED_BETS: StrategyBet[] = [
  {
    rank: '#1',
    title: 'Warm Intro Flywheel + "Competitor FOMO" Exclusivity',
    campaigns: 'SC02, SC05',
    decisionCategory: 'Double Down',
    verdictLabel: 'Double Down (Priority #1)',
    riceScore: '30.0',
    riceFormula: '75 × 3 × 0.8 ÷ 6',
    baseTargetLakhs: 9.5,
    stretchTargetLakhs: 19.0,
    budgetDisplay: '₹1.5L',
  },
  {
    rank: '#2',
    title: 'Close Sprint + Cash-First Terms',
    campaigns: 'Pipeline Hygiene',
    decisionCategory: 'Double Down',
    verdictLabel: 'Double Down (Revenue Multiplier)',
    riceScore: '27.2',
    riceFormula: '51 × 2 × 0.8 ÷ 3',
    baseTargetLakhs: 10.7,
    stretchTargetLakhs: 33.8,
    budgetDisplay: '₹0.5L',
  },
  {
    rank: '#3',
    title: 'ROI-First Inbound Magnet + 180-Sec UI Roast Hiring Arena',
    campaigns: 'SC04',
    decisionCategory: 'Double Down',
    verdictLabel: 'Double Down (Hard Kill Check at Wk 3)',
    riceScore: '10.8',
    riceFormula: '45 × 2 × 0.6 ÷ 5',
    baseTargetLakhs: 4.6,
    stretchTargetLakhs: 7.0,
    budgetDisplay: '₹1.5L',
  },
  {
    rank: '#4',
    title: '48-Hour Gen-Z UX & Blind Taste-Test Lab (₹2L)',
    campaigns: 'Experiential Pilot',
    decisionCategory: 'Pilot / Cap',
    verdictLabel: 'Pilot / Cap (Max 2–3 Slots)',
    riceScore: '2.0',
    riceFormula: '10 × 2 × 0.4 ÷ 4',
    baseTargetLakhs: 2.4,
    stretchTargetLakhs: 3.6,
    budgetDisplay: '₹1.0L',
  },
  {
    rank: '#5',
    title: 'Fest Commercial Footage Licensing',
    campaigns: 'Media Rights',
    decisionCategory: 'Reject / Kill',
    verdictLabel: 'Reject (Legal & Cash Timing Risk)',
    riceScore: '0.2',
    riceFormula: '5 × 1 × 0.2 ÷ 6',
    baseTargetLakhs: 0,
    stretchTargetLakhs: 0,
    budgetDisplay: '₹0',
    cashDisplay: '₹0 / ₹0',
  },
  {
    rank: 'K',
    title: 'Status Quo Cut: Cold Email & LinkedIn Outbound',
    campaigns: 'SC01, SC03, SC06',
    decisionCategory: 'Reject / Kill',
    verdictLabel: 'Kill Immediately',
    riceScore: '—',
    riceFormula: '0 deals / 322 touches (no spend data for ROI)',
    baseTargetLakhs: 0,
    stretchTargetLakhs: 0,
    budgetDisplay: '₹0',
    cashDisplay: '₹0 (Frees 87% capacity)',
  },
];

const DECISION_BADGE: Record<StrategyBet['decisionCategory'], string> = {
  'Double Down': 'bg-emerald-50/90 text-emerald-700 ring-1 ring-emerald-200/80',
  'Pilot / Cap': 'bg-amber-50/90 text-amber-800 ring-1 ring-amber-200/80',
  'Reject / Kill': 'bg-rose-50/90 text-rose-700 ring-1 ring-rose-200/80',
};

const SIGNAL_STYLES: Record<
  SignalStatus,
  { accent: string; topGlow: string; badge: string; label: string }
> = {
  green: {
    accent: 'border-l-4 border-l-emerald-500',
    topGlow: 'from-emerald-400/70 via-teal-400/50 to-transparent',
    badge: 'bg-emerald-50/90 text-emerald-700 ring-1 ring-emerald-200/80',
    label: 'SCALE',
  },
  amber: {
    accent: 'border-l-4 border-l-amber-500',
    topGlow: 'from-amber-400/75 via-orange-400/50 to-transparent',
    badge: 'bg-amber-50/90 text-amber-800 ring-1 ring-amber-200/80',
    label: 'CHANGE',
  },
  red: {
    accent: 'border-l-4 border-l-rose-500',
    topGlow: 'from-rose-500/80 via-pink-400/50 to-transparent',
    badge: 'bg-rose-50/90 text-rose-700 ring-1 ring-rose-200/80',
    label: 'STOP',
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
        <div className="rounded-xl border border-rose-200/80 bg-rose-50/90 px-4 py-3 text-sm text-rose-800 backdrop-blur-md">
          {errorMsg}
        </div>
      )}

      {/* 5-Signal Early Warning Monitor */}
      <section className="glass-card p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold tracking-tight text-slate-900">
              5-Signal Early Warning System (Live as of {as_of_date})
            </h2>
            <p className="mt-0.5 text-xs text-slate-600">
              Traffic-light operating thresholds computed deterministically from Supabase via{' '}
              <code className="rounded bg-slate-100/90 px-1 py-0.5 font-mono text-[11px] text-slate-800">
                lib/metrics.ts
              </code>
            </p>
          </div>
          <span className="glass-pill inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium text-slate-700 tabular-nums">
            <ShieldAlert className="h-3.5 w-3.5 text-slate-500" />
            {bottlenecks.breached_signals.length} signal(s) requiring action
          </span>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
          {early_warning.signals.map((sig) => {
            const style = SIGNAL_STYLES[sig.status];
            return (
              <div
                key={sig.id}
                className={`glass-card glass-card-hover relative flex flex-col justify-between overflow-hidden p-4 ${style.accent}`}
              >
                <div
                  aria-hidden="true"
                  className={`pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${style.topGlow}`}
                />
                <div className="pt-0.5">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-xs font-semibold leading-snug text-slate-900">
                      {sig.name}
                    </h3>
                    <span
                      className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wider ${style.badge}`}
                    >
                      {sig.status === 'green' && <CheckCircle2 className="h-3 w-3" />}
                      {sig.status === 'amber' && <AlertTriangle className="h-3 w-3" />}
                      {sig.status === 'red' && <XCircle className="h-3 w-3" />}
                      {style.label}
                    </span>
                  </div>

                  <div className="mt-3 text-2xl font-bold tracking-tight text-slate-900 tabular-nums">
                    {sig.value_pct !== null ? `${sig.value_pct}%` : 'No data'}
                  </div>
                  <p className="mt-1.5 text-xs leading-relaxed text-slate-600 tabular-nums">
                    {sig.detail}
                  </p>
                </div>

                <div className="mt-3 border-t border-slate-200/60 pt-2 text-[11px] font-medium text-slate-500">
                  Threshold: {sig.threshold_rule}
                </div>
              </div>
            );
          })}
        </div>

        {/* Linked Sponsor Activations Approval Strip */}
        <div className="mt-5 rounded-xl border border-white/80 bg-white/55 p-4 backdrop-blur-md">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-600 tabular-nums">
                Linked Partner Activations ({activations.length} as of {as_of_date})
              </h3>
              <p className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-600">
                <Info className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                Observational post-confirmation associations only — do not establish causal
                attendee uplift.
              </p>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-2.5 md:grid-cols-3">
            {activations.map((act) => (
              <div
                key={act.activation_id}
                className="flex items-center justify-between gap-3 rounded-xl border border-white/80 bg-white/80 px-3.5 py-2.5 shadow-2xs transition hover:bg-white"
              >
                <div className="min-w-0">
                  <div className="truncate text-xs font-semibold text-slate-900">
                    {act.brand_name}{' '}
                    <span className="font-mono text-slate-500">({act.activation_id})</span>
                  </div>
                  <div className="truncate text-[11px] text-slate-600">
                    {act.attendee_campaign_name} ({act.attendee_campaign_id})
                  </div>
                </div>
                <button
                  type="button"
                  disabled={togglingActivationId === act.activation_id}
                  onClick={() => handleToggleActivation(act.activation_id, !act.plan_approved)}
                  className={`shrink-0 rounded-lg px-2.5 py-1 text-[11px] font-semibold transition ${
                    act.plan_approved
                      ? 'bg-emerald-50/90 text-emerald-700 ring-1 ring-emerald-200 hover:bg-emerald-100'
                      : 'bg-rose-50/90 text-rose-700 ring-1 ring-rose-200 hover:bg-rose-100'
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

      {/* Ranked CampusFest Bengaluru Strategy Bets */}
      <section className="glass-card p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold tracking-tight text-slate-900">
              Ranked Strategy Bets &amp; Status Quo Cut (CampusFest Bengaluru)
            </h2>
            <p className="mt-0.5 text-xs text-slate-600">
              Total pre-fest cash collected targets ranked by RICE score with explicit budget and
              Double Down / Pilot / Reject / Kill verdicts
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs tabular-nums">
            <span className="glass-pill inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 font-medium text-slate-700">
              <Target className="h-3.5 w-3.5 text-indigo-600" />
              Base <strong className="font-bold text-slate-900">₹27.2L</strong>
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200/80 bg-indigo-50/80 px-3 py-1.5 font-medium text-indigo-800 backdrop-blur-md">
              <Sparkles className="h-3.5 w-3.5 text-indigo-600" />
              Stretch <strong className="font-bold text-indigo-950">₹63.4L</strong>
            </span>
            <span className="glass-pill inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 font-medium text-slate-700">
              Base Budget <strong className="font-bold text-slate-900">₹4.5L</strong>
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200/80 bg-emerald-50/80 px-3 py-1.5 font-medium text-emerald-800 backdrop-blur-md">
              Reported{' '}
              <strong className="font-bold">
                {formatLakhs(summary.financials.confirmed_reported_value_inr)}
              </strong>
            </span>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto rounded-xl border border-white/80 bg-white/50">
          <table className="min-w-full divide-y divide-slate-200/70 text-xs tabular-nums">
            <thead className="bg-slate-50/70 backdrop-blur-md">
              <tr className="text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                <th className="px-3.5 py-3">Rank</th>
                <th className="px-3.5 py-3">Bet / Lever</th>
                <th className="px-3.5 py-3 text-right">RICE</th>
                <th className="px-3.5 py-3 text-right">Pre-Fest Cash (Base / Stretch)</th>
                <th className="px-3.5 py-3 text-right">Budget</th>
                <th className="px-3.5 py-3">Verdict</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/50">
              {RANKED_BETS.map((bet) => (
                <tr key={bet.rank} className="transition hover:bg-indigo-50/40">
                  <td className="px-3.5 py-3.5 font-mono font-bold text-slate-600">
                    {bet.rank}
                  </td>
                  <td className="px-3.5 py-3.5">
                    <div className="font-semibold text-slate-900">{bet.title}</div>
                    <div className="font-mono text-[11px] text-slate-500">{bet.campaigns}</div>
                  </td>
                  <td className="px-3.5 py-3.5 text-right">
                    <span className="inline-flex items-center rounded-lg border border-white/80 bg-white/85 px-2 py-0.5 font-mono text-xs font-bold text-slate-900 shadow-2xs">
                      {bet.riceScore}
                    </span>
                    <div className="mt-0.5 text-[10px] text-slate-500">{bet.riceFormula}</div>
                  </td>
                  <td className="px-3.5 py-3.5 text-right font-mono font-semibold text-slate-900">
                    {bet.cashDisplay ? (
                      <span className="text-slate-600">{bet.cashDisplay}</span>
                    ) : (
                      <span>
                        ₹{bet.baseTargetLakhs.toFixed(1)}L{' '}
                        <span className="text-slate-400">/</span>{' '}
                        <span className="text-indigo-700">₹{bet.stretchTargetLakhs.toFixed(1)}L</span>
                      </span>
                    )}
                  </td>
                  <td className="px-3.5 py-3.5 text-right font-mono font-semibold text-slate-700">
                    {bet.budgetDisplay}
                  </td>
                  <td className="px-3.5 py-3.5">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                        DECISION_BADGE[bet.decisionCategory]
                      }`}
                    >
                      {bet.verdictLabel}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* 48-Hour Qualification SLA Monitor */}
      <section className="glass-card p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold tracking-tight text-slate-900 tabular-nums">
              48-Hour Qualification SLA Monitor (
              {bottlenecks.unqualified_positive_replies.length} Unqualified Positive Replies)
            </h2>
            <p className="mt-0.5 text-xs text-slate-600">
              Brands that replied positively as of {as_of_date} whose latest qualification state is
              not <code className="font-mono text-slate-800">qualified</code>.
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200/80 bg-amber-50/90 px-3 py-1 text-xs font-semibold text-amber-900 backdrop-blur-md tabular-nums">
            <Clock className="h-3.5 w-3.5 text-amber-600" />
            {bottlenecks.unqualified_positive_replies.filter((r) => r.sla_breached_48h).length}{' '}
            breaching 48h SLA
          </span>
        </div>

        <div className="mt-4 overflow-x-auto rounded-xl border border-white/80 bg-white/50">
          <table className="min-w-full divide-y divide-slate-200/70 text-xs tabular-nums">
            <thead className="bg-slate-50/70 backdrop-blur-md">
              <tr className="text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                <th className="px-3.5 py-3">Brand</th>
                <th className="px-3.5 py-3">Industry</th>
                <th className="px-3.5 py-3">Channel</th>
                <th className="px-3.5 py-3">Owner</th>
                <th className="px-3.5 py-3">Current Qual. State</th>
                <th className="px-3.5 py-3 text-right">Elapsed Time</th>
                <th className="px-3.5 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/50">
              {bottlenecks.unqualified_positive_replies.map((row) => {
                const alreadyAssigned = assignedBrandIds.has(row.brand_id);
                const isAssigning = assigningBrandId === row.brand_id;
                return (
                  <tr key={row.brand_id} className="transition hover:bg-indigo-50/40">
                    <td className="px-3.5 py-2.5">
                      <span className="font-mono font-semibold text-indigo-700">
                        {row.brand_id}
                      </span>{' '}
                      <span className="font-semibold text-slate-900">{row.brand_name}</span>
                    </td>
                    <td className="px-3.5 py-2.5 text-slate-600">{row.industry}</td>
                    <td className="px-3.5 py-2.5 text-slate-700">
                      {CHANNEL_LABELS[row.channel] ?? row.channel}
                    </td>
                    <td className="px-3.5 py-2.5 text-slate-700">{row.owner_name}</td>
                    <td className="px-3.5 py-2.5">
                      <span className="rounded-full bg-white/85 px-2.5 py-0.5 font-mono text-[11px] font-medium text-slate-700 ring-1 ring-slate-200/70">
                        {row.latest_qualification_status}
                      </span>
                    </td>
                    <td className="px-3.5 py-2.5 text-right">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 font-mono text-[11px] font-semibold ${
                          row.sla_breached_48h
                            ? 'bg-rose-50/90 text-rose-700 ring-1 ring-rose-200/80'
                            : 'bg-amber-50/90 text-amber-800 ring-1 ring-amber-200/80'
                        }`}
                      >
                        {row.hours_since_positive_reply}h
                      </span>
                    </td>
                    <td className="px-3.5 py-2.5 text-right">
                      {alreadyAssigned ? (
                        <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-50/90 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-200/80">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Task Assigned
                        </span>
                      ) : (
                        <button
                          type="button"
                          disabled={isAssigning}
                          onClick={() => handleAssignFollowUp(row)}
                          className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-2.5 py-1 text-[11px] font-semibold text-white shadow-2xs transition hover:bg-indigo-700 disabled:opacity-50"
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
          <div className="mt-6 border-t border-slate-200/60 pt-5">
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 tabular-nums">
              Active Negotiations ({bottlenecks.stalled_negotiations.length})
            </h3>
            <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
              {bottlenecks.stalled_negotiations.map((neg) => (
                <div
                  key={neg.opportunity_id}
                  className="rounded-xl border border-white/80 bg-white/65 px-3.5 py-2.5 text-xs shadow-2xs transition hover:bg-white/90 tabular-nums"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-semibold text-indigo-700">
                      {neg.opportunity_id}
                    </span>
                    <span className="rounded-full bg-amber-50/90 px-2 py-0.5 font-mono text-[10px] font-semibold text-amber-800 ring-1 ring-amber-200/80">
                      {neg.days_in_stage}d in stage
                    </span>
                  </div>
                  <div className="mt-1 truncate font-semibold text-slate-900">{neg.brand_name}</div>
                  <div className="mt-0.5 flex items-center justify-between text-[11px] text-slate-600">
                    <span>{neg.owner_name}</span>
                    <span className="font-mono font-semibold text-slate-900">
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
