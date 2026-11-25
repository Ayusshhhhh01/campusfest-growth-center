import { NextRequest, NextResponse } from 'next/server';
import {
  createPartFromFunctionResponse,
  GoogleGenAI,
  Type,
  type Content,
  type FunctionCall,
  type FunctionDeclaration,
  type Part,
} from '@google/genai';
import {
  DEFAULT_AS_OF_DATE,
  diagnoseBottlenecks,
  getChannelAndCampaignPerformance,
  getSnapshotSummary,
  listTasks,
  normalizeAsOfDate,
  queryOpportunities,
} from '@/lib/metrics';
import { ensureEnvLoaded } from '@/lib/supabase';

export interface ProposedTaskPayload {
  proposal_id: string;
  title: string;
  description: string;
  owner_name: string;
  due_date: string;
  priority: 'high' | 'medium' | 'low';
  reason: string;
  linked_brand_id?: string;
  linked_opportunity_id?: string;
}

export interface ToolExecutionLog {
  tool: string;
  label: string;
  as_of_date?: string;
  detail?: string;
}

interface IncomingMessage {
  role: 'user' | 'assistant';
  content: string;
}

const TOOL_DECLARATIONS: FunctionDeclaration[] = [
  {
    name: 'get_snapshot_summary',
    description:
      'Returns point-in-time IST snapshot summary from live Supabase: active target version and goals, separate funnel population counts (attempts, unique contacts, responding brands, positive replies, qualified brands, opportunities, confirmed partnerships), cash vs in-kind reported value, verified cash collected (NULL if unlogged), and integrity checks.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        as_of_date: {
          type: Type.STRING,
          description:
            'Optional YYYY-MM-DD snapshot date in Asia/Kolkata IST (e.g. 2025-04-20 or 2025-02-28). Defaults to the user currently selected date.',
        },
      },
    },
  },
  {
    name: 'get_channel_and_campaign_performance',
    description:
      'Returns channel-level (email, linkedin, introduction, web_inbound) and campaign-level (SC01-SC06) outreach attempts, reply %, positive reply %, qualified brands, opportunities, confirmed deals, reported value, and outbound vs warm effort rollup.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        as_of_date: {
          type: Type.STRING,
          description: 'Optional YYYY-MM-DD snapshot date in Asia/Kolkata IST.',
        },
      },
    },
  },
  {
    name: 'diagnose_bottlenecks',
    description:
      'Returns unqualified positive-reply brands (48-hour SLA monitor), stalled negotiations with days in stage, withdrawn/lost deals (including O006), and all 5 Early Warning signals with breached status.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        as_of_date: {
          type: Type.STRING,
          description: 'Optional YYYY-MM-DD snapshot date in Asia/Kolkata IST.',
        },
      },
    },
  },
  {
    name: 'query_opportunities',
    description:
      'Queries partner opportunities as of a point-in-time snapshot, optionally filtered by stage, industry, brand_name, or as_of_date. Returns exact opportunity_id, brand_id, sponsor_campaign_id, owner_name, stage, reported_value_inr, and cash_collected_inr.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        stage: {
          type: Type.STRING,
          description:
            'Optional stage filter: prospecting, contacted, proposal_sent, negotiating, partner_confirmed, lost, or withdrawn.',
        },
        industry: {
          type: Type.STRING,
          description: 'Optional industry substring filter.',
        },
        brand_name: {
          type: Type.STRING,
          description: 'Optional brand name substring filter.',
        },
        as_of_date: {
          type: Type.STRING,
          description: 'Optional YYYY-MM-DD snapshot date in Asia/Kolkata IST.',
        },
      },
    },
  },
  {
    name: 'list_tasks',
    description:
      'Lists existing tasks in the Supabase growth_tasks execution table, optionally filtered by status (todo, in_progress, done).',
    parameters: {
      type: Type.OBJECT,
      properties: {
        status: {
          type: Type.STRING,
          description: 'Optional task status filter: todo, in_progress, or done.',
        },
      },
    },
  },
  {
    name: 'propose_create_task',
    description:
      'Proposes a new follow-up task for user confirmation in the UI. Does NOT write to Supabase immediately; returns a structured action card that the user can confirm or cancel.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING, description: 'Short actionable task title.' },
        description: {
          type: Type.STRING,
          description: 'Detailed instructions citing relevant IDs and context.',
        },
        owner_name: {
          type: Type.STRING,
          description:
            'Responsible team member name (e.g. Riya Kapoor, Kabir Shah, Meera Iyer, Nisha Rao).',
        },
        due_date: {
          type: Type.STRING,
          description: 'Target due date in YYYY-MM-DD format.',
        },
        priority: {
          type: Type.STRING,
          description: 'Priority level: high, medium, or low.',
        },
        reason: {
          type: Type.STRING,
          description: 'Evidence-backed reason why this task matters now.',
        },
        linked_brand_id: {
          type: Type.STRING,
          description: 'Optional brand_id (e.g. A001).',
        },
        linked_opportunity_id: {
          type: Type.STRING,
          description: 'Optional opportunity_id (e.g. O012).',
        },
      },
      required: ['title', 'description', 'owner_name', 'due_date', 'priority', 'reason'],
    },
  },
];

function buildSystemInstruction(activeAsOfDate: string): string {
  return `You are the Embedded AI Growth Analyst & Copilot for CampusFest Bengaluru's Sponsorship Growth Center.
The user is currently viewing the point-in-time IST snapshot as of: ${activeAsOfDate} (cutoff ${activeAsOfDate}T23:59:59+05:30 Asia/Kolkata).

CORE RULES (NON-NEGOTIABLE):
1. Ground every metric in live server tool outputs. NEVER invent, estimate, extrapolate, or guess numbers from memory.
2. When the user asks about the current view without specifying a date, pass as_of_date="${activeAsOfDate}" to your tools. When comparing dates (e.g., Feb 28 vs Apr 20), call the snapshot/channel/bottleneck tools separately for each date (e.g., "2025-02-28" and "2025-04-20").
3. Always cite exact stable IDs (brand_id, opportunity_id, sponsor_campaign_id) and the exact as_of_date used in your answer.
4. Clearly separate **Sourced Facts** (verified from tool output) from **Recommendations / Assumptions**.
5. Keep separate populations distinct: never conflate outreach attempts, unique contacts touched, responding brands, positive-reply brands, qualified brands, opportunities, and confirmed partnerships.

MANDATORY "DATA CANNOT ANSWER / HONEST UNCERTAINTY" GUARDRAILS:
- **Bank Receipts / Cash Collected:** If asked about actual bank receipts or cash collected, inspect financials.verified_cash_collected_inr and financials.has_recorded_cash_receipts. If verified_cash_collected_inr is null on original source deals, explicitly state that reported INR values in the source dataset (e.g., ₹22,40,000 total reported: ₹20,00,000 cash + ₹2,40,000 in-kind at baseline) are NOT proof of bank receipt, and report verified_cash_collected_inr (NULL / not recorded in source data) separately.
- **Marketing Spend, CAC, or Channel ROI:** If asked for marketing spend, CAC, or channel ROI, explicitly state that the source dataset contains NO spend or cost figures, so CAC and financial ROI cannot be computed. You may still report attempt-to-deal efficiency and reported value by channel from tool output.
- **Partner Activations & Attendee Uplift:** If asked whether partner activations caused attendee uplift, explicitly state that the 3 activation links (Beardo A001/O001, Mosaic Mobility A003/O004, Maple Devices A006/O007) are observational associations linked 1–2 days post-confirmation and do NOT establish causal attendee uplift.
- **Synthetic / Fictional Case Data:** If asked about real-world claims regarding Beardo or any brand, explicitly note that CampusFest 2025 and all brands/contacts/outreach records are synthetic/fictional, and Beardo is an illustrative label only.

TASK PROPOSALS:
- When the user asks to create follow-up tasks (e.g., for stalled negotiations or unqualified positive replies), ALWAYS inspect live bottlenecks/opportunities and existing tasks (diagnose_bottlenecks, query_opportunities, list_tasks) first so you propose concrete tasks with real brand_id / opportunity_id / owner_name values.
- Call propose_create_task for each task you want to suggest (up to 3 focused, high-leverage tasks at a time unless asked for more). Tell the user the tasks are staged as confirmation cards and will only be saved when they click "Confirm & Create Task".`;
}

function summarizeToolLabel(toolName: string, asOfDate?: string): string {
  switch (toolName) {
    case 'get_snapshot_summary':
      return `Checked live snapshot · ${asOfDate ?? DEFAULT_AS_OF_DATE}`;
    case 'get_channel_and_campaign_performance':
      return `Checked channel & campaign performance · ${asOfDate ?? DEFAULT_AS_OF_DATE}`;
    case 'diagnose_bottlenecks':
      return `Diagnosed pipeline bottlenecks · ${asOfDate ?? DEFAULT_AS_OF_DATE}`;
    case 'query_opportunities':
      return `Queried opportunities · ${asOfDate ?? DEFAULT_AS_OF_DATE}`;
    case 'list_tasks':
      return 'Checked growth_tasks board';
    case 'propose_create_task':
      return 'Staged task proposal card';
    default:
      return toolName;
  }
}

function liveStatusLabel(toolName: string, asOfDate?: string): string {
  switch (toolName) {
    case 'get_snapshot_summary':
      return `Checking live snapshot (${asOfDate ?? DEFAULT_AS_OF_DATE})...`;
    case 'get_channel_and_campaign_performance':
      return `Analyzing channel & campaign performance (${asOfDate ?? DEFAULT_AS_OF_DATE})...`;
    case 'diagnose_bottlenecks':
      return `Diagnosing pipeline bottlenecks (${asOfDate ?? DEFAULT_AS_OF_DATE})...`;
    case 'query_opportunities':
      return `Querying opportunities (${asOfDate ?? DEFAULT_AS_OF_DATE})...`;
    case 'list_tasks':
      return 'Checking existing growth tasks...';
    case 'propose_create_task':
      return 'Staging task proposal card...';
    default:
      return `Running ${toolName}...`;
  }
}

export const maxDuration = 60;

const DEFAULT_FLASH_MODELS = [
  'gemini-3.5-flash',
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
];

function isQuotaError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED');
}

function isRetryableOrFallbackError(err: unknown): boolean {
  const name = err instanceof Error ? err.name : '';
  const msg = err instanceof Error ? err.message : String(err);
  const lower = msg.toLowerCase();
  return (
    name === 'AbortError' ||
    name === 'TimeoutError' ||
    lower.includes('aborted') ||
    lower.includes('timeout') ||
    msg.includes('404') ||
    msg.includes('NOT_FOUND') ||
    msg.includes('503') ||
    msg.includes('UNAVAILABLE') ||
    isQuotaError(err)
  );
}

function buildModelConfig(
  model: string,
  systemInstruction: string,
  timeoutMs: number,
  includeTools = true
) {
  return {
    systemInstruction,
    ...(includeTools ? { tools: [{ functionDeclarations: TOOL_DECLARATIONS }] } : {}),
    temperature: 0.2,
    ...(model === 'gemini-3.5-flash' ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
    abortSignal: AbortSignal.timeout(timeoutMs),
  };
}

async function generateWithFallback(
  ai: GoogleGenAI,
  models: string[],
  contents: Content[],
  systemInstruction: string
) {
  let lastError: unknown;
  const nonQuotaModels: string[] = [];

  for (const model of models) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents,
        config: buildModelConfig(model, systemInstruction, 15000, true),
      });
      return { response, model };
    } catch (err) {
      lastError = err;
      const errMsg = err instanceof Error ? err.message : String(err);
      console.warn(`[Copilot] Model ${model} failed: ${errMsg.slice(0, 220)}`);
      if (!isQuotaError(err) && !errMsg.includes('404') && !errMsg.includes('NOT_FOUND')) {
        nonQuotaModels.push(model);
      }
      if (isRetryableOrFallbackError(err)) {
        continue;
      }
      throw err;
    }
  }

  for (const model of nonQuotaModels) {
    await new Promise((r) => setTimeout(r, 1200));
    try {
      const response = await ai.models.generateContent({
        model,
        contents,
        config: buildModelConfig(model, systemInstruction, 18000, true),
      });
      return { response, model };
    } catch (err) {
      lastError = err;
      if (isRetryableOrFallbackError(err)) {
        continue;
      }
      throw err;
    }
  }

  throw lastError;
}

async function runToolRound(
  functionCalls: FunctionCall[],
  round: number,
  activeAsOfDate: string,
  toolLogs: ToolExecutionLog[],
  proposedTasks: ProposedTaskPayload[]
): Promise<Part[]> {
  return Promise.all(
    functionCalls.map(async (fc, idx) => {
      const name = fc.name ?? 'unknown';
      const args = (fc.args ?? {}) as Record<string, unknown>;
      const callId = fc.id ?? `${name}_${round}_${idx}`;

      try {
        let output: unknown;
        let loggedDate: string | undefined;

        if (name === 'get_snapshot_summary') {
          const targetDate = normalizeAsOfDate(
            typeof args.as_of_date === 'string' && args.as_of_date.trim()
              ? args.as_of_date
              : activeAsOfDate
          );
          loggedDate = targetDate;
          output = await getSnapshotSummary(targetDate);
        } else if (name === 'get_channel_and_campaign_performance') {
          const targetDate = normalizeAsOfDate(
            typeof args.as_of_date === 'string' && args.as_of_date.trim()
              ? args.as_of_date
              : activeAsOfDate
          );
          loggedDate = targetDate;
          output = await getChannelAndCampaignPerformance(targetDate);
        } else if (name === 'diagnose_bottlenecks') {
          const targetDate = normalizeAsOfDate(
            typeof args.as_of_date === 'string' && args.as_of_date.trim()
              ? args.as_of_date
              : activeAsOfDate
          );
          loggedDate = targetDate;
          output = await diagnoseBottlenecks(targetDate);
        } else if (name === 'query_opportunities') {
          const targetDate = normalizeAsOfDate(
            typeof args.as_of_date === 'string' && args.as_of_date.trim()
              ? args.as_of_date
              : activeAsOfDate
          );
          loggedDate = targetDate;
          output = await queryOpportunities({
            stage: typeof args.stage === 'string' ? args.stage : undefined,
            industry: typeof args.industry === 'string' ? args.industry : undefined,
            brand_name: typeof args.brand_name === 'string' ? args.brand_name : undefined,
            as_of_date: targetDate,
          });
        } else if (name === 'list_tasks') {
          const status = typeof args.status === 'string' ? args.status : undefined;
          const tasks = await listTasks(status);
          output = { count: tasks.length, tasks };
        } else if (name === 'propose_create_task') {
          const rawPriority = String(args.priority ?? 'medium').toLowerCase();
          const priority: 'high' | 'medium' | 'low' =
            rawPriority === 'high' || rawPriority === 'low' ? rawPriority : 'medium';

          const proposal: ProposedTaskPayload = {
            proposal_id: `prop_${Date.now()}_${proposedTasks.length + 1}`,
            title: String(args.title ?? 'Follow-up task').trim(),
            description: String(args.description ?? '').trim(),
            owner_name: String(args.owner_name ?? 'Riya Kapoor').trim(),
            due_date: String(args.due_date ?? activeAsOfDate).trim(),
            priority,
            reason: String(args.reason ?? '').trim(),
            linked_brand_id:
              typeof args.linked_brand_id === 'string' && args.linked_brand_id.trim()
                ? args.linked_brand_id.trim()
                : undefined,
            linked_opportunity_id:
              typeof args.linked_opportunity_id === 'string' && args.linked_opportunity_id.trim()
                ? args.linked_opportunity_id.trim()
                : undefined,
          };
          proposedTasks.push(proposal);
          output = {
            staged_for_confirmation: true,
            written_to_database: false,
            proposal,
          };
        } else {
          output = { error: `Unknown tool "${name}"` };
        }

        toolLogs.push({
          tool: name,
          label: summarizeToolLabel(name, loggedDate),
          as_of_date: loggedDate,
        });

        return createPartFromFunctionResponse(callId, name, { result: output });
      } catch (toolError) {
        const errMsg = toolError instanceof Error ? toolError.message : 'Tool execution failed';
        toolLogs.push({
          tool: name,
          label: `${name} failed: ${errMsg}`,
        });
        return createPartFromFunctionResponse(callId, name, { error: errMsg });
      }
    })
  );
}

/**
 * Streams a final response using generateContentStream with model fallback
 * if the stream fails before any chunk is received. If a chunk unexpectedly
 * emits function calls, returns them cleanly without emitting partial tokens.
 */
async function streamTurnWithFallback(
  ai: GoogleGenAI,
  models: string[],
  contents: Content[],
  systemInstruction: string,
  onToken: (text: string) => void,
  onReplace: (text: string) => void
): Promise<{
  model: string;
  functionCalls: FunctionCall[];
  modelParts: Part[];
  emittedTokens: boolean;
}> {
  let lastError: unknown;
  const nonQuotaModels: string[] = [];

  const attemptModel = async (model: string, timeoutMs: number) => {
    let emittedText = '';
    let firstTokenSeen = false;
    const collectedCalls: FunctionCall[] = [];
    const collectedParts: Part[] = [];

    const stream = await ai.models.generateContentStream({
      model,
      contents,
      config: buildModelConfig(model, systemInstruction, timeoutMs, true),
    });

    try {
      for await (const chunk of stream) {
        const parts = chunk.candidates?.[0]?.content?.parts ?? [];
        for (const p of parts) {
          if (p.functionCall) {
            collectedCalls.push(p.functionCall);
            collectedParts.push(p);
          }
        }
        if (collectedCalls.length === 0 && chunk.functionCalls?.length) {
          for (const fc of chunk.functionCalls) {
            collectedCalls.push(fc);
            collectedParts.push({ functionCall: fc });
          }
        }
        if (collectedCalls.length > 0) {
          continue;
        }

        let textChunk = '';
        for (const p of parts) {
          if (typeof p.text === 'string' && !p.thought) {
            textChunk += p.text;
          }
        }
        if (!textChunk && typeof chunk.text === 'string') {
          textChunk = chunk.text;
        }

        if (textChunk) {
          if (!firstTokenSeen) {
            firstTokenSeen = true;
            textChunk = textChunk.replace(/^thought\s*\r?\n/i, '');
          }
          if (textChunk) {
            emittedText += textChunk;
            onToken(textChunk);
          }
        }
      }

      return {
        model,
        functionCalls: collectedCalls,
        modelParts: collectedParts,
        emittedTokens: emittedText.length > 0,
      };
    } catch (err) {
      throw Object.assign(err instanceof Error ? err : new Error(String(err)), {
        _emittedText: emittedText,
      });
    }
  };

  const recoverMidStream = async (emittedText: string, failedModel: string) => {
    const fallbackOrder = [
      ...models.filter((m) => m !== failedModel),
      failedModel,
    ];
    const { response, model } = await generateWithFallback(
      ai,
      fallbackOrder,
      contents,
      systemInstruction
    );
    const functionCalls = response.functionCalls ?? [];
    if (functionCalls.length > 0) {
      const modelParts = response.candidates?.[0]?.content?.parts ?? [
        ...functionCalls.map((fc) => ({ functionCall: fc })),
      ];
      return {
        model,
        functionCalls,
        modelParts,
        emittedTokens: emittedText.length > 0,
      };
    }
    const fullText = (response.text?.trim() || 'No response generated.').replace(
      /^thought\s*\r?\n/i,
      ''
    );
    if (emittedText && fullText.startsWith(emittedText)) {
      const remaining = fullText.slice(emittedText.length);
      if (remaining) onToken(remaining);
    } else {
      onReplace(fullText);
    }
    return {
      model,
      functionCalls: [] as FunctionCall[],
      modelParts: [] as Part[],
      emittedTokens: true,
    };
  };

  for (const model of models) {
    try {
      return await attemptModel(model, 18000);
    } catch (err) {
      lastError = err;
      const errMsg = err instanceof Error ? err.message : String(err);
      const emittedText =
        typeof (err as { _emittedText?: unknown })._emittedText === 'string'
          ? (err as { _emittedText: string })._emittedText
          : '';
      console.warn(
        `[Copilot Stream] Model ${model} failed (emitted=${emittedText.length} chars): ${errMsg.slice(0, 220)}`
      );
      if (emittedText.length > 0 && isRetryableOrFallbackError(err)) {
        return await recoverMidStream(emittedText, model);
      }
      if (emittedText.length > 0) throw err;
      if (!isQuotaError(err) && !errMsg.includes('404') && !errMsg.includes('NOT_FOUND')) {
        nonQuotaModels.push(model);
      }
      if (isRetryableOrFallbackError(err)) {
        continue;
      }
      throw err;
    }
  }

  for (const model of nonQuotaModels) {
    await new Promise((r) => setTimeout(r, 1200));
    try {
      return await attemptModel(model, 20000);
    } catch (err) {
      lastError = err;
      const emittedText =
        typeof (err as { _emittedText?: unknown })._emittedText === 'string'
          ? (err as { _emittedText: string })._emittedText
          : '';
      if (emittedText.length > 0 && isRetryableOrFallbackError(err)) {
        return await recoverMidStream(emittedText, model);
      }
      if (emittedText.length > 0) throw err;
      if (isRetryableOrFallbackError(err)) {
        continue;
      }
      throw err;
    }
  }

  throw lastError;
}

export async function POST(request: NextRequest) {
  ensureEnvLoaded();

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'GEMINI_API_KEY is not configured in environment.' },
        { status: 500 }
      );
    }

    const body = (await request.json()) as {
      messages?: IncomingMessage[];
      as_of_date?: string;
    };

    const rawMessages = Array.isArray(body.messages) ? body.messages : [];
    if (rawMessages.length === 0) {
      return NextResponse.json({ error: 'messages array is required' }, { status: 400 });
    }

    const activeAsOfDate = normalizeAsOfDate(body.as_of_date ?? DEFAULT_AS_OF_DATE);

    const contents: Content[] = rawMessages
      .filter((m) => typeof m.content === 'string' && m.content.trim().length > 0)
      .map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));

    if (contents.length === 0) {
      return NextResponse.json(
        { error: 'At least one non-empty message is required' },
        { status: 400 }
      );
    }

    const streamParam = request.nextUrl.searchParams.get('stream');
    const acceptHeader = (request.headers.get('accept') ?? '').toLowerCase();
    const wantsJson =
      streamParam === 'false' ||
      (acceptHeader.includes('application/json') && !acceptHeader.includes('text/event-stream'));

    const ai = new GoogleGenAI({ apiKey });
    const modelCandidates = process.env.GEMINI_MODEL
      ? [
          process.env.GEMINI_MODEL,
          ...DEFAULT_FLASH_MODELS.filter((m) => m !== process.env.GEMINI_MODEL),
        ]
      : DEFAULT_FLASH_MODELS;
    const systemInstruction = buildSystemInstruction(activeAsOfDate);
    const MAX_ROUNDS = 8;

    // Non-streaming JSON fallback for automated tests or ?stream=false
    if (wantsJson) {
      let activeModel = modelCandidates[0];
      const toolLogs: ToolExecutionLog[] = [];
      const proposedTasks: ProposedTaskPayload[] = [];
      let finalText = '';

      for (let round = 0; round < MAX_ROUNDS; round++) {
        const orderedModels = [
          activeModel,
          ...modelCandidates.filter((m) => m !== activeModel),
        ];
        const { response, model: usedModel } = await generateWithFallback(
          ai,
          orderedModels,
          contents,
          systemInstruction
        );
        activeModel = usedModel;

        const functionCalls = response.functionCalls;
        if (!functionCalls || functionCalls.length === 0) {
          const rawText = response.text?.trim() || 'No response generated.';
          finalText = rawText.replace(/^thought\s*\r?\n/i, '').trim();
          break;
        }

        const modelContent = response.candidates?.[0]?.content;
        if (modelContent) {
          contents.push(modelContent);
        } else {
          contents.push({
            role: 'model',
            parts: functionCalls.map((fc) => ({ functionCall: fc })),
          });
        }

        const responseParts = await runToolRound(
          functionCalls,
          round,
          activeAsOfDate,
          toolLogs,
          proposedTasks
        );
        contents.push({ role: 'user', parts: responseParts });

        if (round === MAX_ROUNDS - 1) {
          finalText =
            'Reached maximum tool-execution rounds for this turn. Please ask a more specific follow-up.';
        }
      }

      return NextResponse.json({
        reply: finalText,
        model: activeModel,
        as_of_date: activeAsOfDate,
        tools_used: toolLogs,
        proposed_tasks: proposedTasks,
      });
    }

    // Hybrid SSE Streaming response: non-streaming tool rounds -> live token streaming
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        const sendEvent = (payload: Record<string, unknown>) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
        };

        let activeModel = modelCandidates[0];
        const toolLogs: ToolExecutionLog[] = [];
        const proposedTasks: ProposedTaskPayload[] = [];

        try {
          sendEvent({ type: 'status', label: `Inspecting ${activeAsOfDate} snapshot...` });

          for (let round = 0; round < MAX_ROUNDS; round++) {
            const orderedModels = [
              activeModel,
              ...modelCandidates.filter((m) => m !== activeModel),
            ];

            // Round 0 always runs non-streaming so initial tool calls never half-stream.
            // Once tools have resolved (round >= 1), stream the final response via generateContentStream.
            if (round === 0) {
              const { response, model: usedModel } = await generateWithFallback(
                ai,
                orderedModels,
                contents,
                systemInstruction
              );
              activeModel = usedModel;

              const functionCalls = response.functionCalls;
              if (!functionCalls || functionCalls.length === 0) {
                const rawText = (response.text?.trim() || 'No response generated.').replace(
                  /^thought\s*\r?\n/i,
                  ''
                );
                // Emit cleanly in small readable chunks
                const chunks = rawText.match(/[\s\S]{1,36}(?:\s+|$)/g) ?? [rawText];
                for (const c of chunks) {
                  sendEvent({ type: 'token', text: c });
                }
                break;
              }

              for (const fc of functionCalls) {
                const argDate =
                  typeof fc.args?.as_of_date === 'string' && fc.args.as_of_date.trim()
                    ? fc.args.as_of_date
                    : activeAsOfDate;
                sendEvent({
                  type: 'status',
                  label: liveStatusLabel(fc.name ?? 'tool', argDate),
                });
              }

              const modelContent = response.candidates?.[0]?.content;
              if (modelContent) {
                contents.push(modelContent);
              } else {
                contents.push({
                  role: 'model',
                  parts: functionCalls.map((fc) => ({ functionCall: fc })),
                });
              }

              const responseParts = await runToolRound(
                functionCalls,
                round,
                activeAsOfDate,
                toolLogs,
                proposedTasks
              );
              contents.push({ role: 'user', parts: responseParts });
              continue;
            }

            // Round >= 1: use generateContentStream with pre-first-chunk and mid-stream fallback
            const streamResult = await streamTurnWithFallback(
              ai,
              orderedModels,
              contents,
              systemInstruction,
              (tokenText) => sendEvent({ type: 'token', text: tokenText }),
              (fullText) => sendEvent({ type: 'replace', text: fullText })
            );
            activeModel = streamResult.model;

            if (streamResult.functionCalls.length > 0) {
              for (const fc of streamResult.functionCalls) {
                const argDate =
                  typeof fc.args?.as_of_date === 'string' && fc.args.as_of_date.trim()
                    ? fc.args.as_of_date
                    : activeAsOfDate;
                sendEvent({
                  type: 'status',
                  label: liveStatusLabel(fc.name ?? 'tool', argDate),
                });
              }

              contents.push({
                role: 'model',
                parts: streamResult.modelParts,
              });

              const responseParts = await runToolRound(
                streamResult.functionCalls,
                round,
                activeAsOfDate,
                toolLogs,
                proposedTasks
              );
              contents.push({ role: 'user', parts: responseParts });

              if (round === MAX_ROUNDS - 1) {
                sendEvent({
                  type: 'token',
                  text: 'Reached maximum tool-execution rounds for this turn. Please ask a more specific follow-up.',
                });
              }
              continue;
            }

            if (!streamResult.emittedTokens) {
              sendEvent({ type: 'token', text: 'No response generated.' });
            }
            break;
          }

          sendEvent({
            type: 'done',
            model: activeModel,
            as_of_date: activeAsOfDate,
            tools_used: toolLogs,
            proposed_tasks: proposedTasks,
          });
        } catch (streamErr) {
          const message =
            streamErr instanceof Error ? streamErr.message : 'Copilot streaming failed';
          console.error('[POST /api/copilot SSE] Error:', message);
          sendEvent({ type: 'error', error: message });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Copilot request failed';
    console.error('[POST /api/copilot] Error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
