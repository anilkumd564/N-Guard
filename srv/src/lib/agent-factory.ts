/**
 * N-Guard — Agent Engine Factory
 *
 * Uses dynamic import() to bridge the CJS (srv) → ESM (@n-guard/agent) boundary.
 * Node.js 18+ supports await import() from CJS modules.
 */

import type { AgentEngine } from '../types/agent.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _mod: any = null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function mod(): Promise<any> {
  if (!_mod) {
    // Dynamic import bridges CJS srv → ESM agent package
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    _mod = await (Function('return import("@n-guard/agent")')() as Promise<any>);
  }
  return _mod;
}

// ─── Provider helpers ─────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function resolveAIProvider(): Promise<any> {
  const name = process.env.AI_PROVIDER ?? 'mock';
  if (name === 'mock') { const m = await mod(); return new m.MockAIProvider(); }
  throw new Error(`Unknown AI_PROVIDER="${name}". Supported: mock | aicore`);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function resolveVectorStore(): Promise<any> {
  const name = process.env.VECTOR_STORE ?? 'mock';
  if (name === 'mock') { const m = await mod(); return new m.MockVectorStore(); }
  throw new Error(`Unknown VECTOR_STORE="${name}". Supported: mock | hana`);
}

// ─── Exported factories ───────────────────────────────────────────────────────

export async function getFitAssessmentEngine() {
  const m = await mod();
  const ai = await resolveAIProvider();
  const vs = await resolveVectorStore();
  const search = new m.KnowledgeSearchService({ store: vs, aiProvider: ai });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new m.FitAssessmentEngine({ aiProvider: ai, knowledgeSearchService: search }) as any;
}

export async function getCrossEditionComparisonEngine() {
  const m = await mod();
  const ai = await resolveAIProvider();
  const vs = await resolveVectorStore();
  const search = new m.KnowledgeSearchService({ store: vs, aiProvider: ai });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new m.CrossEditionComparisonEngine({ aiProvider: ai, knowledgeSearchService: search }) as any;
}

export async function getCleanCoreAnalyzer() {
  const m = await mod();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new m.CleanCoreAnalyzer() as any;
}

export async function getAgentOrchestrator() {
  const m = await mod();
  const ai = await resolveAIProvider();
  const vs = await resolveVectorStore();
  const search = new m.KnowledgeSearchService({ store: vs, aiProvider: ai });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new m.AgentOrchestrator({ aiProvider: ai, knowledgeSearchService: search }) as any;
}

let _engine: AgentEngine | null = null;

export async function getAgentEngine(): Promise<AgentEngine> {
  if (_engine) return _engine;
  const m = await mod();
  const ai = await resolveAIProvider();
  const vs = await resolveVectorStore();
  _engine = new m.NGuardAgentEngine({ aiProvider: ai, vectorStore: vs }) as AgentEngine;
  return _engine;
}

export function resetAgentEngine(engine?: AgentEngine): void {
  _engine = engine ?? null;
}
