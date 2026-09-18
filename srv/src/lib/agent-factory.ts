/**
 * N-Guard — Agent Engine Factory
 *
 * Provides a singleton AgentEngine instance to CAP service handlers.
 *
 * Architecture rules:
 *  - Rule 6:  This factory is the ONLY coupling point between the CAP layer
 *             and the Agent Engine.  Handlers never import engine internals.
 *  - Rule 7:  AIProvider is resolved and injected here.
 *  - Rule 8:  VectorStore is resolved and injected here.
 *  - Rule 11: Configuration comes from environment variables; no hard-coded creds.
 *
 * The factory uses local port interfaces (srv/src/types/agent.ts) so that
 * the srv package has ZERO compile-time dependency on agent package internals.
 * The agent implementations are loaded at runtime via require().
 */

import type { AgentEngine } from '../types/agent.js';

let _engine: AgentEngine | null = null;

// ─── Orchestrator factory ─────────────────────────────────────────────────────

/**
 * Lazily build the AgentOrchestrator for Phase 6 assessment pipeline.
 * Returns the orchestrator object from the agent package at runtime.
 */
export function getAgentOrchestrator() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { AgentOrchestrator, KnowledgeSearchService } = require('@n-guard/agent') as {
    AgentOrchestrator    : new (deps: {
      aiProvider            : unknown;
      knowledgeSearchService: unknown;
      options?              : Record<string, unknown>;
    }) => { run(input: unknown, context: unknown): Promise<unknown> };
    KnowledgeSearchService: new (deps: { store: unknown; aiProvider: unknown }) => unknown;
  };

  const aiProvider = resolveAIProvider();
  const store      = resolveVectorStore();
  const search     = new KnowledgeSearchService({ store, aiProvider });

  return new AgentOrchestrator({ aiProvider, knowledgeSearchService: search });
}

/**
 * Returns the singleton AgentEngine.
 * Lazily initialised on first call with providers resolved from env vars.
 */
export function getAgentEngine(): AgentEngine {
  if (_engine) return _engine;
  _engine = buildEngine();
  return _engine;
}

/** Reset the singleton — used in tests to inject a mock engine. */
export function resetAgentEngine(engine?: AgentEngine): void {
  _engine = engine ?? null;
}

// ─── Private ──────────────────────────────────────────────────────────────────

function buildEngine(): AgentEngine {
  const aiProvider  = resolveAIProvider();
  const vectorStore = resolveVectorStore();

  // Runtime require keeps srv compilable before agent is built.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const engineModule = require('@n-guard/agent') as {
    NGuardAgentEngine: new (deps: {
      aiProvider: unknown;
      vectorStore: unknown;
    }) => AgentEngine;
  };

  return new engineModule.NGuardAgentEngine({ aiProvider, vectorStore });
}

function resolveAIProvider(): unknown {
  const providerName = process.env.AI_PROVIDER ?? 'mock';

  if (providerName === 'mock') {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { MockAIProvider } = require('@n-guard/agent') as {
      MockAIProvider: new () => unknown;
    };
    return new MockAIProvider();
  }

  // Future: 'aicore' → AICoreAIProvider
  throw new Error(
    `Unknown AI_PROVIDER="${providerName}". Supported: mock | aicore`,
  );
}

function resolveVectorStore(): unknown {
  const storeName = process.env.VECTOR_STORE ?? 'mock';

  if (storeName === 'mock') {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { MockVectorStore } = require('@n-guard/agent') as {
      MockVectorStore: new () => unknown;
    };
    return new MockVectorStore();
  }

  // Future: 'hana' → HanaVectorStore
  throw new Error(
    `Unknown VECTOR_STORE="${storeName}". Supported: mock | hana`,
  );
}
