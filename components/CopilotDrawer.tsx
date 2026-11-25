'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  Bot,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Database,
  Link2,
  Loader2,
  Send,
  Sparkles,
  Trash2,
  User,
  X,
  XCircle,
} from 'lucide-react';
import type { ProposedTaskPayload, ToolExecutionLog } from '@/app/api/copilot/route';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  as_of_date?: string;
  tools_used?: ToolExecutionLog[];
  proposed_tasks?: ProposedTaskPayload[];
  isStreaming?: boolean;
}

type ProposalState = 'pending' | 'saving' | 'saved' | 'cancelled';

interface CopilotDrawerProps {
  open: boolean;
  onClose: () => void;
  asOfDate: string;
  onTaskCreated: () => Promise<void>;
}

const STARTER_PROMPTS = [
  'Why did we miss our 28-deal target?',
  'Compare Feb 28 vs Apr 20 pipeline',
  'What is our channel ROI and bank cash collected?',
  'Create a follow-up task for stalled negotiations',
];

let messageSeq = 0;
function nextMessageId(prefix: 'user' | 'assistant'): string {
  messageSeq += 1;
  return `${prefix}_${messageSeq}`;
}

function renderInlineFormatting(text: string): React.ReactNode[] {
  const tokens = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return tokens.map((part, idx) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return (
        <strong key={idx} className="font-semibold text-slate-900">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      return (
        <code
          key={idx}
          className="rounded bg-slate-100/90 px-1.5 py-0.5 font-mono text-[11px] font-medium text-indigo-700"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    return <React.Fragment key={idx}>{part}</React.Fragment>;
  });
}

function isTableRow(line: string): boolean {
  const t = line.trim();
  return t.startsWith('|') && t.endsWith('|') && t.includes('|');
}

function isTableSeparator(line: string): boolean {
  const t = line.trim();
  return isTableRow(t) && /^\|[\s:|-]+\|$/.test(t);
}

function splitTableCells(line: string): string[] {
  return line
    .trim()
    .slice(1, -1)
    .split('|')
    .map((c) => c.trim());
}

function FormattedResponse({ content }: { content: string }) {
  const lines = content.split(/\r?\n/);
  const blocks: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (isTableRow(trimmed) && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
      const headers = splitTableCells(trimmed);
      i += 2;
      const bodyRows: string[][] = [];
      while (i < lines.length && isTableRow(lines[i])) {
        bodyRows.push(splitTableCells(lines[i]));
        i += 1;
      }
      blocks.push(
        <div
          key={`tbl_${i}`}
          className="my-2.5 overflow-x-auto rounded-xl border border-slate-200/80 bg-white/80 shadow-2xs"
        >
          <table className="min-w-full divide-y divide-slate-200/80 text-[11px] tabular-nums">
            <thead className="bg-slate-50/80 backdrop-blur-md">
              <tr>
                {headers.map((h, hIdx) => (
                  <th
                    key={hIdx}
                    className="px-2.5 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500"
                  >
                    {renderInlineFormatting(h)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {bodyRows.map((row, rIdx) => (
                <tr key={rIdx} className="hover:bg-indigo-50/40">
                  {row.map((cell, cIdx) => (
                    <td key={cIdx} className="px-2.5 py-1.5 text-slate-700">
                      {renderInlineFormatting(cell.replace(/<br\s*\/?>/gi, ', '))}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    }

    if (!trimmed) {
      blocks.push(<div key={`sp_${i}`} className="h-1" />);
    } else if (trimmed === '---') {
      blocks.push(<hr key={`hr_${i}`} className="my-2 border-slate-200/80" />);
    } else if (trimmed.startsWith('### ') || trimmed.startsWith('## ')) {
      blocks.push(
        <div key={`hd_${i}`} className="pt-1.5 text-xs font-bold tracking-tight text-slate-900">
          {renderInlineFormatting(trimmed.replace(/^#{2,3}\s+/, ''))}
        </div>
      );
    } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      blocks.push(
        <div key={`li_${i}`} className="flex gap-2 pl-1">
          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-500" />
          <span>{renderInlineFormatting(trimmed.slice(2))}</span>
        </div>
      );
    } else {
      blocks.push(<p key={`p_${i}`}>{renderInlineFormatting(line)}</p>);
    }

    i += 1;
  }

  return (
    <div className="space-y-1.5 text-xs leading-relaxed text-slate-700 tabular-nums">{blocks}</div>
  );
}

export function CopilotDrawer({
  open,
  onClose,
  asOfDate,
  onTaskCreated,
}: CopilotDrawerProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [statusLabel, setStatusLabel] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [expandedToolMsgIds, setExpandedToolMsgIds] = useState<Record<string, boolean>>({});
  const [proposalStates, setProposalStates] = useState<Record<string, ProposalState>>({});

  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (open) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isSending, open]);

  if (!open) return null;

  async function sendPrompt(promptText: string) {
    const trimmed = promptText.trim();
    if (!trimmed || isSending) return;

    setErrorMsg(null);
    const userMsg: ChatMessage = {
      id: nextMessageId('user'),
      role: 'user',
      content: trimmed,
      as_of_date: asOfDate,
    };

    const nextMessages = [...messages, userMsg];
    const assistantMsgId = nextMessageId('assistant');
    setMessages([
      ...nextMessages,
      {
        id: assistantMsgId,
        role: 'assistant',
        content: '',
        as_of_date: asOfDate,
        isStreaming: true,
      },
    ]);
    setInput('');
    setIsSending(true);
    setStatusLabel(`Connecting to ${asOfDate} snapshot...`);

    try {
      const res = await fetch('/api/copilot', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
        },
        body: JSON.stringify({
          as_of_date: asOfDate,
          messages: nextMessages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      const contentType = res.headers.get('content-type') ?? '';
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Failed contacting AI Copilot');
      }

      // Fallback if server returned standard JSON instead of SSE
      if (contentType.includes('application/json') || !res.body) {
        const json = await res.json();
        const proposals: ProposedTaskPayload[] = Array.isArray(json.proposed_tasks)
          ? json.proposed_tasks
          : [];
        if (proposals.length > 0) {
          setProposalStates((prev) => {
            const updated = { ...prev };
            for (const p of proposals) {
              if (!updated[p.proposal_id]) updated[p.proposal_id] = 'pending';
            }
            return updated;
          });
        }
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsgId
              ? {
                  ...m,
                  content: String(json.reply ?? ''),
                  as_of_date: json.as_of_date ?? asOfDate,
                  tools_used: Array.isArray(json.tools_used) ? json.tools_used : [],
                  proposed_tasks: proposals,
                  isStreaming: false,
                }
              : m
          )
        );
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let sseBuffer = '';

      const handleSsePayload = (rawData: string) => {
        const evt = JSON.parse(rawData) as
          | { type: 'status'; label?: string }
          | { type: 'token'; text?: string }
          | { type: 'replace'; text?: string }
          | {
              type: 'done';
              as_of_date?: string;
              tools_used?: ToolExecutionLog[];
              proposed_tasks?: ProposedTaskPayload[];
            }
          | { type: 'error'; error?: string };

        if (evt.type === 'status' && evt.label) {
          setStatusLabel(evt.label);
        } else if (evt.type === 'token' && evt.text) {
          setStatusLabel(null);
          const tokenText = evt.text;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsgId ? { ...m, content: m.content + tokenText } : m
            )
          );
        } else if (evt.type === 'replace' && typeof evt.text === 'string') {
          setStatusLabel(null);
          const fullText = evt.text;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsgId ? { ...m, content: fullText } : m
            )
          );
        } else if (evt.type === 'done') {
          setStatusLabel(null);
          const proposals: ProposedTaskPayload[] = Array.isArray(evt.proposed_tasks)
            ? evt.proposed_tasks
            : [];
          if (proposals.length > 0) {
            setProposalStates((prev) => {
              const updated = { ...prev };
              for (const p of proposals) {
                if (!updated[p.proposal_id]) updated[p.proposal_id] = 'pending';
              }
              return updated;
            });
          }
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsgId
                ? {
                    ...m,
                    as_of_date: evt.as_of_date ?? asOfDate,
                    tools_used: Array.isArray(evt.tools_used) ? evt.tools_used : [],
                    proposed_tasks: proposals,
                    isStreaming: false,
                  }
                : m
            )
          );
        } else if (evt.type === 'error') {
          throw new Error(evt.error || 'Copilot streaming error');
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        sseBuffer += decoder.decode(value, { stream: true });

        const events = sseBuffer.split(/\r?\n\r?\n/);
        sseBuffer = events.pop() ?? '';

        for (const eventBlock of events) {
          for (const line of eventBlock.split(/\r?\n/)) {
            if (!line.startsWith('data: ')) continue;
            const jsonStr = line.slice(6).trim();
            if (!jsonStr) continue;
            handleSsePayload(jsonStr);
          }
        }
      }

      if (sseBuffer.trim()) {
        for (const line of sseBuffer.split(/\r?\n/)) {
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr) handleSsePayload(jsonStr);
        }
      }

      // Ensure streaming flag is cleared when stream ends
      setMessages((prev) =>
        prev.map((m) => (m.id === assistantMsgId ? { ...m, isStreaming: false } : m))
      );
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Copilot request failed');
      setMessages((prev) =>
        prev
          .filter((m) => !(m.id === assistantMsgId && m.content.trim() === ''))
          .map((m) => (m.id === assistantMsgId ? { ...m, isStreaming: false } : m))
      );
    } finally {
      setIsSending(false);
      setStatusLabel(null);
    }
  }

  async function handleConfirmProposal(proposal: ProposedTaskPayload) {
    setErrorMsg(null);
    setProposalStates((prev) => ({ ...prev, [proposal.proposal_id]: 'saving' }));
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: proposal.title,
          description: `${proposal.description}${
            proposal.reason ? ` (Reason: ${proposal.reason})` : ''
          }`.trim(),
          owner_name: proposal.owner_name,
          due_date: proposal.due_date || null,
          priority: proposal.priority,
          linked_brand_id: proposal.linked_brand_id || null,
          linked_opportunity_id: proposal.linked_opportunity_id || null,
          source: 'copilot',
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Failed saving proposed task');
      }
      setProposalStates((prev) => ({ ...prev, [proposal.proposal_id]: 'saved' }));
      await onTaskCreated();
    } catch (err) {
      setProposalStates((prev) => ({ ...prev, [proposal.proposal_id]: 'pending' }));
      setErrorMsg(err instanceof Error ? err.message : 'Failed creating task');
    }
  }

  function handleCancelProposal(proposalId: string) {
    setProposalStates((prev) => ({ ...prev, [proposalId]: 'cancelled' }));
  }

  function handleClearChat() {
    setMessages([]);
    setProposalStates({});
    setExpandedToolMsgIds({});
    setErrorMsg(null);
  }

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-slate-900/35 backdrop-blur-sm transition-opacity">
      <div className="flex h-full w-full max-w-lg flex-col border-l border-white/80 bg-white/82 shadow-2xl backdrop-blur-2xl">
        {/* Dark Indigo Glass Header */}
        <div className="relative overflow-hidden bg-gradient-to-r from-slate-900/95 via-indigo-950/95 to-slate-900/95 px-5 py-4 text-white">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-10 right-8 h-28 w-28 rounded-full bg-indigo-500/25 blur-2xl"
          />
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/20 backdrop-blur-md">
                <Bot className="h-4.5 w-4.5 text-indigo-200" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-semibold tracking-tight text-white">
                    AI Growth Analyst &amp; Copilot
                  </h2>
                  <span className="rounded-full border border-emerald-400/30 bg-emerald-500/15 px-2 py-0.5 font-mono text-[10px] font-semibold text-emerald-300 tabular-nums">
                    Snapshot: {asOfDate}
                  </span>
                </div>
                <p className="mt-0.5 text-[11px] text-slate-300">
                  Gemini Flash • Server-side Supabase function calling
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              {messages.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearChat}
                  className="inline-flex items-center gap-1 rounded-lg border border-white/15 bg-white/10 px-2.5 py-1.5 text-[11px] font-medium text-slate-200 transition hover:bg-white/20 hover:text-white"
                >
                  <Trash2 className="h-3 w-3" />
                  Clear Chat
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                aria-label="Close AI Copilot drawer"
                className="rounded-lg p-1.5 text-slate-300 transition hover:bg-white/10 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Messages Area */}
        <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
          {messages.length === 0 && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-white/80 bg-white/75 p-4 shadow-[0_8px_24px_rgba(15,23,42,0.04)] backdrop-blur-md">
                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-indigo-600">
                  <Sparkles className="h-3.5 w-3.5" />
                  Live Deterministic Growth Analyst
                </div>
                <p className="mt-1.5 text-xs leading-relaxed text-slate-600">
                  Ask about funnel conversion, Feb 28 vs Apr 20 shifts, bank-receipt / ROI data
                  boundaries, or propose follow-up tasks directly from live Supabase data as of{' '}
                  <strong className="font-semibold text-slate-900 tabular-nums">{asOfDate}</strong>.
                </p>
              </div>

              <div>
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Starter Prompts
                </div>
                <div className="grid grid-cols-1 gap-2">
                  {STARTER_PROMPTS.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => void sendPrompt(prompt)}
                      className="rounded-xl border border-white/80 bg-white/75 px-3.5 py-2.5 text-left text-xs font-medium text-slate-800 shadow-[0_2px_10px_rgba(15,23,42,0.03)] backdrop-blur-md transition hover:border-indigo-200 hover:bg-indigo-50/80 hover:text-indigo-950"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {messages.map((msg) => {
            const isExpanded = Boolean(expandedToolMsgIds[msg.id]);
            const uniqueToolLabels = Array.from(
              new Set((msg.tools_used ?? []).map((t) => t.label))
            );

            return (
              <div
                key={msg.id}
                className={`flex flex-col ${
                  msg.role === 'user' ? 'items-end' : 'items-start'
                }`}
              >
                {msg.role === 'user' ? (
                  <div className="max-w-[85%] rounded-2xl rounded-tr-xs bg-gradient-to-br from-slate-900 via-indigo-950 to-indigo-900 px-4 py-2.5 text-xs leading-relaxed text-white shadow-md">
                    {msg.content}
                  </div>
                ) : (
                  <div className="w-full space-y-2.5">
                    {/* Collapsible Tools Pill */}
                    {msg.tools_used && msg.tools_used.length > 0 && (
                      <div className="inline-block max-w-full rounded-xl border border-white/80 bg-white/80 px-3 py-1.5 shadow-2xs backdrop-blur-md">
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedToolMsgIds((prev) => ({
                              ...prev,
                              [msg.id]: !prev[msg.id],
                            }))
                          }
                          className="flex items-center gap-1.5 text-[11px] font-medium text-slate-700 hover:text-slate-900"
                        >
                          <Database className="h-3 w-3 text-emerald-600" />
                          <span className="tabular-nums">
                            {uniqueToolLabels[0]}
                            {msg.tools_used.length > 1
                              ? ` (+${msg.tools_used.length - 1} tool call${
                                  msg.tools_used.length - 1 === 1 ? '' : 's'
                                })`
                              : ''}
                          </span>
                          {isExpanded ? (
                            <ChevronDown className="h-3 w-3 text-slate-400" />
                          ) : (
                            <ChevronRight className="h-3 w-3 text-slate-400" />
                          )}
                        </button>
                        {isExpanded && (
                          <ul className="mt-1.5 space-y-1 border-t border-slate-200/60 pt-1.5 font-mono text-[10px] text-slate-600">
                            {msg.tools_used.map((t, idx) => (
                              <li key={idx}>
                                • {t.tool}
                                {t.as_of_date ? ` (${t.as_of_date})` : ''} — {t.label}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}

                    {/* Frosted White Assistant Card */}
                    {(msg.content || !msg.isStreaming) && (
                      <div className="rounded-2xl rounded-tl-xs border border-white/80 bg-white/85 px-4 py-3.5 shadow-[0_8px_24px_rgba(15,23,42,0.05)] backdrop-blur-md">
                        <FormattedResponse content={msg.content} />
                        {msg.isStreaming && (
                          <span className="mt-1 inline-block h-3.5 w-1.5 animate-pulse rounded-xs bg-indigo-500 align-middle" />
                        )}
                      </div>
                    )}

                    {/* Elevated Action Confirmation Cards with Emerald Top Accent */}
                    {msg.proposed_tasks && msg.proposed_tasks.length > 0 && (
                      <div className="space-y-2.5">
                        {msg.proposed_tasks.map((proposal) => {
                          const state = proposalStates[proposal.proposal_id] ?? 'pending';
                          const linkedText = [
                            proposal.linked_brand_id ? `Brand ${proposal.linked_brand_id}` : null,
                            proposal.linked_opportunity_id
                              ? `Opp ${proposal.linked_opportunity_id}`
                              : null,
                          ]
                            .filter(Boolean)
                            .join(' • ');

                          return (
                            <div
                              key={proposal.proposal_id}
                              className="rounded-2xl border border-white/90 border-t-2 border-t-emerald-500 bg-white/90 p-4 shadow-[0_10px_28px_rgba(15,23,42,0.06)] backdrop-blur-md"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <div className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700">
                                    Proposed Growth Task
                                  </div>
                                  <div className="mt-0.5 text-xs font-semibold text-slate-900">
                                    {proposal.title}
                                  </div>
                                </div>
                                <span
                                  className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                                    proposal.priority === 'high'
                                      ? 'bg-rose-50/90 text-rose-700 ring-1 ring-rose-200'
                                      : proposal.priority === 'low'
                                        ? 'bg-slate-100 text-slate-700 ring-1 ring-slate-200'
                                        : 'bg-amber-50/90 text-amber-800 ring-1 ring-amber-200'
                                  }`}
                                >
                                  {proposal.priority}
                                </span>
                              </div>

                              <p className="mt-1.5 text-xs leading-relaxed text-slate-600">
                                {proposal.reason || proposal.description}
                              </p>

                              {/* Structured Metadata Grid */}
                              <div className="mt-3 grid grid-cols-2 gap-2 rounded-xl border border-slate-200/70 bg-slate-50/75 p-2.5 text-[11px] tabular-nums">
                                <div className="flex items-center gap-1.5 text-slate-600">
                                  <User className="h-3 w-3 text-slate-400" />
                                  <span className="truncate font-medium text-slate-900">
                                    {proposal.owner_name}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1.5 text-slate-600">
                                  <Calendar className="h-3 w-3 text-slate-400" />
                                  <span className="font-mono font-medium text-slate-900">
                                    {proposal.due_date}
                                  </span>
                                </div>
                                {linkedText && (
                                  <div className="col-span-2 flex items-center gap-1.5 text-indigo-700">
                                    <Link2 className="h-3 w-3 text-indigo-500" />
                                    <span className="font-mono font-semibold">{linkedText}</span>
                                  </div>
                                )}
                              </div>

                              <div className="mt-3 flex items-center justify-end gap-2">
                                {state === 'saved' ? (
                                  <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-50/90 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-200">
                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                    Saved to Tasks
                                  </span>
                                ) : state === 'cancelled' ? (
                                  <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-500">
                                    <XCircle className="h-3.5 w-3.5" />
                                    Cancelled
                                  </span>
                                ) : (
                                  <>
                                    <button
                                      type="button"
                                      disabled={state === 'saving'}
                                      onClick={() => handleCancelProposal(proposal.proposal_id)}
                                      className="rounded-lg border border-slate-200 bg-white/80 px-3 py-1.5 text-[11px] font-medium text-slate-600 transition hover:bg-white hover:text-slate-900 disabled:opacity-50"
                                    >
                                      Cancel
                                    </button>
                                    <button
                                      type="button"
                                      disabled={state === 'saving'}
                                      onClick={() => void handleConfirmProposal(proposal)}
                                      className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-[11px] font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50"
                                    >
                                      {state === 'saving' ? (
                                        <Loader2 className="h-3 w-3 animate-spin" />
                                      ) : (
                                        <CheckCircle2 className="h-3.5 w-3.5" />
                                      )}
                                      Confirm &amp; Create Task
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {isSending && statusLabel && (
            <div className="inline-flex items-center gap-2.5 rounded-xl border border-white/80 bg-white/85 px-3.5 py-2.5 text-xs font-medium text-slate-700 shadow-sm backdrop-blur-md">
              <span className="relative flex h-2 w-2 shrink-0">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-600" />
              <span>{statusLabel}</span>
            </div>
          )}

          {errorMsg && (
            <div className="rounded-xl border border-rose-200/80 bg-rose-50/90 px-3.5 py-2.5 text-xs text-rose-800 backdrop-blur-md">
              {errorMsg}
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Starter quick chips strip when conversation is active */}
        {messages.length > 0 && (
          <div className="flex gap-1.5 overflow-x-auto border-t border-white/70 bg-white/60 px-4 py-2 backdrop-blur-md">
            {STARTER_PROMPTS.map((p) => (
              <button
                key={p}
                type="button"
                disabled={isSending}
                onClick={() => void sendPrompt(p)}
                className="shrink-0 rounded-full border border-white/80 bg-white/75 px-2.5 py-1 text-[11px] font-medium text-slate-700 shadow-2xs backdrop-blur-md transition hover:border-indigo-200 hover:bg-indigo-50/80 hover:text-indigo-900 disabled:opacity-50"
              >
                {p}
              </button>
            ))}
          </div>
        )}

        {/* Composer */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void sendPrompt(input);
          }}
          className="flex items-center gap-2 border-t border-white/70 bg-white/70 p-4 backdrop-blur-md"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={`Ask about ${asOfDate} snapshot, channels, deals, or tasks...`}
            disabled={isSending}
            className="flex-1 rounded-xl border border-white/80 bg-white/85 px-3.5 py-2 text-xs text-slate-900 shadow-2xs outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-100"
          />
          <button
            type="submit"
            disabled={isSending || !input.trim()}
            aria-label="Send message"
            className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-slate-900 to-indigo-950 p-2.5 text-white shadow-sm transition hover:from-slate-800 hover:to-indigo-900 disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
