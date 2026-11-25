'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import type { DashboardPayload } from '@/lib/types';
import { HeaderBar, type TabKey } from './HeaderBar';
import { ExecutiveTab } from './ExecutiveTab';
import { PipelineTab } from './PipelineTab';
import { StrategyTab } from './StrategyTab';
import { CopilotDrawer } from './CopilotDrawer';

export function GrowthCenterApp() {
  const [asOfDate, setAsOfDate] = useState<string>('2025-04-20');
  const [activeTab, setActiveTab] = useState<TabKey>('executive');
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isResetting, setIsResetting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [copilotOpen, setCopilotOpen] = useState<boolean>(false);

  const loadDashboardData = useCallback(async (dateToFetch: string) => {
    const res = await fetch(`/api/dashboard?as_of_date=${encodeURIComponent(dateToFetch)}`, {
      cache: 'no-store',
    });
    const json = await res.json();
    if (!res.ok) {
      throw new Error(json.error || 'Failed to load dashboard data');
    }
    return json as DashboardPayload;
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadDashboardData(asOfDate)
      .then((payload) => {
        if (!cancelled) {
          setData(payload);
          setError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unknown error loading dashboard');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [asOfDate, loadDashboardData]);

  const handleDateChange = useCallback((nextDate: string) => {
    setIsLoading(true);
    setError(null);
    setAsOfDate(nextDate);
  }, []);

  const handleRefresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const payload = await loadDashboardData(asOfDate);
      setData(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error loading dashboard');
    } finally {
      setIsLoading(false);
    }
  }, [asOfDate, loadDashboardData]);

  const handleResetBaseline = useCallback(async () => {
    setIsResetting(true);
    setError(null);
    try {
      const res = await fetch('/api/reset', { method: 'POST' });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Failed resetting database to baseline');
      }
      const payload = await loadDashboardData(asOfDate);
      setData(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed resetting baseline');
    } finally {
      setIsResetting(false);
    }
  }, [asOfDate, loadDashboardData]);

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900">
      <HeaderBar
        asOfDate={asOfDate}
        onDateChange={handleDateChange}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onResetBaseline={handleResetBaseline}
        isResetting={isResetting}
        isLoading={isLoading}
        targetVersion={data?.summary.targets.target_version ?? null}
        duplicatesRemoved={data?.summary.raw_duplicates_removed ?? 6}
        breachedSignalsCount={data?.bottlenecks.breached_signals.length ?? 0}
        onToggleCopilot={() => setCopilotOpen((prev) => !prev)}
      />

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {error && (
          <div className="mb-6 flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
            <span>{error}</span>
            <button
              type="button"
              onClick={() => void handleRefresh()}
              className="inline-flex items-center gap-1 rounded-md bg-white px-2.5 py-1 text-xs font-semibold text-rose-800 border border-rose-200 hover:bg-rose-100"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Retry
            </button>
          </div>
        )}

        {!data && isLoading ? (
          <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-slate-500">
            <Loader2 className="h-7 w-7 animate-spin text-indigo-600" />
            <p className="text-sm font-medium">
              Computing point-in-time IST snapshot for {asOfDate}...
            </p>
          </div>
        ) : data ? (
          <div className={isLoading ? 'opacity-70 transition-opacity' : 'transition-opacity'}>
            {activeTab === 'executive' && (
              <ExecutiveTab
                data={data}
                onNavigateToPipeline={() => setActiveTab('pipeline')}
              />
            )}
            {activeTab === 'pipeline' && <PipelineTab data={data} onRefresh={handleRefresh} />}
            {activeTab === 'strategy' && <StrategyTab data={data} onRefresh={handleRefresh} />}
          </div>
        ) : null}
      </main>

      <CopilotDrawer
        open={copilotOpen}
        onClose={() => setCopilotOpen(false)}
        asOfDate={asOfDate}
        onTaskCreated={handleRefresh}
      />
    </div>
  );
}
