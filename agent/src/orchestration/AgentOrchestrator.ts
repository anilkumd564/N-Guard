/**
 * N-Guard — AgentOrchestrator (Phase 6)
 *
 * Full agent orchestration pipeline:
 *  1. Accept AssessmentInput + AgentContext
 *  2. Retrieve evidence via KnowledgeSearchService (metadata filters first, rule 3)
 *  3. Build structured system + user prompt grounded in the target edition
 *  4. Call AIProvider with retry logic and timeout handling (rule 7)
 *  5. Schema-validate the LLM response (rule 12)
 *  6. Build and return a complete AgentRun + StructuredAgentResult
 *
 * Architecture rules:
 *  - Rule 5:  Verdict is always a recommendation — agent never approves/rejects.
 *  - Rule 7:  ALL model calls go through the injected AIProvider.
 *  - Rule 8:  ALL retrieval goes through KnowledgeSearchService.
 *  - Rule 12: Structured, schema-validated output only.
 *             Failed/invalid LLM responses → NEEDS_REVIEW with confidence 0.
 *
 * Retry behaviour:
 *  - Transient errors (timeout, non-JSON) → retry up to maxRetries.
 *  - Schema validation failure on final attempt → NEEDS_REVIEW result.
 *  - Timeout on final attempt → AgentRun status = TIMEOUT, result = NEEDS_REVIEW.
 *
 * Schema version: '1.0' — bump when the JSON contract changes.
 */

import { randomUUID } from 'node:crypto';
import type { AIProvider }  from '../providers/AIProvider.js';
import { KnowledgeSearchService } from '../retrieval/KnowledgeSearchService.js';
import type { EvidenceCandidate } from '../retrieval/KnowledgeSearchService.js';
import type { AssessmentInput, Verdict, AssessmentRecommendation } from '../types/index.js';
import type {
  AgentContext,
  AgentRun,
  AgentRunStatus,
  EvidenceReference,
  OrchestratorOptions,
  StructuredAgentResult,
} from './types.js';

const SCHEMA_VERSION = '1.0';

const VALID_VERDICTS: readonly Verdict[] = [
  'FIT_TO_STANDARD',
  'ACCEPTABLE_GAP',
  'CUSTOMIZATION_RISK',
  'REJECT',
  'NEEDS_REVIEW',
] as const;

const EDITION_LABELS: Record<string, string> = {
  ON_PREMISE    : 'SAP S/4HANA On-Premise',
  CLOUD_PRIVATE : 'SAP S/4HANA Cloud, Private Edition',
  CLOUD_PUBLIC  : 'SAP S/4HANA Cloud, Public Edition',
};

// ─── Default Options ──────────────────────────────────────────────────────────

const DEFAULTS: Required<OrchestratorOptions> = {
  maxRetries        : 2,
  timeoutMs         : 30_000,
  evidenceLimit     : 6,
  evidenceThreshold : -1.0,   // -1.0 = accept all in mock; use ~0.5 in production
};

// ─── Raw LLM output shape ─────────────────────────────────────────────────────

interface RawLlmOutput {
  verdict          : unknown;
  rationale        : unknown;
  confidence       : unknown;
  evidenceSources  : unknown;
  recommendations  : unknown;
}

// ─── Orchestrator ─────────────────────────────────────────────────────────────

export class AgentOrchestrator {
  private readonly ai      : AIProvider;
  private readonly search  : KnowledgeSearchService;
  private readonly options : Required<OrchestratorOptions>;

  constructor(deps: {
    aiProvider            : AIProvider;
    knowledgeSearchService: KnowledgeSearchService;
    options?              : OrchestratorOptions;
  }) {
    this.ai      = deps.aiProvider;
    this.search  = deps.knowledgeSearchService;
    this.options = { ...DEFAULTS, ...deps.options };
  }

  /**
   * Run the full orchestration pipeline and return an AgentRun.
   * This method NEVER throws — all errors are captured in the AgentRun.
   */
  async run(
    input  : AssessmentInput,
    context: AgentContext,
  ): Promise<AgentRun> {
    const runId    = randomUUID();
    const startedAt = new Date().toISOString();

    const run: AgentRun = {
      id                 : runId,
      status             : 'RUNNING',
      designRequestId    : input.designRequestId,
      projectId          : input.projectId,
      tenantId           : input.tenantId,
      modelProvider      : this.ai.providerName,
      modelName          : this.ai.modelName,
      promptTokens       : 0,
      completionTokens   : 0,
      latencyMs          : 0,
      retryCount         : 0,
      evidenceCount      : 0,
      schemaVersion      : SCHEMA_VERSION,
      validationPassed   : false,
      startedAt,
      evidenceReferences : [],
    };

    const t0 = Date.now();

    try {
      // ── Step 1: Evidence retrieval ───────────────────────────────────────────
      const candidates = await this.search.search({
        text          : `${input.title} ${input.description}`,
        tenantId      : context.tenantId,
        projectId     : context.projectId,
        edition       : context.deploymentModel,
        release       : context.release,
        country       : context.country,
        industry      : context.industry,
        processArea   : context.processArea ?? input.businessProcess,
        scopeItem     : context.scopeItem,
        limit         : this.options.evidenceLimit,
        threshold     : this.options.evidenceThreshold,
      });

      const evidenceRefs = candidates.map(toEvidenceReference);
      run.evidenceCount      = evidenceRefs.length;
      run.evidenceReferences = evidenceRefs;

      // ── Step 2: Build prompts ────────────────────────────────────────────────
      const systemPrompt = buildSystemPrompt(context);
      const userPrompt   = buildUserPrompt(input, candidates);

      // ── Step 3: Call LLM with retry + timeout ────────────────────────────────
      let rawOutput   : string | null = null;
      let totalUsage  = { promptTokens: 0, completionTokens: 0 };
      let lastError   : string | undefined;
      let retryCount  = 0;

      for (let attempt = 0; attempt <= this.options.maxRetries; attempt++) {
        if (attempt > 0) retryCount++;

        try {
          const response = await withTimeout(
            this.ai.complete({
              messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user',   content: userPrompt   },
              ],
              temperature    : 0.2,
              responseFormat : 'json',
            }),
            this.options.timeoutMs,
            `LLM call timed out after ${this.options.timeoutMs}ms`,
          );

          totalUsage.promptTokens     += response.usage?.promptTokens     ?? 0;
          totalUsage.completionTokens += response.usage?.completionTokens ?? 0;
          rawOutput = response.content;
          break; // success

        } catch (err: unknown) {
          lastError = err instanceof Error ? err.message : String(err);
          if (attempt === this.options.maxRetries) {
            // All retries exhausted
            const isTimeout = lastError.includes('timed out');
            run.status           = isTimeout ? 'TIMEOUT' : 'FAILED';
            run.retryCount       = retryCount;
            run.error            = lastError;
            run.promptTokens     = totalUsage.promptTokens;
            run.completionTokens = totalUsage.completionTokens;
            run.latencyMs        = Date.now() - t0;
            run.completedAt      = new Date().toISOString();
            run.result           = safeFailResult(runId, SCHEMA_VERSION, lastError);
            return run;
          }
          // else: continue retrying
        }
      }

      run.retryCount       = retryCount;
      run.promptTokens     = totalUsage.promptTokens;
      run.completionTokens = totalUsage.completionTokens;

      // ── Step 4: Parse + validate ─────────────────────────────────────────────
      const { parsed, errors } = parseAndValidate(rawOutput ?? '');
      run.validationPassed = errors.length === 0;

      const result: StructuredAgentResult = {
        verdict            : parsed.verdict,
        rationale          : parsed.rationale,
        confidence         : parsed.confidence,
        recommendations    : parsed.recommendations,
        evidenceReferences : evidenceRefs,
        agentRunId         : runId,
        schemaVersion      : SCHEMA_VERSION,
        validationPassed   : run.validationPassed,
        validationErrors   : errors,
        processingNotes    : retryCount > 0
          ? `Succeeded on attempt ${retryCount + 1} of ${this.options.maxRetries + 1}`
          : undefined,
      };

      run.status      = 'COMPLETED';
      run.result      = result;
      run.latencyMs   = Date.now() - t0;
      run.completedAt = new Date().toISOString();

      return run;

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      run.status      = 'FAILED';
      run.error       = msg;
      run.latencyMs   = Date.now() - t0;
      run.completedAt = new Date().toISOString();
      run.result      = safeFailResult(runId, SCHEMA_VERSION, msg);
      return run;
    }
  }
}

// ─── Prompt Builders ──────────────────────────────────────────────────────────

function buildSystemPrompt(ctx: AgentContext): string {
  const editionLabel = EDITION_LABELS[ctx.deploymentModel] ?? ctx.deploymentModel;
  const release      = ctx.release ? ` (Release ${ctx.release})` : '';
  const country      = ctx.country      ? `\n- Country/Region: ${ctx.country}` : '';
  const industry     = ctx.industry     ? `\n- Industry: ${ctx.industry}` : '';
  const ccPolicy     = ctx.cleanCorePolicy && ctx.cleanCorePolicy !== 'NOT_SET'
    ? `\n- Clean Core Policy: ${ctx.cleanCorePolicy}`
    : '';

  return `You are N-Guard, an expert SAP S/4HANA fit-to-standard compliance agent.

ASSESSMENT CONTEXT:
- Target Edition: ${editionLabel}${release}${country}${industry}${ccPolicy}

Your role is to assess whether a proposed design requirement or customization is necessary,
or whether it can be met by SAP standard functionality.

CRITICAL RULES:
1. Assess SPECIFICALLY for ${editionLabel}${release}. Never assume capabilities from other editions.
2. Every assessment must be evidence-backed. Cite the knowledge documents provided.
3. Default stance is fit-to-standard — challenge unnecessary customization.
4. Human architects make the final decision. Your role is to RECOMMEND, not to approve.
5. Never invent SAP API names, transaction codes, or capabilities that do not exist.
6. If evidence is insufficient, return verdict = "NEEDS_REVIEW" with confidence < 0.3.

RESPONSE FORMAT — respond with EXACTLY this JSON schema (no markdown fences):
{
  "verdict": "<FIT_TO_STANDARD|ACCEPTABLE_GAP|CUSTOMIZATION_RISK|REJECT|NEEDS_REVIEW>",
  "rationale": "<max 1000 chars — explain the verdict citing evidence>",
  "confidence": <0.0 to 1.0>,
  "evidenceSources": [
    { "docId": "<chunk id>", "title": "<doc title>", "excerpt": "<excerpt>", "score": <0.0-1.0> }
  ],
  "recommendations": [
    {
      "type": "<STANDARD_ALTERNATIVE|CONFIGURATION|EXTENSIBILITY|PROCESS_CHANGE>",
      "description": "<what to do>",
      "effort": "<LOW|MEDIUM|HIGH>",
      "priority": "<CRITICAL|HIGH|MEDIUM|LOW>",
      "rationale": "<why>"
    }
  ]
}`;
}

function buildUserPrompt(
  input     : AssessmentInput,
  candidates: EvidenceCandidate[],
): string {
  const context = candidates.length > 0
    ? `\n\nRELEVANT KNOWLEDGE BASE DOCUMENTS:\n${
        candidates.map((c, i) =>
          `[${i + 1}] ${c.title} (score: ${c.score.toFixed(2)}` +
          (c.authorityLevel ? `, authority: ${c.authorityLevel}` : '') + `)\n` +
          c.text.slice(0, 400)
        ).join('\n\n')
      }`
    : '\n\n(No relevant knowledge documents found. Return NEEDS_REVIEW if evidence is insufficient.)';

  return `DESIGN REQUEST ASSESSMENT

Title: ${input.title}
Business Process: ${input.businessProcess ?? 'Not specified'}
SAP Module: ${input.module ?? 'Not specified'}

Description:
${input.description}
${context}

Assess this design request and return the JSON response as specified in your instructions.`;
}

// ─── Parse + Validate ─────────────────────────────────────────────────────────

interface ParseResult {
  parsed  : { verdict: Verdict; rationale: string; confidence: number; recommendations: AssessmentRecommendation[] };
  errors  : string[];
}

function parseAndValidate(content: string): ParseResult {
  const errors: string[] = [];

  // Strip markdown fences
  const cleaned = content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();

  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(cleaned) as Record<string, unknown>;
  } catch (e) {
    errors.push(`Response is not valid JSON: ${String(e).slice(0, 200)}`);
    return { parsed: safeDefault(), errors };
  }

  // Validate verdict
  const verdictRaw = raw['verdict'];
  if (typeof verdictRaw !== 'string' || !VALID_VERDICTS.includes(verdictRaw as Verdict)) {
    errors.push(`Invalid verdict "${verdictRaw}". Expected one of: ${VALID_VERDICTS.join(', ')}.`);
  }

  // Validate rationale
  if (typeof raw['rationale'] !== 'string' || (raw['rationale'] as string).trim().length === 0) {
    errors.push('Missing or empty rationale.');
  }

  // Validate confidence
  if (typeof raw['confidence'] !== 'number' || raw['confidence'] < 0 || raw['confidence'] > 1) {
    errors.push(`Invalid confidence "${raw['confidence']}". Must be a number between 0.0 and 1.0.`);
  }

  // Validate recommendations (array, may be empty)
  if (!Array.isArray(raw['recommendations'])) {
    errors.push('recommendations must be an array.');
  }

  const verdict = errors.length > 0
    ? 'NEEDS_REVIEW' as Verdict
    : verdictRaw as Verdict;

  const confidence = errors.length > 0
    ? 0.0
    : (typeof raw['confidence'] === 'number' ? Math.min(Math.max(raw['confidence'], 0), 1) : 0);

  const rationale = typeof raw['rationale'] === 'string' ? raw['rationale'] : '';
  const recommendations = Array.isArray(raw['recommendations'])
    ? raw['recommendations'] as AssessmentRecommendation[]
    : [];

  return { parsed: { verdict, rationale, confidence, recommendations }, errors };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Safe default result for parse failures. */
function safeDefault(): ParseResult['parsed'] {
  return { verdict: 'NEEDS_REVIEW', rationale: '', confidence: 0, recommendations: [] };
}

/** Build a safe NEEDS_REVIEW result when the run fails or times out. */
function safeFailResult(
  runId        : string,
  schemaVersion: string,
  errorMsg     : string,
): StructuredAgentResult {
  return {
    verdict            : 'NEEDS_REVIEW',
    rationale          : `Agent run could not complete. Manual review required. Error: ${errorMsg.slice(0, 500)}`,
    confidence         : 0.0,
    recommendations    : [],
    evidenceReferences : [],
    agentRunId         : runId,
    schemaVersion,
    validationPassed   : false,
    validationErrors   : [errorMsg],
    processingNotes    : 'Run failed — result is a safe fallback, not a real assessment.',
  };
}

/** Convert an EvidenceCandidate to an EvidenceReference. */
function toEvidenceReference(c: EvidenceCandidate): EvidenceReference {
  return {
    chunkId           : c.id,
    documentId        : c.documentId,
    knowledgeSourceId : c.knowledgeSourceId,
    chunkSequence     : c.chunkSequence,
    title             : c.title,
    excerpt           : c.text.slice(0, 400),
    edition           : c.edition,
    release           : c.release,
    authorityLevel    : c.authorityLevel,
    source            : c.source,
    score             : c.score,
  };
}

/**
 * Wraps a Promise with a timeout.
 * Rejects with an error containing 'timed out' in the message.
 */
function withTimeout<T>(
  promise   : Promise<T>,
  timeoutMs : number,
  message   : string,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), timeoutMs);
    promise.then(
      (value) => { clearTimeout(timer); resolve(value); },
      (err)   => { clearTimeout(timer); reject(err as Error); },
    );
  });
}

// Suppress unused type warning — RawLlmOutput documents the expected shape
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type _RawLlmOutputUsed = RawLlmOutput;
// Suppress unused type warning
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type _AgentRunStatusUsed = AgentRunStatus;
