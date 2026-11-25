'use client';

import React, { useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  Bot,
  Calendar,
  Kanban,
  Layers,
  RotateCcw,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';

export type TabKey = 'executive' | 'pipeline' | 'strategy';

const PRESET_DATES = [
  { date: '2025-02-28', label: 'Feb 28' },
  { date: '2025-03-15', label: 'Mar 15' },
  { date: '2025-04-11', label: 'Apr 11' },
  { date: '2025-04-20', label: 'Apr 20' },
];

interface HeaderBarProps {
  asOfDate: string;
  onDateChange: (date: string) => void;
  activeTab: TabKey;
  onTabChange: (tab: TabKey) => void;
  onResetBaseline: () => Promise<void>;
  isResetting: boolean;
  isLoading: boolean;
  targetVersion: string | null;
  duplicatesRemoved: number;
  breachedSignalsCount: number;
  onToggleCopilot: () => void;
}

export function HeaderBar({
  asOfDate,
  onDateChange,
  activeTab,
  onTabChange,
  onResetBaseline,
  isResetting,
  isLoading,
  targetVersion,
  duplicatesRemoved,
  breachedSignalsCount,
  onToggleCopilot,
}: HeaderBarProps) {
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);

  async function handleConfirmReset() {
    await onResetBaseline();
    setConfirmResetOpen(false);
  }

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-white/70 bg-white/65 backdrop-blur-2xl shadow-[0_4px_24px_rgba(15,23,42,0.04)]">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          {/* Top Row: Brand Lockup & Controls */}
          <div className="flex flex-col gap-3.5 py-3.5 lg:flex-row lg:items-center lg:justify-between">
            {/* Brand Lockup */}
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-[0_4px_14px_rgba(99,102,241,0.35)] ring-1 ring-white/40">
                <Layers className="h-4.5 w-4.5 text-white" />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-base font-semibold tracking-tight text-slate-900 sm:text-lg">
                    CampusFest Bengaluru
                  </h1>
                  <span className="text-slate-300">/</span>
                  <span className="text-sm font-medium text-slate-600">
                    Sponsorship Growth Center
                  </span>
                  <span className="inline-flex items-center rounded-full border border-white/80 bg-white/75 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500 shadow-2xs">
                    Synthetic Case Data
                  </span>
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600 tabular-nums">
                  <span>
                    IST Cutoff:{' '}
                    <strong className="font-semibold text-slate-900">{asOfDate} 23:59</strong>
                  </span>
                  {targetVersion && (
                    <span className="inline-flex items-center gap-1">
                      <span className="text-slate-300">•</span>
                      <span>
                        Plan: <strong className="font-semibold text-slate-900">{targetVersion}</strong>
                      </span>
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1">
                    <span className="text-slate-300">•</span>
                    <span className="font-medium text-emerald-700">
                      {duplicatesRemoved} retry IDs deduplicated
                    </span>
                  </span>
                </div>
              </div>
            </div>

            {/* Right Controls */}
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Compact Date Snapshot Picker */}
              <div className="glass-pill flex flex-wrap items-center gap-1 rounded-xl p-1">
                {PRESET_DATES.map((preset) => {
                  const active = asOfDate === preset.date;
                  return (
                    <button
                      key={preset.date}
                      type="button"
                      onClick={() => onDateChange(preset.date)}
                      className={`rounded-lg px-2.5 py-1 text-xs font-medium tabular-nums transition ${
                        active
                          ? 'bg-white text-slate-900 shadow-xs ring-1 ring-slate-200/70'
                          : 'text-slate-600 hover:bg-white/50 hover:text-slate-900'
                      }`}
                    >
                      {preset.label}
                    </button>
                  );
                })}
                <label className="ml-0.5 flex items-center gap-1.5 rounded-lg border border-white/80 bg-white/85 px-2.5 py-1 text-xs text-slate-700 shadow-2xs">
                  <Calendar className="h-3.5 w-3.5 text-indigo-500" />
                  <input
                    type="date"
                    aria-label="Snapshot date (IST)"
                    value={asOfDate}
                    min="2025-01-15"
                    max="2025-04-20"
                    onChange={(e) => {
                      if (e.target.value) onDateChange(e.target.value);
                    }}
                    className="bg-transparent font-mono text-xs font-medium text-slate-800 outline-none tabular-nums"
                  />
                </label>
              </div>

              {/* Subtle Frosted Reset Button */}
              <button
                type="button"
                onClick={() => setConfirmResetOpen(true)}
                disabled={isResetting || isLoading}
                className="inline-flex items-center gap-1.5 rounded-xl border border-white/80 bg-white/75 px-3 py-2 text-xs font-medium text-slate-600 shadow-xs backdrop-blur-md transition hover:bg-white hover:text-slate-900 disabled:opacity-50"
              >
                <RotateCcw className={`h-3.5 w-3.5 ${isResetting ? 'animate-spin' : ''}`} />
                {isResetting ? 'Resetting...' : 'Reset to Baseline'}
              </button>

              {/* Prominent Glowing AI Copilot Button */}
              <button
                type="button"
                onClick={onToggleCopilot}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 px-3.5 py-2 text-xs font-semibold text-white shadow-[0_4px_16px_rgba(79,70,229,0.28)] ring-1 ring-white/15 transition hover:from-slate-800 hover:via-indigo-900 hover:to-slate-800"
              >
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                </span>
                <Bot className="h-3.5 w-3.5 text-indigo-200" />
                <span>AI Copilot</span>
                <Sparkles className="h-3 w-3 text-indigo-300" />
              </button>
            </div>
          </div>

          {/* Bottom Row: Frosted Segmented Pill Tab Bar */}
          <div className="pb-3">
            <nav
              className="glass-pill inline-flex w-full overflow-x-auto rounded-xl p-1 sm:w-auto"
              aria-label="Dashboard sections"
            >
              <button
                type="button"
                onClick={() => onTabChange('executive')}
                className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-semibold whitespace-nowrap transition ${
                  activeTab === 'executive'
                    ? 'bg-white text-slate-900 shadow-xs ring-1 ring-slate-200/70'
                    : 'text-slate-600 hover:bg-white/45 hover:text-slate-900'
                }`}
              >
                <BarChart3
                  className={`h-3.5 w-3.5 ${
                    activeTab === 'executive' ? 'text-indigo-600' : 'text-slate-500'
                  }`}
                />
                Executive Funnel &amp; Diagnostics
              </button>

              <button
                type="button"
                onClick={() => onTabChange('pipeline')}
                className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-semibold whitespace-nowrap transition ${
                  activeTab === 'pipeline'
                    ? 'bg-white text-slate-900 shadow-xs ring-1 ring-slate-200/70'
                    : 'text-slate-600 hover:bg-white/45 hover:text-slate-900'
                }`}
              >
                <Kanban
                  className={`h-3.5 w-3.5 ${
                    activeTab === 'pipeline' ? 'text-indigo-600' : 'text-slate-500'
                  }`}
                />
                Pipeline, Campaigns &amp; Execution
              </button>

              <button
                type="button"
                onClick={() => onTabChange('strategy')}
                className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-semibold whitespace-nowrap transition ${
                  activeTab === 'strategy'
                    ? 'bg-white text-slate-900 shadow-xs ring-1 ring-slate-200/70'
                    : 'text-slate-600 hover:bg-white/45 hover:text-slate-900'
                }`}
              >
                <ShieldAlert
                  className={`h-3.5 w-3.5 ${
                    activeTab === 'strategy' ? 'text-indigo-600' : 'text-slate-500'
                  }`}
                />
                Strategy Bets &amp; Early Warning
                {breachedSignalsCount > 0 && (
                  <span className="inline-flex items-center rounded-full bg-rose-100/90 px-1.5 py-0.5 text-[10px] font-bold text-rose-700 tabular-nums">
                    {breachedSignalsCount}
                  </span>
                )}
              </button>
            </nav>
          </div>
        </div>
      </header>

      {/* Reset Confirmation Modal */}
      {confirmResetOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/35 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-white/80 bg-white/90 p-6 shadow-2xl backdrop-blur-2xl">
            <div className="flex items-start gap-3.5">
              <div className="rounded-xl bg-amber-100/90 p-2.5 text-amber-700">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  Reset Database to Baseline?
                </h2>
                <p className="mt-1.5 text-xs leading-relaxed text-slate-600">
                  This restores all Supabase tables directly from{' '}
                  <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-800">
                    Sponsor Dataset.xlsx
                  </code>{' '}
                  (removing the 6 retry duplicates). Added deals, stage changes, logged cash
                  receipts, activation approvals, and tasks will be cleared.
                </p>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setConfirmResetOpen(false)}
                disabled={isResetting}
                className="rounded-xl border border-slate-200 bg-white/80 px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmReset}
                disabled={isResetting}
                className="rounded-xl bg-rose-600 px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-rose-700 disabled:opacity-50"
              >
                {isResetting ? 'Restoring Baseline...' : 'Confirm Reset'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
