'use client';

import React, { useSyncExternalStore } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  AlertCircle,
  ArrowRight,
  Banknote,
  Building2,
  CheckCircle2,
  Handshake,
  IndianRupee,
  Layers,
  ShieldAlert,
  TrendingUp,
} from 'lucide-react';
import type { DashboardPayload } from '@/lib/types';
import { CHANNEL_LABELS, formatInr, formatLakhs } from '@/lib/format';

interface ExecutiveTabProps {
  data: DashboardPayload;
  onNavigateToPipeline: () => void;
}

const FUNNEL_GRADIENTS = [
  { id: 'funnelGrad0', start: '#64748B', end: '#475569' },
  { id: 'funnelGrad1', start: '#6366F1', end: '#4F46E5' },
  { id: 'funnelGrad2', start: '#6366F1', end: '#7C3AED' },
  { id: 'funnelGrad3', start: '#4F46E5', end: '#7C3AED' },
  { id: 'funnelGrad4', start: '#0EA5E9', end: '#2563EB' },
  { id: 'funnelGrad5', start: '#10B981', end: '#059669' },
];

const INDUSTRY_GRADIENTS = [
  { id: 'indGrad0', start: '#10B981', end: '#059669' },
  { id: 'indGrad1', start: '#6366F1', end: '#7C3AED' },
  { id: 'indGrad2', start: '#0EA5E9', end: '#0284C7' },
  { id: 'indGrad3', start: '#F59E0B', end: '#D97706' },
  { id: 'indGrad4', start: '#64748B', end: '#475569' },
  { id: 'indGrad5', start: '#EC4899', end: '#DB2777' },
];

const emptySubscribe = () => () => {};

export function ExecutiveTab({ data, onNavigateToPipeline }: ExecutiveTabProps) {
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );

  const { summary, channel_performance, industry_concentration } = data;
  const { populations, targets, financials, integrity_checks, funnel } = summary;
  const { outbound_vs_warm } = channel_performance;

  const qualGoal = targets.qualified_brands_goal || 1;
  const qualDelta = populations.qualified_brands - targets.qualified_brands_goal;
  const qualPct = Math.min(100, Math.round((populations.qualified_brands / qualGoal) * 100));

  const confGoal = targets.confirmed_partnerships_goal || 1;
  const confDelta = populations.confirmed_opportunities - targets.confirmed_partnerships_goal;
  const confPct = Math.min(
    100,
    Math.round((populations.confirmed_opportunities / confGoal) * 100)
  );

  const hasReceipts = financials.has_recorded_cash_receipts;
  const largest = industry_concentration.largest_sponsor;
  const concRisk = industry_concentration.concentration_risk_level;

  const totalAttempts = outbound_vs_warm.outbound_attempts + outbound_vs_warm.warm_attempts;
  const outboundZero = outbound_vs_warm.outbound_confirmed_deals === 0;
  const warmShareDealsPct =
    populations.confirmed_opportunities > 0
      ? Math.round(
          (outbound_vs_warm.warm_confirmed_deals / populations.confirmed_opportunities) * 100
        )
      : 0;

  return (
    <div className="space-y-6">
      {/* 4 Glass Hero KPI Cards */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {/* Card 1: Qualified Brands */}
        <div className="glass-card glass-card-hover flex flex-col justify-between p-5">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Qualified Brands
              </span>
              <span className="rounded-xl bg-indigo-50/90 p-2 text-indigo-600 ring-1 ring-indigo-200/60">
                <Building2 className="h-4 w-4" />
              </span>
            </div>
            <div className="mt-3 flex items-baseline gap-2 tabular-nums">
              <span className="text-3xl font-bold tracking-tight text-slate-900">
                {populations.qualified_brands}
              </span>
              <span className="text-sm font-medium text-slate-500">
                / {targets.qualified_brands_goal} target
              </span>
            </div>
          </div>

          <div className="mt-4">
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200/70">
              <div
                className={`h-full rounded-full transition-all ${
                  qualDelta >= 0
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-500'
                    : 'bg-gradient-to-r from-indigo-500 to-violet-500'
                }`}
                style={{ width: `${qualPct}%` }}
              />
            </div>
            <div className="mt-2.5 flex items-center justify-between text-xs tabular-nums">
              <span
                className={`inline-flex items-center rounded-md px-2 py-0.5 font-semibold ${
                  qualDelta >= 0
                    ? 'bg-emerald-50/90 text-emerald-700 ring-1 ring-emerald-200/60'
                    : 'bg-amber-50/90 text-amber-800 ring-1 ring-amber-200/60'
                }`}
              >
                {qualDelta >= 0 ? `+${qualDelta} ahead` : `${qualDelta} vs goal`}
              </span>
              <span className="truncate text-slate-600">{targets.target_version ?? 'Target'}</span>
            </div>
          </div>
        </div>

        {/* Card 2: Confirmed Partnerships */}
        <div className="glass-card glass-card-hover flex flex-col justify-between p-5">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Confirmed Partnerships
              </span>
              <span className="rounded-xl bg-emerald-50/90 p-2 text-emerald-600 ring-1 ring-emerald-200/60">
                <Handshake className="h-4 w-4" />
              </span>
            </div>
            <div className="mt-3 flex items-baseline gap-2 tabular-nums">
              <span className="text-3xl font-bold tracking-tight text-slate-900">
                {populations.confirmed_opportunities}
              </span>
              <span className="text-sm font-medium text-slate-500">
                / {targets.confirmed_partnerships_goal} target
              </span>
            </div>
          </div>

          <div className="mt-4">
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200/70">
              <div
                className={`h-full rounded-full transition-all ${
                  confDelta >= 0
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-500'
                    : 'bg-gradient-to-r from-indigo-500 to-amber-500'
                }`}
                style={{ width: `${confPct}%` }}
              />
            </div>
            <div className="mt-2.5 flex items-center justify-between text-xs tabular-nums">
              <span
                className={`inline-flex items-center rounded-md px-2 py-0.5 font-semibold ${
                  confDelta >= 0
                    ? 'bg-emerald-50/90 text-emerald-700 ring-1 ring-emerald-200/60'
                    : 'bg-amber-50/90 text-amber-800 ring-1 ring-amber-200/60'
                }`}
              >
                {confDelta >= 0 ? `+${confDelta} vs goal` : `${confDelta} behind goal`}
              </span>
              <span className="text-slate-600">
                {integrity_checks.stage_breakdown.withdrawn > 0
                  ? `${integrity_checks.stage_breakdown.withdrawn} withdrawn`
                  : `${populations.opportunities} total opps`}
              </span>
            </div>
          </div>
        </div>

        {/* Card 3: Reported Deal Value */}
        <div className="glass-card glass-card-hover flex flex-col justify-between p-5">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Reported Deal Value
              </span>
              <span className="rounded-xl bg-sky-50/90 p-2 text-sky-600 ring-1 ring-sky-200/60">
                <IndianRupee className="h-4 w-4" />
              </span>
            </div>
            <div className="mt-3 text-3xl font-bold tracking-tight text-slate-900 tabular-nums">
              {formatInr(financials.confirmed_reported_value_inr)}
            </div>
          </div>

          <div className="mt-3">
            <div className="grid grid-cols-2 gap-2 rounded-xl border border-white/80 bg-white/60 p-2.5 text-xs tabular-nums shadow-2xs">
              <div>
                <div className="text-[11px] text-slate-500">
                  Cash ({financials.confirmed_cash_deals})
                </div>
                <div className="mt-0.5 font-semibold text-slate-900">
                  {formatInr(financials.confirmed_cash_value_inr)}
                </div>
              </div>
              <div className="border-l border-slate-200/70 pl-2.5">
                <div className="text-[11px] text-slate-500">
                  In-Kind ({financials.confirmed_in_kind_deals})
                </div>
                <div className="mt-0.5 font-semibold text-slate-900">
                  {formatInr(financials.confirmed_in_kind_value_inr)}
                </div>
              </div>
            </div>
            <div className="mt-2 text-[11px] text-slate-500">
              Face value across confirmed deals (not bank receipt)
            </div>
          </div>
        </div>

        {/* Card 4: Verified Cash Collected */}
        <div
          className={`glass-card glass-card-hover flex flex-col justify-between p-5 ${
            hasReceipts
              ? 'ring-1 ring-emerald-300/60'
              : 'ring-1 ring-amber-300/60'
          }`}
        >
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Verified Cash Collected
              </span>
              <span
                className={`rounded-xl p-2 ring-1 ${
                  hasReceipts
                    ? 'bg-emerald-50/90 text-emerald-600 ring-emerald-200/70'
                    : 'bg-amber-50/90 text-amber-600 ring-amber-200/70'
                }`}
              >
                <Banknote className="h-4 w-4" />
              </span>
            </div>

            {hasReceipts ? (
              <div className="mt-3">
                <div className="text-3xl font-bold tracking-tight text-emerald-950 tabular-nums">
                  {formatInr(financials.verified_cash_collected_inr)}
                </div>
                <div className="mt-2.5 flex items-center gap-1.5 text-xs font-medium text-emerald-800 tabular-nums">
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                  <span>
                    {financials.cash_receipts_logged_deals} deal(s) logged •{' '}
                    {financials.confirmed_cash_value_inr > 0
                      ? `${Math.round(
                          ((financials.verified_cash_collected_inr ?? 0) /
                            financials.confirmed_cash_value_inr) *
                            100
                        )}% of cash value`
                      : 'Live receipt'}
                  </span>
                </div>
              </div>
            ) : (
              <div className="mt-3">
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200/80 bg-amber-50/90 px-2.5 py-1 text-xs font-semibold text-amber-900">
                  <AlertCircle className="h-3.5 w-3.5 text-amber-600" />
                  Not recorded in source
                </span>
                <p className="mt-2.5 text-xs leading-relaxed text-slate-600 tabular-nums">
                  <code className="rounded bg-slate-100/90 px-1 py-0.5 font-mono text-[11px] text-slate-800">
                    cash_collected_inr
                  </code>{' '}
                  is <code className="font-mono text-[11px]">NULL</code>.{' '}
                  {formatLakhs(financials.confirmed_cash_value_inr)} cash is contracted only.
                </p>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={onNavigateToPipeline}
            className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 transition hover:text-indigo-800"
          >
            Log cash receipts in Pipeline <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </section>

      {/* Dark Glassmorphic Hero Diagnostic Banner */}
      <section className="relative overflow-hidden rounded-2xl border border-white/15 bg-gradient-to-br from-slate-900/95 via-indigo-950/95 to-slate-900/95 px-6 py-5 text-white shadow-xl backdrop-blur-xl">
        {/* Subtle radial highlight accents */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-20 -right-12 h-56 w-56 rounded-full bg-indigo-500/25 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-24 left-1/4 h-52 w-52 rounded-full bg-emerald-500/15 blur-3xl"
        />

        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-indigo-200 backdrop-blur-md">
              <TrendingUp className="h-3 w-3 text-emerald-300" />
              Core Growth Diagnostic • {summary.as_of_date}
            </div>
            <p className="text-sm font-semibold tracking-tight text-white sm:text-base tabular-nums">
              {outboundZero && warmShareDealsPct === 100
                ? `${Math.round(outbound_vs_warm.outbound_effort_share_pct)}% Cold Outbound Effort = ₹0 vs ${Math.round(outbound_vs_warm.warm_effort_share_pct)}% Warm Effort = 100% Revenue`
                : `${outbound_vs_warm.outbound_effort_share_pct}% Outbound Effort = ${formatInr(outbound_vs_warm.outbound_confirmed_value_inr)} vs ${outbound_vs_warm.warm_effort_share_pct}% Warm Effort = ${formatInr(outbound_vs_warm.warm_confirmed_value_inr)}`}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:flex sm:items-center tabular-nums">
            <div className="rounded-xl border border-rose-400/25 bg-rose-500/10 px-4 py-2.5 shadow-[0_0_24px_rgba(244,63,94,0.12)] backdrop-blur-md">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-rose-200/80">
                Cold Outbound
              </div>
              <div className="mt-0.5 text-sm font-bold text-rose-200">
                {outbound_vs_warm.outbound_attempts} touches →{' '}
                {formatInr(outbound_vs_warm.outbound_confirmed_value_inr)}
              </div>
            </div>
            <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/15 px-4 py-2.5 shadow-[0_0_24px_rgba(16,185,129,0.18)] backdrop-blur-md">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-emerald-200/90">
                Warm Channels
              </div>
              <div className="mt-0.5 text-sm font-bold text-emerald-300">
                {outbound_vs_warm.warm_attempts} touches →{' '}
                {formatInr(outbound_vs_warm.warm_confirmed_value_inr)}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Funnel Chart + Population Integrity Panel */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="glass-card p-6 lg:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold tracking-tight text-slate-900">
                Sponsor Acquisition Funnel (IST Point-in-Time)
              </h2>
              <p className="mt-0.5 text-xs text-slate-600">
                Distinct entity populations from total brands through confirmed partnerships
              </p>
            </div>
            <div className="glass-pill inline-flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs text-slate-600 tabular-nums">
              <Layers className="h-3.5 w-3.5 text-indigo-600" />
              <span>
                Brand → Confirmed:{' '}
                <strong className="font-semibold text-slate-900">
                  {populations.total_brands > 0
                    ? (
                        (populations.confirmed_opportunities / populations.total_brands) *
                        100
                      ).toFixed(1)
                    : '0.0'}
                  %
                </strong>
              </span>
            </div>
          </div>

          <div className="mt-5 h-72 w-full">
            {mounted ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={funnel}
                  layout="vertical"
                  margin={{ top: 4, right: 28, left: 16, bottom: 4 }}
                >
                  <defs>
                    {FUNNEL_GRADIENTS.map((g) => (
                      <linearGradient key={g.id} id={g.id} x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor={g.start} stopOpacity={0.92} />
                        <stop offset="100%" stopColor={g.end} stopOpacity={1} />
                      </linearGradient>
                    ))}
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E2E8F0" />
                  <XAxis type="number" tick={{ fontSize: 12, fill: '#64748B' }} />
                  <YAxis
                    type="category"
                    dataKey="step"
                    width={136}
                    tick={{ fontSize: 12, fill: '#334155', fontWeight: 500 }}
                  />
                  <Tooltip
                    cursor={{ fill: 'rgba(99, 102, 241, 0.06)' }}
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const item = payload[0].payload as (typeof funnel)[number];
                      return (
                        <div className="rounded-xl border border-white/80 bg-white/90 px-3.5 py-2.5 text-xs shadow-xl backdrop-blur-md tabular-nums">
                          <div className="font-semibold text-slate-900">{item.step}</div>
                          <div className="mt-0.5 text-slate-600">
                            Count: <strong className="text-slate-900">{item.count}</strong>
                          </div>
                          {item.conversion_from_prev_pct !== null && (
                            <div className="font-medium text-indigo-600">
                              Step conversion: {item.conversion_from_prev_pct}%
                            </div>
                          )}
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="count" radius={[0, 8, 8, 0]} barSize={26}>
                    {funnel.map((entry, idx) => (
                      <Cell
                        key={entry.step}
                        fill={`url(#${FUNNEL_GRADIENTS[idx % FUNNEL_GRADIENTS.length].id})`}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-slate-400">
                Loading funnel visualization...
              </div>
            )}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 border-t border-slate-200/60 pt-4 sm:grid-cols-6 tabular-nums">
            {funnel.map((f) => (
              <div
                key={f.step}
                className="rounded-xl border border-white/80 bg-white/60 px-2.5 py-2 text-center shadow-2xs"
              >
                <div className="truncate text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  {f.step}
                </div>
                <div className="mt-0.5 text-base font-bold text-slate-900">{f.count}</div>
                <div className="text-[11px] font-medium text-indigo-600">
                  {f.conversion_from_prev_pct === null
                    ? 'Base'
                    : `${f.conversion_from_prev_pct}% step`}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Separate Populations & Integrity Panel */}
        <div className="glass-card flex flex-col justify-between p-6">
          <div>
            <h2 className="text-base font-semibold tracking-tight text-slate-900">
              Population &amp; Integrity Checks
            </h2>
            <p className="mt-0.5 text-xs text-slate-600">
              Separate populations enforced — touches never inflated as brands
            </p>

            <dl className="mt-5 space-y-3 text-sm tabular-nums">
              <div className="flex items-center justify-between border-b border-slate-200/60 pb-2.5">
                <dt className="text-xs font-medium text-slate-600">Outreach Attempts</dt>
                <dd className="font-semibold text-slate-900">{populations.attempts}</dd>
              </div>
              <div className="flex items-center justify-between border-b border-slate-200/60 pb-2.5">
                <dt className="text-xs font-medium text-slate-600">Unique Contacts Touched</dt>
                <dd className="font-semibold text-slate-900">
                  {populations.unique_contacts_touched}
                </dd>
              </div>
              <div className="flex items-center justify-between border-b border-slate-200/60 pb-2.5">
                <dt className="text-xs font-medium text-slate-600">Positive Reply Brands</dt>
                <dd className="font-semibold text-slate-900">
                  {populations.positive_reply_brands}
                </dd>
              </div>
              <div className="flex items-center justify-between border-b border-slate-200/60 pb-2.5">
                <dt className="text-xs font-medium text-slate-600">
                  Unqualified Positive Replies
                </dt>
                <dd className="inline-flex items-center rounded-full bg-amber-50/90 px-2.5 py-0.5 text-xs font-semibold text-amber-800 ring-1 ring-amber-200/80">
                  {integrity_checks.unqualified_positive_reply_brands} brands
                </dd>
              </div>
              <div className="flex items-center justify-between border-b border-slate-200/60 pb-2.5">
                <dt className="text-xs font-medium text-slate-600">
                  Opps w/ Unqualified Brand
                </dt>
                <dd className="inline-flex items-center rounded-full bg-white/80 px-2.5 py-0.5 text-xs font-semibold text-slate-700 ring-1 ring-slate-200/80">
                  {integrity_checks.brands_with_opportunities_not_qualified} brands
                </dd>
              </div>
              <div className="flex items-center justify-between pt-1">
                <dt className="text-xs font-medium text-slate-600">Active Pipeline Value</dt>
                <dd className="text-base font-bold text-indigo-700">
                  {formatInr(financials.active_pipeline_proposed_inr)}
                </dd>
              </div>
            </dl>
          </div>

          <div className="mt-4 rounded-xl border border-white/80 bg-white/60 px-3 py-2 text-[11px] text-slate-600">
            History snapshots use latest version per entity with{' '}
            <code className="font-mono text-slate-800">effective_at &lt;= cutoff</code>.
          </div>
        </div>
      </section>

      {/* Channel Performance Table */}
      <section className="glass-card p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold tracking-tight text-slate-900">
              Channel Performance Matrix
            </h2>
            <p className="mt-0.5 text-xs text-slate-600">
              Outreach volume, reply classification, qualification yield, and confirmed deal
              revenue by channel
            </p>
          </div>
          <span className="glass-pill rounded-full px-3 py-1 text-xs font-medium text-slate-600 tabular-nums">
            Total attempts: <strong className="text-slate-900">{totalAttempts}</strong>
          </span>
        </div>

        <div className="mt-4 overflow-x-auto rounded-xl border border-white/80 bg-white/50">
          <table className="min-w-full divide-y divide-slate-200/70 text-sm tabular-nums">
            <thead className="bg-slate-50/70 backdrop-blur-md">
              <tr className="text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                <th className="px-4 py-3">Channel</th>
                <th className="px-4 py-3 text-right">Attempts</th>
                <th className="px-4 py-3 text-right">Reply %</th>
                <th className="px-4 py-3 text-right">Positive Reply %</th>
                <th className="px-4 py-3 text-right">Qualified</th>
                <th className="px-4 py-3 text-right">Opps</th>
                <th className="px-4 py-3 text-right">Confirmed</th>
                <th className="px-4 py-3 text-right">Deal Yield</th>
                <th className="px-4 py-3 text-right">Reported Value</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/50">
              {channel_performance.channels.map((ch) => {
                const isOutbound = ch.channel === 'email' || ch.channel === 'linkedin';
                const dealYield =
                  ch.attempts > 0 ? ((ch.confirmed_deals / ch.attempts) * 100).toFixed(1) : '0.0';
                return (
                  <tr key={ch.channel} className="transition hover:bg-indigo-50/40">
                    <td className="px-4 py-3.5 font-medium text-slate-900">
                      <div className="flex items-center gap-2">
                        <span>{CHANNEL_LABELS[ch.channel] ?? ch.channel}</span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                            isOutbound
                              ? 'bg-slate-100/90 text-slate-600'
                              : 'bg-emerald-50/90 text-emerald-700 ring-1 ring-emerald-200/70'
                          }`}
                        >
                          {isOutbound ? 'Outbound' : 'Warm'}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono text-xs text-slate-700">
                      {ch.attempts}
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono text-xs text-slate-700">
                      {ch.reply_rate_pct.toFixed(1)}%
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono text-xs text-slate-700">
                      {ch.positive_reply_rate_pct.toFixed(1)}%
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono text-xs text-slate-700">
                      {ch.qualified_brands}
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono text-xs text-slate-700">
                      {ch.opportunities}
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono text-xs font-semibold text-slate-900">
                      {ch.confirmed_deals}
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 font-mono text-[11px] font-semibold ${
                          ch.confirmed_deals > 0
                            ? 'bg-emerald-50/90 text-emerald-700 ring-1 ring-emerald-200/70'
                            : 'bg-rose-50/90 text-rose-700 ring-1 ring-rose-200/70'
                        }`}
                      >
                        {dealYield}%
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono text-xs font-semibold text-slate-900">
                      {formatInr(ch.confirmed_value_inr)}
                    </td>
                  </tr>
                );
              })}

              {/* Bolded Outbound vs Warm Subtotals */}
              <tr className="bg-slate-100/60 font-semibold text-slate-700">
                <td className="px-4 py-2.5 text-xs">
                  Cold Outbound Subtotal (Email + LinkedIn)
                </td>
                <td className="px-4 py-2.5 text-right font-mono text-xs">
                  {outbound_vs_warm.outbound_attempts}
                </td>
                <td colSpan={4} className="px-4 py-2.5 text-right text-[11px] text-slate-500">
                  {outbound_vs_warm.outbound_effort_share_pct}% of total outreach effort
                </td>
                <td className="px-4 py-2.5 text-right font-mono text-xs text-rose-700">
                  {outbound_vs_warm.outbound_confirmed_deals}
                </td>
                <td className="px-4 py-2.5 text-right font-mono text-xs text-rose-700">
                  {outbound_vs_warm.outbound_attempts > 0
                    ? (
                        (outbound_vs_warm.outbound_confirmed_deals /
                          outbound_vs_warm.outbound_attempts) *
                        100
                      ).toFixed(1)
                    : '0.0'}
                  %
                </td>
                <td className="px-4 py-2.5 text-right font-mono text-xs text-rose-700">
                  {formatInr(outbound_vs_warm.outbound_confirmed_value_inr)}
                </td>
              </tr>
              <tr className="bg-emerald-50/55 font-semibold text-slate-900">
                <td className="px-4 py-2.5 text-xs">
                  Warm Channels Subtotal (Intro + Web Inbound)
                </td>
                <td className="px-4 py-2.5 text-right font-mono text-xs">
                  {outbound_vs_warm.warm_attempts}
                </td>
                <td colSpan={4} className="px-4 py-2.5 text-right text-[11px] text-emerald-700">
                  {outbound_vs_warm.warm_effort_share_pct}% of total outreach effort
                </td>
                <td className="px-4 py-2.5 text-right font-mono text-xs text-emerald-700">
                  {outbound_vs_warm.warm_confirmed_deals}
                </td>
                <td className="px-4 py-2.5 text-right font-mono text-xs text-emerald-700">
                  {outbound_vs_warm.warm_attempts > 0
                    ? (
                        (outbound_vs_warm.warm_confirmed_deals / outbound_vs_warm.warm_attempts) *
                        100
                      ).toFixed(1)
                    : '0.0'}
                  %
                </td>
                <td className="px-4 py-2.5 text-right font-mono text-xs text-emerald-700">
                  {formatInr(outbound_vs_warm.warm_confirmed_value_inr)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Industry & Sponsor Concentration Breakdown */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="glass-card p-6 lg:col-span-2">
          <h2 className="text-base font-semibold tracking-tight text-slate-900">
            Confirmed Sponsorship Value by Industry
          </h2>
          <p className="mt-0.5 text-xs text-slate-600">
            Distribution of confirmed partner commitments across vertical categories
          </p>

          <div className="mt-5 h-72 w-full">
            {mounted && industry_concentration.industries.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={industry_concentration.industries}
                  margin={{ top: 8, right: 20, left: 12, bottom: 18 }}
                >
                  <defs>
                    {INDUSTRY_GRADIENTS.map((g) => (
                      <linearGradient key={g.id} id={g.id} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={g.start} stopOpacity={1} />
                        <stop offset="100%" stopColor={g.end} stopOpacity={0.82} />
                      </linearGradient>
                    ))}
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis
                    dataKey="industry"
                    tick={{ fontSize: 12, fill: '#64748B' }}
                    interval={0}
                    angle={-10}
                    textAnchor="end"
                    height={52}
                  />
                  <YAxis
                    tickFormatter={(v) => `₹${(Number(v) / 100000).toFixed(1)}L`}
                    tick={{ fontSize: 12, fill: '#64748B' }}
                  />
                  <Tooltip
                    cursor={{ fill: 'rgba(99, 102, 241, 0.06)' }}
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const item = payload[0]
                        .payload as (typeof industry_concentration.industries)[number];
                      return (
                        <div className="rounded-xl border border-white/80 bg-white/90 px-3.5 py-2.5 text-xs shadow-xl backdrop-blur-md tabular-nums">
                          <div className="font-semibold text-slate-900">{item.industry}</div>
                          <div className="mt-0.5 text-slate-600">
                            Confirmed:{' '}
                            <strong className="text-slate-900">
                              {formatInr(item.confirmed_value_inr)}
                            </strong>{' '}
                            ({item.share_pct}%)
                          </div>
                          <div className="text-slate-500">{item.confirmed_deals} deal(s)</div>
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="confirmed_value_inr" radius={[8, 8, 0, 0]} barSize={40}>
                    {industry_concentration.industries.map((entry, idx) => (
                      <Cell
                        key={entry.industry}
                        fill={`url(#${INDUSTRY_GRADIENTS[idx % INDUSTRY_GRADIENTS.length].id})`}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-slate-400">
                {mounted
                  ? 'No confirmed deals recorded as of this date.'
                  : 'Loading industry chart...'}
              </div>
            )}
          </div>
        </div>

        {/* Concentration Risk Panel */}
        <div className="glass-card p-6">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base font-semibold tracking-tight text-slate-900">
              Sponsor Concentration
            </h2>
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold tabular-nums ${
                concRisk === 'red'
                  ? 'bg-rose-50/90 text-rose-700 ring-1 ring-rose-200'
                  : concRisk === 'amber'
                    ? 'bg-amber-50/90 text-amber-800 ring-1 ring-amber-200'
                    : 'bg-emerald-50/90 text-emerald-700 ring-1 ring-emerald-200'
              }`}
            >
              <ShieldAlert className="h-3.5 w-3.5" />
              {concRisk === 'red'
                ? 'High Risk (>40%)'
                : concRisk === 'amber'
                  ? 'Watch (>30%)'
                  : 'Diversified (≤30%)'}
            </span>
          </div>

          {largest ? (
            <div className="mt-4 rounded-xl border border-white/80 bg-white/60 p-3.5 shadow-2xs tabular-nums">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Largest Single Sponsor
              </div>
              <div className="mt-1.5 flex items-baseline justify-between">
                <span className="text-sm font-semibold text-slate-900">
                  {largest.brand_name}{' '}
                  <span className="font-mono text-xs text-slate-500">({largest.brand_id})</span>
                </span>
                <span className="text-xl font-bold text-indigo-700">{largest.share_pct}%</span>
              </div>
              <div className="mt-0.5 text-xs text-slate-600">
                {formatInr(largest.confirmed_value_inr)} across {largest.confirmed_deals} deal(s)
              </div>
            </div>
          ) : (
            <p className="mt-3 text-xs text-slate-500">No confirmed sponsors yet.</p>
          )}

          <div className="mt-5 space-y-3 tabular-nums">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Top Confirmed Sponsors
            </div>
            {industry_concentration.top_sponsors.slice(0, 5).map((sp) => (
              <div key={sp.brand_id} className="space-y-1 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-medium text-slate-800">
                    {sp.brand_name}{' '}
                    <span className="text-slate-500">({sp.industry})</span>
                  </span>
                  <span className="shrink-0 font-mono font-semibold text-slate-900">
                    {formatInr(sp.confirmed_value_inr)} ({sp.share_pct}%)
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200/70">
                  <div
                    className={`h-full rounded-full ${
                      sp.share_pct > 30
                        ? 'bg-gradient-to-r from-amber-500 to-orange-500'
                        : 'bg-gradient-to-r from-indigo-500 to-violet-500'
                    }`}
                    style={{ width: `${Math.min(100, sp.share_pct * 2.5)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
