// ─────────────────────────────────────────────────────────────────────────────
// agentStore.ts — Typed event bus for the agent run lifecycle
// ─────────────────────────────────────────────────────────────────────────────

export type AgentPhase =
  | 'idle'
  | 'listening'
  | 'transcribing'
  | 'thinking'
  | 'acting'
  | 'speaking'
  | 'error';

export interface PlanStep {
  title: string;
  status: 'pending' | 'active' | 'done' | 'failed';
}

export interface ToolEventItem {
  id: string;
  name: string;
  label: string;
  startedAt: number;
  status: 'running' | 'ok' | 'error' | 'needs_confirmation';
  durationMs?: number;
  summary?: string;
}

// ── Typed event union ────────────────────────────────────────────────────────

export type AgentEvent =
  | { type: 'phase_changed'; phase: AgentPhase }
  | { type: 'run_started'; id: string; userText: string }
  | { type: 'step_started'; index: number; kind: 'llm' | 'tools' }
  | { type: 'tool_started'; id: string; name: string; label: string; startedAt: number }
  | { type: 'tool_finished'; id: string; status: 'ok' | 'error' | 'needs_confirmation'; durationMs: number; summary: string }
  | { type: 'plan_updated'; steps: PlanStep[] }
  | { type: 'llm_partial'; text: string }
  | { type: 'llm_intent'; text: string }   // one-sentence intent — shown, not spoken
  | { type: 'run_finished'; summary: string; totalMs: number; toolCount: number; failedCount: number }
  | { type: 'run_cancelled'; doneWork: string[] };

// ── Lightweight event bus ────────────────────────────────────────────────────

type Listener = (event: AgentEvent) => void;

export class AgentEventBus {
  private listeners: Listener[] = [];

  subscribe(cb: Listener): () => void {
    this.listeners.push(cb);
    return () => {
      this.listeners = this.listeners.filter(l => l !== cb);
    };
  }

  emit(event: AgentEvent): void {
    for (const l of this.listeners) {
      try { l(event); } catch { /* ignore individual listener errors */ }
    }
  }
}

// ── Singleton bus shared across the whole app ────────────────────────────────
export const globalBus = new AgentEventBus();

// ── Derived state for React components ──────────────────────────────────────

export interface AgentRunState {
  phase: AgentPhase;
  runId: string | null;
  userText: string | null;
  intentText: string | null;       // LLM intent sentence (shown not spoken)
  partialText: string | null;      // typewriter accumulator
  planSteps: PlanStep[];
  toolItems: ToolEventItem[];
  summary: string | null;
  cancelledWork: string[];
  runStartedAt: number | null;
}

export const INITIAL_RUN_STATE: AgentRunState = {
  phase: 'idle',
  runId: null,
  userText: null,
  intentText: null,
  partialText: null,
  planSteps: [],
  toolItems: [],
  summary: null,
  cancelledWork: [],
  runStartedAt: null,
};

/** Pure reducer — no side effects */
export function agentRunReducer(state: AgentRunState, event: AgentEvent): AgentRunState {
  switch (event.type) {
    case 'phase_changed':
      return { ...state, phase: event.phase };

    case 'run_started':
      return {
        ...INITIAL_RUN_STATE,
        phase: 'thinking',
        runId: event.id,
        userText: event.userText,
        runStartedAt: Date.now(),
      };

    case 'step_started':
      return {
        ...state,
        phase: event.kind === 'llm' ? 'thinking' : 'acting',
        intentText: event.kind === 'llm' ? null : state.intentText, // reset per step
      };

    case 'llm_intent':
      return { ...state, intentText: event.text };

    case 'llm_partial':
      return { ...state, partialText: event.text };

    case 'tool_started': {
      const item: ToolEventItem = {
        id: event.id,
        name: event.name,
        label: event.label,
        startedAt: event.startedAt,
        status: 'running',
      };
      return { ...state, toolItems: [...state.toolItems, item] };
    }

    case 'tool_finished': {
      const updated = state.toolItems.map(t =>
        t.id === event.id
          ? { ...t, status: event.status, durationMs: event.durationMs, summary: event.summary }
          : t
      );
      return { ...state, toolItems: updated };
    }

    case 'plan_updated':
      return { ...state, planSteps: event.steps };

    case 'run_finished':
      return { ...state, phase: 'idle', summary: event.summary, partialText: null };

    case 'run_cancelled':
      return { ...state, phase: 'idle', cancelledWork: event.doneWork, partialText: null };

    default:
      return state;
  }
}
