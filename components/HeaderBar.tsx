'use client';

import React, { useState } from 'react';
import {
  Bot,
  Calendar,
  AlertTriangle,
  BarChart3,
  Kanban,
  RotateCcw,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';

export type TabKey = 'executive' | 'pipeline' | 'strategy';

const PRESET_DATES = [
  { date: '2025-02-28', label: '28 Feb (Launch Plan)' },
  { date: '2025-03-15', label: '15 Mar (Plan Shift)' },
  { date: '2025-04-11', label: '11 Apr (Pre-Fest)' },
  { date: '2025-04-20', label: '20 Apr (Baseline)' },
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
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-3 py-3.5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-lg font-semibold tracking-tight text-slate-900 sm:text-xl">
                  CampusFest Bengaluru — Sponsorship Growth Center
                </h1>
                <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">
                  Synthetic Case Data
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                <span>
                  Snapshot cutoff:{' '}
                  <strong className="font-medium text-slate-700">
                    {asOfDate} 23:59:59 IST
                  </strong>
                </span>
                {targetVersion && (
                  <span>
                    • Target:{' '}
                    <strong className="font-medium text-slate-700">{targetVersion}</strong>
                  </span>
                )}
                <span>
                  • Source integrity:{' '}
                  <strong className="font-medium text-emerald-700">
                    {duplicatesRemoved} exact duplicate IDs deduplicated
                  </strong>
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Quick date presets */}
              <div className="flex flex-wrap items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1">
                {PRESET_DATES.map((preset) => {
                  const active = asOfDate === preset.date;
                  return (
                    <button
                      key={preset.date}
                      type="button"
                      onClick={() => onDateChange(preset.date)}
                      className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                        active
                          ? 'bg-slate-900 text-white shadow-xs'
                          : 'text-slate-600 hover:bg-white hover:text-slate-900'
                      }`}
                    >
                      {preset.label}
                    </button>
                  );
                })}
                <label className="relative ml-1 flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700">
                  <Calendar className="h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="date"
                    aria-label="Snapshot date (IST)"
                    value={asOfDate}
                    min="2025-01-15"
                    max="2025-04-30"
                    onChange={(e) => {
                      if (e.target.value) onDateChange(e.target.value);
                    }}
                    className="bg-transparent text-xs font-medium text-slate-800 outline-none"
                  />
                </label>
              </div>

              <button
                type="button"
                onClick={() => setConfirmResetOpen(true)}
                disabled={isResetting || isLoading}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-xs transition hover:bg-slate-50 disabled:opacity-50"
              >
                <RotateCcw className={`h-3.5 w-3.5 ${isResetting ? 'animate-spin' : ''}`} />
                {isResetting ? 'Resetting...' : 'Reset to Baseline'}
              </button>

              <button
                type="button"
                onClick={onToggleCopilot}
                className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs transition hover:bg-indigo-700"
              >
                <Bot className="h-3.5 w-3.5" />
                AI Copilot
                <Sparkles className="h-3 w-3 text-indigo-200" />
              </button>
            </div>
          </div>

          {/* 3 Main Navigation Tabs */}
          <nav className="-mb-px flex gap-6 overflow-x-auto" aria-label="Dashboard sections">
            <button
              type="button"
              onClick={() => onTabChange('executive')}
              className={`inline-flex items-center gap-2 border-b-2 py-2.5 text-sm font-medium whitespace-nowrap transition ${
                activeTab === 'executive'
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-slate-600 hover:border-slate-300 hover:text-slate-900'
              }`}
            >
              <BarChart3 className="h-4 w-4" />
              Executive Funnel &amp; Diagnostics
            </button>

            <button
              type="button"
              onClick={() => onTabChange('pipeline')}
              className={`inline-flex items-center gap-2 border-b-2 py-2.5 text-sm font-medium whitespace-nowrap transition ${
                activeTab === 'pipeline'
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-slate-600 hover:border-slate-300 hover:text-slate-900'
              }`}
            >
              <Kanban className="h-4 w-4" />
              Pipeline, Campaigns &amp; Execution
            </button>

            <button
              type="button"
              onClick={() => onTabChange('strategy')}
              className={`inline-flex items-center gap-2 border-b-2 py-2.5 text-sm font-medium whitespace-nowrap transition ${
                activeTab === 'strategy'
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-slate-600 hover:border-slate-300 hover:text-slate-900'
              }`}
            >
              <ShieldAlert className="h-4 w-4" />
              Strategy Bets &amp; Early Warning
              {breachedSignalsCount > 0 && (
                <span className="inline-flex items-center rounded-full bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-700">
                  {breachedSignalsCount}
                </span>
              )}
            </button>
          </nav>
        </div>
      </header>

      {/* Reset Confirmation Modal */}
      {confirmResetOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="flex items-start gap-3">
              <div className="rounded-full bg-amber-100 p-2 text-amber-700">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  Reset Database to Baseline?
                </h2>
                <p className="mt-1.5 text-sm text-slate-600">
                  This will restore all tables directly from{' '}
                  <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">
                    Sponsor Dataset.xlsx
                  </code>{' '}
                  (deduplicating the 6 retry IDs). Any added opportunities, stage edits, logged
                  cash receipts, activation approvals, and tasks will be cleared.
                </p>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setConfirmResetOpen(false)}
                disabled={isResetting}
                className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmReset}
                disabled={isResetting}
                className="rounded-lg bg-rose-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
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
