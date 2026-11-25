'use client';

import React, { useMemo, useState } from 'react';
import {
  Banknote,
  Bot,
  Check,
  CheckSquare,
  Edit3,
  Filter,
  Plus,
  Search,
  Trash2,
  User,
  X,
} from 'lucide-react';
import type {
  DashboardOpportunity,
  DashboardPayload,
  DealType,
  GrowthTaskRow,
  OpportunityStage,
} from '@/lib/types';
import { CHANNEL_LABELS, formatInr, STAGE_LABELS, STAGE_ORDER } from '@/lib/format';

interface PipelineTabProps {
  data: DashboardPayload;
  onRefresh: () => Promise<void>;
}

const STAGE_BADGE_CLASS: Record<OpportunityStage, string> = {
  prospecting: 'bg-slate-100 text-slate-700',
  contacted: 'bg-sky-100 text-sky-800',
  proposal_sent: 'bg-indigo-100 text-indigo-800',
  negotiating: 'bg-amber-100 text-amber-800',
  partner_confirmed: 'bg-emerald-100 text-emerald-800',
  lost: 'bg-rose-100 text-rose-800',
  withdrawn: 'bg-orange-100 text-orange-800',
};

const PRIORITY_BADGE_CLASS: Record<GrowthTaskRow['priority'], string> = {
  high: 'bg-rose-100 text-rose-800',
  medium: 'bg-amber-100 text-amber-800',
  low: 'bg-slate-100 text-slate-700',
};

export function PipelineTab({ data, onRefresh }: PipelineTabProps) {
  const { opportunities, tasks, channel_performance, reference, as_of_date } = data;

  // Opportunity filters
  const [searchQuery, setSearchQuery] = useState('');
  const [stageFilter, setStageFilter] = useState<string>('all');
  const [channelFilter, setChannelFilter] = useState<string>('all');
  const [ownerFilter, setOwnerFilter] = useState<string>('all');

  // Row mutation loading states
  const [savingOppId, setSavingOppId] = useState<string | null>(null);
  const [editingCashOppId, setEditingCashOppId] = useState<string | null>(null);
  const [cashInputValue, setCashInputValue] = useState<string>('');
  const [actionError, setActionError] = useState<string | null>(null);

  // Add Opportunity modal
  const [addOppOpen, setAddOppOpen] = useState(false);
  const [newOppBrandId, setNewOppBrandId] = useState<string>(reference.brands[0]?.brand_id ?? '');
  const [newOppContactId, setNewOppContactId] = useState<string>('');
  const [newOppCampaignId, setNewOppCampaignId] = useState<string>(
    reference.campaigns[0]?.sponsor_campaign_id ?? 'SC02'
  );
  const [newOppName, setNewOppName] = useState<string>('');
  const [newOppDealType, setNewOppDealType] = useState<DealType>('cash');
  const [newOppStage, setNewOppStage] = useState<OpportunityStage>('prospecting');
  const [newOppValue, setNewOppValue] = useState<string>('100000');
  const [newOppOwner, setNewOppOwner] = useState<string>(reference.owners[0] ?? 'Riya Kapoor');
  const [creatingOpp, setCreatingOpp] = useState(false);

  // Tasks state
  const [taskStatusFilter, setTaskStatusFilter] = useState<string>('all');
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<GrowthTaskRow | null>(null);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDesc, setTaskDesc] = useState('');
  const [taskOwner, setTaskOwner] = useState(reference.owners[0] ?? 'Riya Kapoor');
  const [taskPriority, setTaskPriority] = useState<'high' | 'medium' | 'low'>('medium');
  const [taskDueDate, setTaskDueDate] = useState('2025-04-10');
  const [taskBrandId, setTaskBrandId] = useState('');
  const [taskOppId, setTaskOppId] = useState('');
  const [savingTask, setSavingTask] = useState(false);

  const filteredOpps = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return opportunities.filter((o) => {
      if (stageFilter !== 'all' && o.stage !== stageFilter) return false;
      if (channelFilter !== 'all' && o.channel !== channelFilter) return false;
      if (ownerFilter !== 'all' && o.owner_name !== ownerFilter) return false;
      if (q) {
        const hay = `${o.opportunity_id} ${o.opportunity_name} ${o.brand_name} ${o.brand_id}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [opportunities, searchQuery, stageFilter, channelFilter, ownerFilter]);

  const filteredContactsForNewOpp = useMemo(() => {
    return reference.contacts.filter((c) => c.brand_id === newOppBrandId);
  }, [reference.contacts, newOppBrandId]);

  const filteredTasks = useMemo(() => {
    if (taskStatusFilter === 'all') return tasks;
    return tasks.filter((t) => t.status === taskStatusFilter);
  }, [tasks, taskStatusFilter]);

  async function handleStageChange(opp: DashboardOpportunity, nextStage: OpportunityStage) {
    if (nextStage === opp.stage) return;
    setActionError(null);
    setSavingOppId(opp.opportunity_id);
    try {
      const res = await fetch(`/api/opportunities/${opp.opportunity_id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stage: nextStage,
          as_of_date,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed updating stage');
      await onRefresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed updating stage');
    } finally {
      setSavingOppId(null);
    }
  }

  function startEditCash(opp: DashboardOpportunity) {
    setEditingCashOppId(opp.opportunity_id);
    setCashInputValue(opp.cash_collected_inr !== null ? String(opp.cash_collected_inr) : '');
  }

  async function saveCashCollected(oppId: string, clearToNull = false) {
    setActionError(null);
    setSavingOppId(oppId);
    try {
      const payloadValue =
        clearToNull || cashInputValue.trim() === '' ? null : Number(cashInputValue);
      if (payloadValue !== null && (!Number.isFinite(payloadValue) || payloadValue < 0)) {
        throw new Error('Cash collected must be a valid non-negative number.');
      }

      const res = await fetch(`/api/opportunities/${oppId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cash_collected_inr: payloadValue }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed saving cash collected');
      setEditingCashOppId(null);
      await onRefresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed saving cash receipt');
    } finally {
      setSavingOppId(null);
    }
  }

  function openNewOppModal() {
    const firstBrand = reference.brands[0];
    const firstBrandId = firstBrand?.brand_id ?? '';
    setNewOppBrandId(firstBrandId);
    const matchingContact = reference.contacts.find((c) => c.brand_id === firstBrandId);
    setNewOppContactId(matchingContact?.contact_id ?? '');
    setNewOppCampaignId(reference.campaigns[1]?.sponsor_campaign_id ?? 'SC02');
    setNewOppName(firstBrand ? `${firstBrand.brand_name} festival partnership` : '');
    setNewOppDealType('cash');
    setNewOppStage('prospecting');
    setNewOppValue('100000');
    setNewOppOwner(firstBrand?.owner_name ?? reference.owners[0] ?? 'Riya Kapoor');
    setAddOppOpen(true);
  }

  function handleBrandSelectForNewOpp(brandId: string) {
    setNewOppBrandId(brandId);
    const brand = reference.brands.find((b) => b.brand_id === brandId);
    const matchingContact = reference.contacts.find((c) => c.brand_id === brandId);
    setNewOppContactId(matchingContact?.contact_id ?? '');
    if (brand) {
      setNewOppName(`${brand.brand_name} festival partnership`);
      setNewOppOwner(brand.owner_name);
    }
  }

  async function handleCreateOpportunity(e: React.FormEvent) {
    e.preventDefault();
    setActionError(null);
    setCreatingOpp(true);
    try {
      const res = await fetch('/api/opportunities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brand_id: newOppBrandId,
          primary_contact_id: newOppContactId || null,
          sponsor_campaign_id: newOppCampaignId || null,
          opportunity_name: newOppName.trim() || undefined,
          deal_type: newOppDealType,
          stage: newOppStage,
          reported_value_inr: Number(newOppValue),
          owner_name: newOppOwner,
          as_of_date,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed creating opportunity');
      setAddOppOpen(false);
      await onRefresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed creating opportunity');
    } finally {
      setCreatingOpp(false);
    }
  }

  function openNewTaskModal() {
    setEditingTask(null);
    setTaskTitle('');
    setTaskDesc('');
    setTaskOwner(reference.owners[0] ?? 'Riya Kapoor');
    setTaskPriority('medium');
    setTaskDueDate('2025-04-10');
    setTaskBrandId('');
    setTaskOppId('');
    setTaskModalOpen(true);
  }

  function openEditTaskModal(task: GrowthTaskRow) {
    setEditingTask(task);
    setTaskTitle(task.title);
    setTaskDesc(task.description ?? '');
    setTaskOwner(task.owner_name);
    setTaskPriority(task.priority);
    setTaskDueDate(task.due_date ?? '');
    setTaskBrandId(task.linked_brand_id ?? '');
    setTaskOppId(task.linked_opportunity_id ?? '');
    setTaskModalOpen(true);
  }

  async function handleSaveTask(e: React.FormEvent) {
    e.preventDefault();
    setActionError(null);
    setSavingTask(true);
    try {
      const payload = {
        title: taskTitle,
        description: taskDesc || null,
        owner_name: taskOwner,
        priority: taskPriority,
        due_date: taskDueDate || null,
        linked_brand_id: taskBrandId || null,
        linked_opportunity_id: taskOppId || null,
        source: editingTask ? editingTask.source : ('manual' as const),
      };
      const url = editingTask ? `/api/tasks/${editingTask.task_id}` : '/api/tasks';
      const method = editingTask ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed saving task');
      setTaskModalOpen(false);
      await onRefresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed saving task');
    } finally {
      setSavingTask(false);
    }
  }

  async function handleTaskStatusChange(
    taskId: string,
    status: 'todo' | 'in_progress' | 'done'
  ) {
    setActionError(null);
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed updating task status');
      await onRefresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed updating task');
    }
  }

  async function handleDeleteTask(taskId: string) {
    setActionError(null);
    try {
      const res = await fetch(`/api/tasks/${taskId}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed deleting task');
      await onRefresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed deleting task');
    }
  }

  return (
    <div className="space-y-6">
      {actionError && (
        <div className="flex items-center justify-between rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          <span>{actionError}</span>
          <button type="button" onClick={() => setActionError(null)}>
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Campaigns Strip */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Acquisition Campaigns (SC01–SC06)
            </h2>
            <p className="text-xs text-slate-500">
              Campaign-level touch volume, qualification yield, and confirmed deal output as of{' '}
              {as_of_date}
            </p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {channel_performance.campaigns.map((camp) => (
            <div
              key={camp.sponsor_campaign_id}
              className="rounded-lg border border-slate-200 bg-slate-50/60 p-3.5"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="font-mono text-[11px] font-semibold text-indigo-600">
                    {camp.sponsor_campaign_id} • {CHANNEL_LABELS[camp.channel] ?? camp.channel}
                  </span>
                  <h3 className="text-sm font-semibold text-slate-900">{camp.campaign_name}</h3>
                </div>
                <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-slate-600 border border-slate-200">
                  {camp.owner_name}
                </span>
              </div>
              <div className="mt-3 grid grid-cols-4 gap-2 text-center text-xs">
                <div className="rounded bg-white p-1.5 border border-slate-100">
                  <div className="text-slate-400">Attempts</div>
                  <div className="font-semibold text-slate-900">{camp.attempts}</div>
                </div>
                <div className="rounded bg-white p-1.5 border border-slate-100">
                  <div className="text-slate-400">Qual.</div>
                  <div className="font-semibold text-slate-900">{camp.qualified_brands}</div>
                </div>
                <div className="rounded bg-white p-1.5 border border-slate-100">
                  <div className="text-slate-400">Confirmed</div>
                  <div className="font-semibold text-emerald-700">{camp.confirmed_deals}</div>
                </div>
                <div className="rounded bg-white p-1.5 border border-slate-100">
                  <div className="text-slate-400">Value</div>
                  <div className="font-semibold text-slate-900">
                    {camp.confirmed_value_inr > 0
                      ? `₹${(camp.confirmed_value_inr / 100000).toFixed(1)}L`
                      : '₹0'}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Interactive Opportunities Table */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Partner Opportunities Pipeline ({filteredOpps.length} of {opportunities.length})
            </h2>
            <p className="text-xs text-slate-500">
              Stage edits append versioned rows to <code className="font-mono">opportunity_history</code>{' '}
              on <strong className="text-slate-700">{as_of_date}</strong> so earlier snapshots stay
              intact.
            </p>
          </div>
          <button
            type="button"
            onClick={openNewOppModal}
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-slate-800"
          >
            <Plus className="h-3.5 w-3.5" />
            Add New Opportunity
          </button>
        </div>

        {/* Filters */}
        <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search brand, deal, or ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-xs text-slate-800 outline-none focus:border-indigo-500 focus:bg-white"
            />
          </div>

          <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5">
            <Filter className="h-3.5 w-3.5 text-slate-400" />
            <select
              aria-label="Filter by stage"
              value={stageFilter}
              onChange={(e) => setStageFilter(e.target.value)}
              className="w-full bg-transparent text-xs font-medium text-slate-700 outline-none"
            >
              <option value="all">All Stages</option>
              {STAGE_ORDER.map((st) => (
                <option key={st} value={st}>
                  {STAGE_LABELS[st]}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5">
            <Filter className="h-3.5 w-3.5 text-slate-400" />
            <select
              aria-label="Filter by channel"
              value={channelFilter}
              onChange={(e) => setChannelFilter(e.target.value)}
              className="w-full bg-transparent text-xs font-medium text-slate-700 outline-none"
            >
              <option value="all">All Channels</option>
              <option value="introduction">Warm Introductions</option>
              <option value="web_inbound">Web Inbound</option>
              <option value="linkedin">LinkedIn</option>
              <option value="email">Email</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5">
            <User className="h-3.5 w-3.5 text-slate-400" />
            <select
              aria-label="Filter by owner"
              value={ownerFilter}
              onChange={(e) => setOwnerFilter(e.target.value)}
              className="w-full bg-transparent text-xs font-medium text-slate-700 outline-none"
            >
              <option value="all">All Owners</option>
              {reference.owners.map((owner) => (
                <option key={owner} value={owner}>
                  {owner}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-xs">
            <thead>
              <tr className="bg-slate-50 text-left font-semibold uppercase tracking-wider text-slate-500">
                <th className="px-3 py-3">ID / Opportunity</th>
                <th className="px-3 py-3">Brand</th>
                <th className="px-3 py-3">Channel</th>
                <th className="px-3 py-3">Owner</th>
                <th className="px-3 py-3">Type</th>
                <th className="px-3 py-3">Stage (Editable)</th>
                <th className="px-3 py-3 text-right">Reported Value</th>
                <th className="px-3 py-3">Cash Collected (₹)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredOpps.map((opp) => {
                const isSaving = savingOppId === opp.opportunity_id;
                const isEditingCash = editingCashOppId === opp.opportunity_id;
                return (
                  <tr key={opp.opportunity_id} className="hover:bg-slate-50/70">
                    <td className="px-3 py-2.5">
                      <div className="font-mono font-semibold text-indigo-700">
                        {opp.opportunity_id}
                      </div>
                      <div className="max-w-[200px] truncate text-slate-700">
                        {opp.opportunity_name}
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="font-medium text-slate-900">{opp.brand_name}</div>
                      <div className="text-[11px] text-slate-500">
                        {opp.brand_id} • {opp.industry}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-slate-700">
                      <div>{CHANNEL_LABELS[opp.channel] ?? opp.channel}</div>
                      <div className="font-mono text-[11px] text-slate-400">
                        {opp.sponsor_campaign_id ?? '—'}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-slate-700">{opp.owner_name}</td>
                    <td className="px-3 py-2.5">
                      <span
                        className={`rounded-full px-2 py-0.5 font-medium ${
                          opp.deal_type === 'cash'
                            ? 'bg-sky-50 text-sky-800'
                            : 'bg-purple-50 text-purple-800'
                        }`}
                      >
                        {opp.deal_type === 'cash' ? 'Cash' : 'In-Kind'}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <select
                        aria-label={`Stage for ${opp.opportunity_id}`}
                        value={opp.stage}
                        disabled={isSaving}
                        onChange={(e) =>
                          handleStageChange(opp, e.target.value as OpportunityStage)
                        }
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold outline-none ring-1 ring-inset ring-slate-200 ${
                          STAGE_BADGE_CLASS[opp.stage]
                        }`}
                      >
                        {STAGE_ORDER.map((st) => (
                          <option key={st} value={st} className="bg-white text-slate-900">
                            {STAGE_LABELS[st]}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono font-semibold text-slate-900">
                      {formatInr(opp.reported_value_inr)}
                    </td>
                    <td className="px-3 py-2.5">
                      {isEditingCash ? (
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            min={0}
                            step={1000}
                            value={cashInputValue}
                            onChange={(e) => setCashInputValue(e.target.value)}
                            placeholder="₹ amount"
                            className="w-24 rounded border border-indigo-300 bg-white px-2 py-1 font-mono text-xs text-slate-900 outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => saveCashCollected(opp.opportunity_id, false)}
                            disabled={isSaving}
                            className="rounded bg-emerald-600 p-1 text-white hover:bg-emerald-700"
                            title="Save cash receipt"
                          >
                            <Check className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => saveCashCollected(opp.opportunity_id, true)}
                            disabled={isSaving}
                            className="rounded border border-slate-200 bg-white px-1.5 py-1 text-[10px] text-slate-600 hover:bg-slate-100"
                            title="Clear to NULL"
                          >
                            Null
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingCashOppId(null)}
                            className="rounded p-1 text-slate-400 hover:text-slate-700"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          {opp.cash_collected_inr !== null ? (
                            <span className="font-mono font-semibold text-emerald-700">
                              {formatInr(opp.cash_collected_inr)}
                            </span>
                          ) : (
                            <span className="text-amber-700">Not recorded</span>
                          )}
                          <button
                            type="button"
                            onClick={() => startEditCash(opp)}
                            className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-600 hover:bg-slate-50"
                          >
                            <Banknote className="h-3 w-3" />
                            Log
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filteredOpps.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                    No opportunities match your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Tasks & Action Items Board */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Growth Tasks &amp; Execution Board ({tasks.length})
            </h2>
            <p className="text-xs text-slate-500">
              Persisted in Supabase <code className="font-mono">growth_tasks</code> with{' '}
              <code className="font-mono">manual</code> vs <code className="font-mono">copilot</code>{' '}
              source tracking
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-xs">
              {(['all', 'todo', 'in_progress', 'done'] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setTaskStatusFilter(st)}
                  className={`rounded-md px-2.5 py-1 font-medium capitalize transition ${
                    taskStatusFilter === st
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {st.replace('_', ' ')}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={openNewTaskModal}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-indigo-700"
            >
              <Plus className="h-3.5 w-3.5" />
              New Task
            </button>
          </div>
        </div>

        <div className="mt-4 space-y-2.5">
          {filteredTasks.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/60 px-4 py-8 text-center text-xs text-slate-500">
              No tasks yet. Create a task here or click &ldquo;Assign Follow-up Task&rdquo; in Tab
              3&apos;s 48-Hour Qualification SLA Monitor.
            </div>
          ) : (
            filteredTasks.map((task) => (
              <div
                key={task.task_id}
                className="flex flex-col justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3.5 sm:flex-row sm:items-center"
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <CheckSquare
                      className={`h-4 w-4 ${
                        task.status === 'done' ? 'text-emerald-600' : 'text-slate-400'
                      }`}
                    />
                    <span
                      className={`text-sm font-semibold ${
                        task.status === 'done'
                          ? 'text-slate-400 line-through'
                          : 'text-slate-900'
                      }`}
                    >
                      {task.title}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase ${
                        PRIORITY_BADGE_CLASS[task.priority]
                      }`}
                    >
                      {task.priority}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        task.source === 'copilot'
                          ? 'bg-indigo-100 text-indigo-800'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {task.source === 'copilot' && <Bot className="h-3 w-3" />}
                      {task.source}
                    </span>
                  </div>
                  {task.description && (
                    <p className="text-xs text-slate-600">{task.description}</p>
                  )}
                  <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
                    <span>
                      Owner: <strong className="text-slate-700">{task.owner_name}</strong>
                    </span>
                    {task.due_date && (
                      <span>
                        Due: <strong className="text-slate-700">{task.due_date}</strong>
                      </span>
                    )}
                    {task.linked_brand_id && (
                      <span className="font-mono text-indigo-600">
                        Brand: {task.linked_brand_id}
                      </span>
                    )}
                    {task.linked_opportunity_id && (
                      <span className="font-mono text-indigo-600">
                        Opp: {task.linked_opportunity_id}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <select
                    aria-label={`Status for ${task.title}`}
                    value={task.status}
                    onChange={(e) =>
                      handleTaskStatusChange(
                        task.task_id,
                        e.target.value as 'todo' | 'in_progress' | 'done'
                      )
                    }
                    className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-800 outline-none"
                  >
                    <option value="todo">To Do</option>
                    <option value="in_progress">In Progress</option>
                    <option value="done">Done</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => openEditTaskModal(task)}
                    aria-label="Edit task"
                    className="rounded-lg border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-50"
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteTask(task.task_id)}
                    aria-label="Delete task"
                    className="rounded-lg border border-slate-200 p-1.5 text-rose-600 hover:bg-rose-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* Add Opportunity Modal */}
      {addOppOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <form
            onSubmit={handleCreateOpportunity}
            className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-xl"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900">Add New Opportunity</h3>
              <button type="button" onClick={() => setAddOppOpen(false)}>
                <X className="h-4 w-4 text-slate-500" />
              </button>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block text-xs font-medium text-slate-700 sm:col-span-2">
                Brand
                <select
                  value={newOppBrandId}
                  onChange={(e) => handleBrandSelectForNewOpp(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900"
                >
                  {reference.brands.map((b) => (
                    <option key={b.brand_id} value={b.brand_id}>
                      {b.brand_name} ({b.brand_id}) — {b.industry}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-xs font-medium text-slate-700 sm:col-span-2">
                Opportunity Name
                <input
                  type="text"
                  required
                  value={newOppName}
                  onChange={(e) => setNewOppName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900"
                />
              </label>

              <label className="block text-xs font-medium text-slate-700">
                Primary Contact
                <select
                  value={newOppContactId}
                  onChange={(e) => setNewOppContactId(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900"
                >
                  <option value="">None / Unspecified</option>
                  {filteredContactsForNewOpp.map((c) => (
                    <option key={c.contact_id} value={c.contact_id}>
                      {c.contact_name} ({c.job_title})
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-xs font-medium text-slate-700">
                Originating Campaign
                <select
                  value={newOppCampaignId}
                  onChange={(e) => setNewOppCampaignId(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900"
                >
                  {reference.campaigns.map((c) => (
                    <option key={c.sponsor_campaign_id} value={c.sponsor_campaign_id}>
                      {c.sponsor_campaign_id}: {c.campaign_name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-xs font-medium text-slate-700">
                Deal Type
                <select
                  value={newOppDealType}
                  onChange={(e) => setNewOppDealType(e.target.value as DealType)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900"
                >
                  <option value="cash">Cash</option>
                  <option value="in_kind">In-Kind</option>
                </select>
              </label>

              <label className="block text-xs font-medium text-slate-700">
                Initial Stage
                <select
                  value={newOppStage}
                  onChange={(e) => setNewOppStage(e.target.value as OpportunityStage)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900"
                >
                  {STAGE_ORDER.map((st) => (
                    <option key={st} value={st}>
                      {STAGE_LABELS[st]}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-xs font-medium text-slate-700">
                Reported Value (₹)
                <input
                  type="number"
                  required
                  min={0}
                  step={1000}
                  value={newOppValue}
                  onChange={(e) => setNewOppValue(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs text-slate-900"
                />
              </label>

              <label className="block text-xs font-medium text-slate-700">
                Owner
                <select
                  value={newOppOwner}
                  onChange={(e) => setNewOppOwner(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900"
                >
                  {reference.owners.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setAddOppOpen(false)}
                className="rounded-lg border border-slate-300 px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={creatingOpp}
                className="rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
              >
                {creatingOpp ? 'Creating...' : 'Create Opportunity'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Create / Edit Task Modal */}
      {taskModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <form
            onSubmit={handleSaveTask}
            className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-xl"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900">
                {editingTask ? 'Edit Task' : 'Create Growth Task'}
              </h3>
              <button type="button" onClick={() => setTaskModalOpen(false)}>
                <X className="h-4 w-4 text-slate-500" />
              </button>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block text-xs font-medium text-slate-700 sm:col-span-2">
                Task Title
                <input
                  type="text"
                  required
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  placeholder="e.g., Qualify positive reply from brand A042"
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900"
                />
              </label>

              <label className="block text-xs font-medium text-slate-700 sm:col-span-2">
                Description
                <textarea
                  rows={2}
                  value={taskDesc}
                  onChange={(e) => setTaskDesc(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900"
                />
              </label>

              <label className="block text-xs font-medium text-slate-700">
                Owner
                <select
                  value={taskOwner}
                  onChange={(e) => setTaskOwner(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900"
                >
                  {reference.owners.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-xs font-medium text-slate-700">
                Priority
                <select
                  value={taskPriority}
                  onChange={(e) => setTaskPriority(e.target.value as 'high' | 'medium' | 'low')}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900"
                >
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </label>

              <label className="block text-xs font-medium text-slate-700">
                Due Date
                <input
                  type="date"
                  value={taskDueDate}
                  onChange={(e) => setTaskDueDate(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900"
                />
              </label>

              <label className="block text-xs font-medium text-slate-700">
                Linked Brand (optional)
                <select
                  value={taskBrandId}
                  onChange={(e) => setTaskBrandId(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900"
                >
                  <option value="">None</option>
                  {reference.brands.map((b) => (
                    <option key={b.brand_id} value={b.brand_id}>
                      {b.brand_name} ({b.brand_id})
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-xs font-medium text-slate-700 sm:col-span-2">
                Linked Opportunity (optional)
                <select
                  value={taskOppId}
                  onChange={(e) => setTaskOppId(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900"
                >
                  <option value="">None</option>
                  {opportunities.map((o) => (
                    <option key={o.opportunity_id} value={o.opportunity_id}>
                      {o.opportunity_id}: {o.opportunity_name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setTaskModalOpen(false)}
                className="rounded-lg border border-slate-300 px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingTask}
                className="rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {savingTask ? 'Saving...' : editingTask ? 'Save Changes' : 'Create Task'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
