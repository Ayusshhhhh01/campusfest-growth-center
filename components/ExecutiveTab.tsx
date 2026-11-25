'use client';

import React, { useSyncExternalStore } from 'react';
import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
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

const FUNNEL_COLORS = ['#64748b', '#475569', '#6366f1', '#4f46e5', '#0ea5e9', '#10b981'];
const INDUSTRY_COLORS = ['#4f46e5', '#0ea5e9', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];

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

  const outboundZero = outbound_vs_warm.outbound_confirmed_deals === 0;
  const warmShareDealsPct =
    populations.confirmed_opportunities > 0
      ? Math.round(
          (outbound_vs_warm.warm_confirmed_deals / populations.confirmed_opportunities) * 100
        )
      : 0;

  return (
    <div className="space-y-6">
      {/* 4 Hero KPI Cards */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {/* Card 1: Qualified Brands */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Qualified Brands
            </span>
            <span className="rounded-lg bg-indigo-50 p-1.5 text-indigo-600">
              <Building2 className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold tracking-tight text-slate-900">
              {populations.qualified_brands}
            </span>
            <span className="text-sm font-medium text-slate-500">
              / {targets.qualified_brands_goal} target
            </span>
          </div>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className={`h-full rounded-full ${
                qualDelta >= 0 ? 'bg-emerald-500' : 'bg-indigo-600'
              }`}
              style={{ width: `${qualPct}%` }}
            />
          </div>
          <div className="mt-2.5 flex items-center justify-between text-xs">
            <span
              className={`font-semibold ${
                qualDelta >= 0 ? 'text-emerald-700' : 'text-amber-700'
              }`}
            >
              {qualDelta >= 0 ? `+${qualDelta} ahead of goal` : `${qualDelta} vs goal`}
            </span>
            <span className="text-slate-500">{targets.target_version ?? 'Target'}</span>
          </div>
        </div>

        {/* Card 2: Confirmed Partnerships */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Confirmed Partnerships
            </span>
            <span className="rounded-lg bg-emerald-50 p-1.5 text-emerald-600">
              <Handshake className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold tracking-tight text-slate-900">
              {populations.confirmed_opportunities}
            </span>
            <span className="text-sm font-medium text-slate-500">
              / {targets.confirmed_partnerships_goal} target
            </span>
          </div>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className={`h-full rounded-full ${
                confDelta >= 0 ? 'bg-emerald-500' : 'bg-amber-500'
              }`}
              style={{ width: `${confPct}%` }}
            />
          </div>
          <div className="mt-2.5 flex items-center justify-between text-xs">
            <span
              className={`font-semibold ${
                confDelta >= 0 ? 'text-emerald-700' : 'text-amber-700'
              }`}
            >
              {confDelta >= 0 ? `+${confDelta} vs goal` : `${confDelta} behind goal`}
            </span>
            <span className="text-slate-500">
              {integrity_checks.stage_breakdown.withdrawn > 0
                ? `${integrity_checks.stage_breakdown.withdrawn} withdrawn`
                : `${populations.opportunities} total opps`}
            </span>
          </div>
        </div>

        {/* Card 3: Reported Deal Value */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Reported Deal Value
            </span>
            <span className="rounded-lg bg-sky-50 p-1.5 text-sky-600">
              <IndianRupee className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold tracking-tight text-slate-900">
              {formatInr(financials.confirmed_reported_value_inr)}
            </span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 rounded-lg bg-slate-50 p-2 text-xs">
            <div>
              <div className="text-slate-500">Cash ({financials.confirmed_cash_deals})</div>
              <div className="font-semibold text-slate-800">
                {formatInr(financials.confirmed_cash_value_inr)}
              </div>
            </div>
            <div>
              <div className="text-slate-500">In-Kind ({financials.confirmed_in_kind_deals})</div>
              <div className="font-semibold text-slate-800">
                {formatInr(financials.confirmed_in_kind_value_inr)}
              </div>
            </div>
          </div>
          <div className="mt-2 text-xs text-slate-500">
            Face value across confirmed deals (not bank receipt)
          </div>
        </div>

        {/* Card 4: Verified Cash Collected */}
        <div
          className={`rounded-xl border p-5 shadow-xs ${
            hasReceipts ? 'border-emerald-200 bg-emerald-50/40' : 'border-amber-200 bg-amber-50/40'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-600">
              Verified Cash Collected
            </span>
            <span
              className={`rounded-lg p-1.5 ${
                hasReceipts ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
              }`}
            >
              <Banknote className="h-4 w-4" />
            </span>
          </div>

          {hasReceipts ? (
            <>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-3xl font-bold tracking-tight text-emerald-900">
                  {formatInr(financials.verified_cash_collected_inr)}
                </span>
              </div>
              <div className="mt-2.5 flex items-center gap-1.5 text-xs font-medium text-emerald-800">
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>
                  Logged across {financials.cash_receipts_logged_deals} deal(s) •{' '}
                  {financials.confirmed_cash_value_inr > 0
                    ? `${Math.round(
                        ((financials.verified_cash_collected_inr ?? 0) /
                          financials.confirmed_cash_value_inr) *
                          100
                      )}% of cash deals`
                    : 'Live receipt'}
                </span>
              </div>
            </>
          ) : (
            <>
              <div className="mt-3">
                <span className="inline-flex items-center gap-1.5 rounded-md bg-amber-100 px-2.5 py-1 text-sm font-semibold text-amber-900">
                  <AlertCircle className="h-4 w-4" />
                  Not recorded in source data
                </span>
              </div>
              <p className="mt-2.5 text-xs text-amber-800">
                Source dataset sets <code className="font-mono">cash_collected_inr = NULL</code>.
                Reported {formatLakhs(financials.confirmed_cash_value_inr)} cash is not bank proof.
              </p>
            </>
          )}

          <button
            type="button"
            onClick={onNavigateToPipeline}
            className="mt-2.5 inline-flex items-center gap-1 text-xs font-semibold text-indigo-700 hover:text-indigo-900"
          >
            Log cash receipts in Pipeline <ArrowRight className="h-3 w-3" />
          </button>
        </div>
      </section>

      {/* Funnel Chart + Population Integrity Strip */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs lg:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Sponsor Acquisition Funnel (IST Point-in-Time)
              </h2>
              <p className="text-xs text-slate-500">
                Distinct entity populations from total brands through confirmed partnerships
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-600">
              <Layers className="h-4 w-4 text-indigo-600" />
              <span>
                Overall Brand → Confirmed:{' '}
                <strong className="text-slate-900">
                  {populations.total_brands > 0
                    ? ((populations.confirmed_opportunities / populations.total_brands) * 100).toFixed(1)
                    : '0.0'}
                  %
                </strong>
              </span>
            </div>
          </div>

          <div className="mt-4 h-72 w-full">
            {mounted ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={funnel}
                  layout="vertical"
                  margin={{ top: 8, right: 32, left: 24, bottom: 8 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                  <XAxis type="number" tick={{ fontSize: 12, fill: '#475569' }} />
                  <YAxis
                    type="category"
                    dataKey="step"
                    width={132}
                    tick={{ fontSize: 12, fill: '#0f172a', fontWeight: 500 }}
                  />
                  <Tooltip
                    formatter={(value) => [String(value ?? 0), 'Count']}
                    contentStyle={{
                      borderRadius: '8px',
                      borderColor: '#e2e8f0',
                      fontSize: '12px',
                    }}
                  />
                  <Bar dataKey="count" radius={[0, 6, 6, 0]} barSize={28}>
                    {funnel.map((entry, idx) => (
                      <Cell key={entry.step} fill={FUNNEL_COLORS[idx % FUNNEL_COLORS.length]} />
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

          {/* Step conversion badges */}
          <div className="mt-3 grid grid-cols-2 gap-2 border-t border-slate-100 pt-3 sm:grid-cols-6">
            {funnel.map((f) => (
              <div key={f.step} className="rounded-lg bg-slate-50 px-2.5 py-2 text-center">
                <div className="truncate text-[11px] font-medium text-slate-500">{f.step}</div>
                <div className="text-sm font-bold text-slate-900">{f.count}</div>
                <div className="text-[11px] font-medium text-indigo-600">
                  {f.conversion_from_prev_pct === null ? 'Base' : `${f.conversion_from_prev_pct}% step`}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Separate Populations & Integrity Panel */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
          <h2 className="text-base font-semibold text-slate-900">
            Population &amp; Integrity Checks
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Separate populations enforced — touches never inflated as brands
          </p>

          <dl className="mt-4 space-y-2.5 text-sm">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <dt className="text-slate-600">Outreach Attempts</dt>
              <dd className="font-semibold text-slate-900">{populations.attempts}</dd>
            </div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <dt className="text-slate-600">Unique Contacts Touched</dt>
              <dd className="font-semibold text-slate-900">
                {populations.unique_contacts_touched}
              </dd>
            </div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <dt className="text-slate-600">Positive Reply Brands</dt>
              <dd className="font-semibold text-slate-900">{populations.positive_reply_brands}</dd>
            </div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <dt className="text-slate-600">Unqualified Positive Replies</dt>
              <dd className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                {integrity_checks.unqualified_positive_reply_brands} brands
              </dd>
            </div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <dt className="text-slate-600">Opps w/ Unqualified Brand</dt>
              <dd className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
                {integrity_checks.brands_with_opportunities_not_qualified} brands
              </dd>
            </div>
            <div className="flex items-center justify-between pt-1">
              <dt className="text-slate-600">Active Pipeline Value</dt>
              <dd className="font-semibold text-indigo-700">
                {formatInr(financials.active_pipeline_proposed_inr)}
              </dd>
            </div>
          </dl>
        </div>
      </section>

      {/* Channel Performance Table + Diagnostic Callout */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Channel Performance Matrix</h2>
            <p className="text-xs text-slate-500">
              Attempts, reply classifications, qualifications, and confirmed deal conversion by
              acquisition channel
            </p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-2 text-xs font-semibold text-rose-900">
            <TrendingUp className="h-4 w-4 shrink-0 text-rose-600" />
            <span>
              {outboundZero && warmShareDealsPct === 100
                ? `${Math.round(outbound_vs_warm.outbound_effort_share_pct)}% outbound effort = ₹0; ${Math.round(outbound_vs_warm.warm_effort_share_pct)}% warm effort = 100% of deals`
                : `${outbound_vs_warm.outbound_effort_share_pct}% outbound effort = ${formatInr(outbound_vs_warm.outbound_confirmed_value_inr)} (${outbound_vs_warm.outbound_confirmed_deals} deals); ${outbound_vs_warm.warm_effort_share_pct}% warm effort = ${formatInr(outbound_vs_warm.warm_confirmed_value_inr)} (${outbound_vs_warm.warm_confirmed_deals} deals)`}
            </span>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead>
              <tr className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                <th className="px-4 py-3">Channel</th>
                <th className="px-4 py-3 text-right">Attempts</th>
                <th className="px-4 py-3 text-right">Reply %</th>
                <th className="px-4 py-3 text-right">Positive Reply %</th>
                <th className="px-4 py-3 text-right">Qualified</th>
                <th className="px-4 py-3 text-right">Opps</th>
                <th className="px-4 py-3 text-right">Confirmed Deals</th>
                <th className="px-4 py-3 text-right">Reported Value</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {channel_performance.channels.map((ch) => {
                const isOutbound = ch.channel === 'email' || ch.channel === 'linkedin';
                return (
                  <tr key={ch.channel} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3 font-medium text-slate-900">
                      <div className="flex items-center gap-2">
                        <span>{CHANNEL_LABELS[ch.channel] ?? ch.channel}</span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                            isOutbound
                              ? 'bg-slate-100 text-slate-600'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {isOutbound ? 'Outbound' : 'Warm'}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-slate-700">
                      {ch.attempts}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-slate-700">
                      {ch.reply_rate_pct.toFixed(1)}%
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-slate-700">
                      {ch.positive_reply_rate_pct.toFixed(1)}%
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-slate-700">
                      {ch.qualified_brands}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-slate-700">
                      {ch.opportunities}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-semibold text-slate-900">
                      {ch.confirmed_deals}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-semibold text-slate-900">
                      {formatInr(ch.confirmed_value_inr)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Industry & Sponsor Concentration Breakdown */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs lg:col-span-2">
          <h2 className="text-base font-semibold text-slate-900">
            Confirmed Sponsorship Value by Industry
          </h2>
          <p className="text-xs text-slate-500">
            Distribution of confirmed partner value across industries
          </p>

          <div className="mt-4 h-72 w-full">
            {mounted && industry_concentration.industries.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={industry_concentration.industries}
                  margin={{ top: 8, right: 24, left: 16, bottom: 16 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis
                    dataKey="industry"
                    tick={{ fontSize: 11, fill: '#334155' }}
                    interval={0}
                    angle={-10}
                    textAnchor="end"
                    height={50}
                  />
                  <YAxis
                    tickFormatter={(v) => `₹${(Number(v) / 100000).toFixed(1)}L`}
                    tick={{ fontSize: 11, fill: '#475569' }}
                  />
                  <Tooltip
                    formatter={(value) => [formatInr(Number(value ?? 0)), 'Confirmed Value']}
                    contentStyle={{
                      borderRadius: '8px',
                      borderColor: '#e2e8f0',
                      fontSize: '12px',
                    }}
                  />
                  <Bar dataKey="confirmed_value_inr" radius={[6, 6, 0, 0]} barSize={38}>
                    {industry_concentration.industries.map((entry, idx) => (
                      <Cell
                        key={entry.industry}
                        fill={INDUSTRY_COLORS[idx % INDUSTRY_COLORS.length]}
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
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900">Sponsor Concentration</h2>
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                concRisk === 'red'
                  ? 'bg-rose-100 text-rose-800'
                  : concRisk === 'amber'
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-emerald-100 text-emerald-800'
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
            <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="text-xs text-slate-500">Largest Single Sponsor Share</div>
              <div className="mt-1 flex items-baseline justify-between">
                <span className="text-sm font-semibold text-slate-900">
                  {largest.brand_name}{' '}
                  <span className="font-mono text-xs text-slate-500">({largest.brand_id})</span>
                </span>
                <span className="text-lg font-bold text-indigo-700">{largest.share_pct}%</span>
              </div>
              <div className="mt-0.5 text-xs text-slate-600">
                {formatInr(largest.confirmed_value_inr)} across {largest.confirmed_deals} deal(s)
              </div>
            </div>
          ) : (
            <p className="mt-3 text-xs text-slate-500">No confirmed sponsors yet.</p>
          )}

          <div className="mt-4 space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Top Confirmed Sponsors
            </div>
            {industry_concentration.top_sponsors.slice(0, 5).map((sp) => (
              <div key={sp.brand_id} className="space-y-1 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-800">
                    {sp.brand_name}{' '}
                    <span className="text-slate-400">({sp.industry})</span>
                  </span>
                  <span className="font-mono font-semibold text-slate-900">
                    {formatInr(sp.confirmed_value_inr)} ({sp.share_pct}%)
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={`h-full rounded-full ${
                      sp.share_pct > 30 ? 'bg-amber-500' : 'bg-indigo-500'
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
