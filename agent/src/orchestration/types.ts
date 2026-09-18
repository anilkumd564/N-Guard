/**
 * N-Guard — Agent Orchestration Types (Phase 6)
 *
 * Typed contracts for the agent orchestration pipeline:
 *  - AgentContext: full context for a single orchestration run
 *  - AgentTool: interface for tool/function calls
 *  - AgentRun: in-memory record of a run with timing and metadata
 *  - StructuredAgentResult: validated assessment result with schema metadata
 *  - EvidenceReference: traceable evidence with full source metadata
 *
 * Architecture rules:
 *  - Rule 2:  Edition is always explicit in AgentContext.
 *  - Rule 4:  Every result cites EvidenceReferences.
 *  - Rule 5:  Agent never auto-approves; verdict is always a recommendation.
 *  - Rule 7:  All model calls go through AIProvider (enforced in AgentOrchestrator).
 *  - Rule 12: AI output is schema-validated before returning (StructuredAgentResult).
 */

import type { S4Edition, Verdict, AssessmentRecommendation } from '../types/index.js';

// ─── Agent Context ────────────────────────────────────────────────────────────

/**
 * Full context for an agent orchestration run.
 * Populated from the project and deployment profile before calling the LLM.
 */
export interface AgentContext {
  /** Tenant scope. */
  tenantId            : string;
  /** Project ID. */
  projectId           : string;
  /** S/4HANA edition — required (rule 2). */
  deploymentModel     : S4Edition;
  /** Optional release. */
  release?            : string;
  /** Country/localization context. */
  country?            : string;
  /** Industry vertical. */
  industry?           : string;
  /** Transformation type (Greenfield/Brownfield/Selective). */
  transformationType? : string;
  /** Project-level Clean Core policy. */
  cleanCorePolicy?    : string;
  /** Optional SAP process area for scoped retrieval. */
  processArea?        : string;
  /** Optional SAP Scope Item for scoped retrieval. */
  scopeItem?          : string;
}

// ─── Agent Tool ───────────────────────────────────────────────────────────────

/**
 * Interface for tools/functions the agent can call.
 * Phase 6 defines the interface; Phase 7+ adds concrete tools.
 */
export interface AgentTool {
  /** Unique tool name. */
  name        : string;
  /** Human-readable description of what the tool does. */
  description : string;
  /** JSON Schema for the tool's input parameters. */
  inputSchema : Record<string, unknown>;
  /** Execute the tool with given arguments. */
  execute(args: Record<string, unknown>): Promise<unknown>;
}

// ─── Agent Run ────────────────────────────────────────────────────────────────

export type AgentRunStatus =
  | 'PENDING'
  | 'RUNNING'
  | 'COMPLETED'
  | 'FAILED'
  | 'TIMEOUT';

/**
 * Record of a single agent orchestration run.
 * Carries all metadata needed for auditing and debugging (rule 4).
 * Persisted in DB via the CAP handler after completion.
 */
export interface AgentRun {
  /** Unique run identifier. */
  id                 : string;
  /** Run lifecycle status. */
  status             : AgentRunStatus;
  /** Associated design request. */
  designRequestId    : string;
  /** Project scope. */
  projectId          : string;
  /** Tenant scope. */
  tenantId           : string;
  /** AI provider name (e.g. 'mock', 'aicore'). */
  modelProvider      : string;
  /** Model identifier (e.g. 'mock-gpt-4o', 'gpt-4o'). */
  modelName          : string;
  /** Prompt token usage. */
  promptTokens       : number;
  /** Completion token usage. */
  completionTokens   : number;
  /** Total end-to-end latency in milliseconds. */
  latencyMs          : number;
  /** Number of retries attempted. */
  retryCount         : number;
  /** Error message if status = FAILED or TIMEOUT. */
  error?             : string;
  /** Number of evidence candidates used. */
  evidenceCount      : number;
  /** Schema version of the prompt/response contract. */
  schemaVersion      : string;
  /** Whether the model response passed schema validation. */
  validationPassed   : boolean;
  /** ISO 8601 run start timestamp. */
  startedAt          : string;
  /** ISO 8601 run completion timestamp. */
  completedAt?       : string;
  /** Evidence references used in this run. */
  evidenceReferences : EvidenceReference[];
  /** The structured result (undefined if FAILED or TIMEOUT). */
  result?            : StructuredAgentResult;
}

// ─── Evidence Reference ───────────────────────────────────────────────────────

/**
 * A traceable reference to a piece of evidence used in an agent run.
 * Carries full metadata from KnowledgeSearchService (rule 4).
 */
export interface EvidenceReference {
  /** Chunk ID in the vector store. */
  chunkId            : string;
  /** Parent KnowledgeDocument ID. */
  documentId?        : string;
  /** Parent KnowledgeSource ID. */
  knowledgeSourceId? : string;
  /** 1-based chunk position in the document. */
  chunkSequence?     : number;
  /** Document title. */
  title              : string;
  /** Text excerpt used as evidence. */
  excerpt            : string;
  /** Applicable edition (null = global). */
  edition?           : string;
  /** Applicable release (null = global). */
  release?           : string;
  /** Authority level. */
  authorityLevel?    : string;
  /** Document source URL or citation. */
  source?            : string;
  /** Similarity score 0.0 – 1.0. */
  score              : number;
}

// ─── Structured Agent Result ──────────────────────────────────────────────────

/**
 * The fully-validated result of an agent orchestration run.
 * Extends the base AssessmentResult with orchestration metadata.
 *
 * Rule 5: This result is a RECOMMENDATION only — human architects decide.
 * Rule 12: Schema validation metadata is preserved in the result.
 */
export interface StructuredAgentResult {
  /** Assessment verdict. */
  verdict              : Verdict;
  /** Detailed rationale for the verdict. */
  rationale            : string;
  /** Confidence score 0.0 – 1.0. */
  confidence           : number;
  /** Actionable recommendations. */
  recommendations      : AssessmentRecommendation[];
  /** Evidence references used in this run. */
  evidenceReferences   : EvidenceReference[];
  /** Agent run ID for audit linkage. */
  agentRunId           : string;
  /** Schema version of the response contract. */
  schemaVersion        : string;
  /** Whether the LLM response passed schema validation. */
  validationPassed     : boolean;
  /** Validation error messages (empty if validation passed). */
  validationErrors     : string[];
  /** Optional processing notes (e.g. 'retry 1 of 2 succeeded'). */
  processingNotes?     : string;
}

// ─── Orchestrator Options ─────────────────────────────────────────────────────

/**
 * Configuration for the AgentOrchestrator.
 * All values have defaults; override for testing or production tuning.
 */
export interface OrchestratorOptions {
  /**
   * Maximum number of LLM call retries on transient failures.
   * Default: 2.  Set to 0 to disable retries.
   */
  maxRetries?    : number;
  /**
   * Timeout in milliseconds for each LLM call.
   * Default: 30000 (30 seconds).
   */
  timeoutMs?     : number;
  /**
   * Maximum number of evidence candidates to include in the prompt.
   * Default: 6.
   */
  evidenceLimit? : number;
  /**
   * Minimum similarity threshold for evidence retrieval.
   * Default: -1.0 (mock) — set to ~0.5 for production.
   */
  evidenceThreshold?: number;
}
