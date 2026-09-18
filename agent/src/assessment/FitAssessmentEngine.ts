/**
 * N-Guard — Fit-to-Standard Assessment Engine (Phase 7)
 *
 * Extends the Phase 6 AgentOrchestrator to produce fully structured
 * F1–F8 fit assessments with deployment compatibility codes.
 *
 * Architecture rules:
 *  - Rule 2:  Edition is always explicit in the assessment context.
 *  - Rule 4:  Every assessment cites EvidenceReferences.
 *  - Rule 5:  Assessment is a RECOMMENDATION — never auto-approves.
 *  - Rule 7:  All LLM calls through AIProvider.
 *  - Rule 12: F8/DP-VERIFY are valid non-confident outcomes.
 *             A failed or evidence-free assessment → F8, INSUFFICIENT_EVIDENCE.
 *
 * F1–F8 schema version: '2.0' (Phase 7 introduces the fit classification fields).
 */

import { randomUUID } from 'node:crypto';
import type { AIProvider }          from '../providers/AIProvider.js';
import { KnowledgeSearchService }   from '../retrieval/KnowledgeSearchService.js';
import type { EvidenceCandidate }   from '../retrieval/KnowledgeSearchService.js';
import type { AssessmentInput, AssessmentRecommendation } from '../types/index.js';
import type { AgentContext, AgentRun, EvidenceReference, OrchestratorOptions } from '../orchestration/types.js';
import {
  type FitClassification,
  type DeploymentCompatibilityCode,
  type EvidenceConfidence,
  type FitAssessmentResult,
  ALL_FIT_CLASSIFICATIONS,
  ALL_DEPLOYMENT_CODES,
  ALL_CONFIDENCE_LEVELS,
} from './types.js';

const SCHEMA_VERSION = '2.0';

const EDITION_LABELS: Record<string, string> = {
  ON_PREMISE    : 'SAP S/4HANA On-Premise',
  CLOUD_PRIVATE : 'SAP S/4HANA Cloud, Private Edition',
  CLOUD_PUBLIC  : 'SAP S/4HANA Cloud, Public Edition',
};

const EDITION_TO_DP: Record<string, DeploymentCompatibilityCode> = {
  ON_PREMISE    : 'DP-OP',
  CLOUD_PRIVATE : 'DP-PCE',
  CLOUD_PUBLIC  : 'DP-PUB',
};

const DEFAULTS: Required<OrchestratorOptions> = {
  maxRetries        : 2,
  timeoutMs         : 30_000,
  evidenceLimit     : 6,
  evidenceThreshold : -1.0,
};

// ─── Engine ───────────────────────────────────────────────────────────────────

export class FitAssessmentEngine {
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
   * Run a full Fit-to-Standard assessment.
   * Returns both the structured FitAssessmentResult and the AgentRun audit record.
   * NEVER throws — errors produce F8/INSUFFICIENT_EVIDENCE results.
   */
  async assess(
    input  : AssessmentInput,
    context: AgentContext,
  ): Promise<{ result: FitAssessmentResult; run: AgentRun }> {
    const runId     = randomUUID();
    const startedAt = new Date().toISOString();
    const t0        = Date.now();

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

      // ── Step 3: LLM call with retries ────────────────────────────────────────
      let rawOutput   = '';
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
          break;
        } catch (err: unknown) {
          lastError = err instanceof Error ? err.message : String(err);
          if (attempt === this.options.maxRetries) {
            const isTimeout = lastError.includes('timed out');
            run.status           = isTimeout ? 'TIMEOUT' : 'FAILED';
            run.retryCount       = retryCount;
            run.error            = lastError;
            run.promptTokens     = totalUsage.promptTokens;
            run.completionTokens = totalUsage.completionTokens;
            run.latencyMs        = Date.now() - t0;
            run.completedAt      = new Date().toISOString();
            const failResult     = safeFailResult(runId, SCHEMA_VERSION, context, evidenceRefs, lastError);
            run.result           = { ...failResult, agentRunId: runId, schemaVersion: SCHEMA_VERSION, validationPassed: false, validationErrors: [lastError] } as never;
            return { result: failResult, run };
          }
        }
      }

      run.retryCount       = retryCount;
      run.promptTokens     = totalUsage.promptTokens;
      run.completionTokens = totalUsage.completionTokens;

      // ── Step 4: Parse + validate ─────────────────────────────────────────────
      const { parsed, errors } = parseAndValidate(rawOutput, context, evidenceRefs, runId);
      run.validationPassed = errors.length === 0;

      parsed.processingNotes = retryCount > 0
        ? `Succeeded on attempt ${retryCount + 1} of ${this.options.maxRetries + 1}`
        : undefined;

      run.status      = 'COMPLETED';
      run.latencyMs   = Date.now() - t0;
      run.completedAt = new Date().toISOString();

      return { result: parsed, run };

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      run.status      = 'FAILED';
      run.error       = msg;
      run.latencyMs   = Date.now() - t0;
      run.completedAt = new Date().toISOString();
      return { result: safeFailResult(runId, SCHEMA_VERSION, context, [], msg), run };
    }
  }
}

// ─── Prompt Builders ──────────────────────────────────────────────────────────

function buildSystemPrompt(ctx: AgentContext): string {
  const editionLabel = EDITION_LABELS[ctx.deploymentModel] ?? ctx.deploymentModel;
  const release      = ctx.release ? ` (Release ${ctx.release})` : '';
  const dpCode       = EDITION_TO_DP[ctx.deploymentModel] ?? 'DP-VERIFY';
  const country      = ctx.country  ? `\n- Country/Region: ${ctx.country}` : '';
  const industry     = ctx.industry ? `\n- Industry: ${ctx.industry}` : '';
  const ccPolicy     = ctx.cleanCorePolicy && ctx.cleanCorePolicy !== 'NOT_SET'
    ? `\n- Clean Core Policy: ${ctx.cleanCorePolicy}` : '';

  return `You are N-Guard, an expert SAP S/4HANA Fit-to-Standard compliance agent.

ASSESSMENT CONTEXT:
- Target Edition: ${editionLabel}${release}
- Deployment Compatibility Code: ${dpCode}${country}${industry}${ccPolicy}

CRITICAL RULES:
1. Assess SPECIFICALLY for ${editionLabel}${release}. NEVER assume capabilities from other editions.
2. Every classification must be evidence-backed from the documents provided.
3. Default stance is fit-to-standard — challenge unnecessary customization.
4. Human architects make the FINAL decision. Your role is to RECOMMEND only.
5. Never invent SAP capabilities, API names, or transaction codes.
6. When evidence is insufficient, classify as F8 with DP-VERIFY.
7. F8 and DP-VERIFY are VALID outcomes — prefer them over unsupported claims.

FIT CLASSIFICATION MODEL:
- F1: SAP standard fully covers the requirement — no modification needed.
- F2: Met via configuration alone — no code change.
- F3: Mostly standard; a small SAP-approved extension needed.
- F4: Requires Clean Core extension (key-user / BTP side-by-side).
- F5: Can be redesigned to fit standard — standardization opportunity.
- F6: Significant customization risk — architecture challenge required.
- F7: Legitimate business differentiator — customization justified.
- F8: INSUFFICIENT EVIDENCE — cannot classify without more information.

DEPLOYMENT COMPATIBILITY CODES:
- DP-OP:     On-Premise only
- DP-PCE:    Private Cloud Edition only
- DP-PUB:    Public Cloud Edition only
- DP-ALL:    All three editions (requires evidence for each)
- DP-NA:     Not applicable / not available
- DP-VERIFY: Requires edition/release verification

EVIDENCE CONFIDENCE:
- VERIFIED:              Authoritative evidence directly applicable.
- LIKELY:                Evidence strongly suggests the classification.
- NEEDS_SME_REVIEW:      Plausible but requires expert validation.
- INSUFFICIENT_EVIDENCE: Cannot classify — use F8.

RESPONSE FORMAT — EXACTLY this JSON (no markdown fences):
{
  "fitClassification": "<F1|F2|F3|F4|F5|F6|F7|F8>",
  "deploymentCompatibility": "<DP-OP|DP-PCE|DP-PUB|DP-ALL|DP-NA|DP-VERIFY>",
  "evidenceConfidence": "<VERIFIED|LIKELY|NEEDS_SME_REVIEW|INSUFFICIENT_EVIDENCE>",
  "confidence": <0.0 to 1.0>,
  "businessIntentSummary": "<max 500 chars — what the user really wants>",
  "processClassification": "<SAP process area, e.g. Order-to-Cash>",
  "targetDeploymentContext": "<one sentence describing target edition+release context>",
  "standardCapability": "<SAP standard capability if F1/F2, otherwise null>",
  "gapDescription": "<gap between requirement and standard, or null>",
  "configurationOpportunity": "<how to achieve via config, or null>",
  "customizationRiskStatement": "<risk level and consequences if F6/F7, or null>",
  "recommendedNextAction": "<specific actionable next step for the design authority>",
  "recommendations": [
    {
      "type": "<STANDARD_ALTERNATIVE|CONFIGURATION|EXTENSIBILITY|PROCESS_CHANGE>",
      "description": "<what to do>",
      "effort": "<LOW|MEDIUM|HIGH>",
      "priority": "<CRITICAL|HIGH|MEDIUM|LOW>",
      "rationale": "<why>"
    }
  ],
  "assumptions": ["<assumption 1>", "<assumption 2>"],
  "unknowns": ["<unknown 1>"],
  "humanReviewRequired": <true|false>
}`;
}

function buildUserPrompt(input: AssessmentInput, candidates: EvidenceCandidate[]): string {
  const context = candidates.length > 0
    ? `\n\nRELEVANT KNOWLEDGE BASE DOCUMENTS:\n${
        candidates.map((c, i) =>
          `[${i + 1}] ${c.title} (score: ${c.score.toFixed(2)}${c.authorityLevel ? ', auth: ' + c.authorityLevel : ''})\n${c.text.slice(0, 400)}`
        ).join('\n\n')
      }`
    : '\n\n(No knowledge documents found. Classify as F8 with INSUFFICIENT_EVIDENCE unless the requirement is self-evidently trivial.)';

  return `FIT-TO-STANDARD ASSESSMENT REQUEST

Title: ${input.title}
Business Process: ${input.businessProcess ?? 'Not specified'}
SAP Module: ${input.module ?? 'Not specified'}
Edition: ${input.edition}${input.release ? ' / Release ' + input.release : ''}

Description:
${input.description}
${context}

Return the complete JSON assessment as specified. Classify as F8 / INSUFFICIENT_EVIDENCE if evidence does not support a confident classification.`;
}

// ─── Parse + Validate ─────────────────────────────────────────────────────────

function parseAndValidate(
  content      : string,
  context      : AgentContext,
  evidenceRefs : EvidenceReference[],
  runId        : string,
): { parsed: FitAssessmentResult; errors: string[] } {
  const errors: string[] = [];

  const cleaned = content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(cleaned) as Record<string, unknown>;
  } catch (e) {
    errors.push(`Response is not valid JSON: ${String(e).slice(0, 200)}`);
    return { parsed: safeFailResult(runId, SCHEMA_VERSION, context, evidenceRefs, 'Invalid JSON'), errors };
  }

  // Validate fitClassification
  const fc = raw['fitClassification'] as string | undefined;
  if (!fc || !ALL_FIT_CLASSIFICATIONS.includes(fc as FitClassification)) {
    errors.push(`Invalid fitClassification "${fc}". Must be F1–F8.`);
  }

  // Validate deploymentCompatibility
  const dc = raw['deploymentCompatibility'] as string | undefined;
  if (!dc || !ALL_DEPLOYMENT_CODES.includes(dc as DeploymentCompatibilityCode)) {
    errors.push(`Invalid deploymentCompatibility "${dc}". Must be DP-OP/DP-PCE/DP-PUB/DP-ALL/DP-NA/DP-VERIFY.`);
  }

  // Validate evidenceConfidence
  const ec = raw['evidenceConfidence'] as string | undefined;
  if (!ec || !ALL_CONFIDENCE_LEVELS.includes(ec as EvidenceConfidence)) {
    errors.push(`Invalid evidenceConfidence "${ec}".`);
  }

  // Validate confidence number
  const conf = raw['confidence'];
  if (typeof conf !== 'number' || conf < 0 || conf > 1) {
    errors.push(`Invalid confidence "${conf}". Must be 0.0–1.0.`);
  }

  // Validate required string fields
  const requiredStrings: Array<keyof FitAssessmentResult> = [
    'businessIntentSummary', 'processClassification', 'targetDeploymentContext', 'recommendedNextAction',
  ];
  for (const field of requiredStrings) {
    if (typeof raw[field] !== 'string' || (raw[field] as string).trim().length === 0) {
      errors.push(`Missing or empty field: ${field}.`);
    }
  }

  // If validation failed, return F8 safe result
  if (errors.length > 0) {
    const safe = safeFailResult(runId, SCHEMA_VERSION, context, evidenceRefs, errors.join('; '));
    return { parsed: { ...safe, validationErrors: errors, validationPassed: false }, errors };
  }

  const result: FitAssessmentResult = {
    agentRunId               : runId,
    schemaVersion            : SCHEMA_VERSION,
    fitClassification        : fc as FitClassification,
    deploymentCompatibility  : dc as DeploymentCompatibilityCode,
    evidenceConfidence       : ec as EvidenceConfidence,
    confidence               : Math.min(Math.max(conf as number, 0), 1),
    businessIntentSummary    : String(raw['businessIntentSummary']),
    processClassification    : String(raw['processClassification']),
    targetDeploymentContext  : String(raw['targetDeploymentContext']),
    standardCapability       : raw['standardCapability'] ? String(raw['standardCapability']) : undefined,
    gapDescription           : raw['gapDescription'] ? String(raw['gapDescription']) : undefined,
    configurationOpportunity : raw['configurationOpportunity'] ? String(raw['configurationOpportunity']) : undefined,
    customizationRiskStatement: raw['customizationRiskStatement'] ? String(raw['customizationRiskStatement']) : undefined,
    recommendedNextAction    : String(raw['recommendedNextAction']),
    recommendations          : Array.isArray(raw['recommendations']) ? raw['recommendations'] as AssessmentRecommendation[] : [],
    evidenceReferences       : evidenceRefs,
    assumptions              : Array.isArray(raw['assumptions']) ? (raw['assumptions'] as unknown[]).map(String) : [],
    unknowns                 : Array.isArray(raw['unknowns']) ? (raw['unknowns'] as unknown[]).map(String) : [],
    humanReviewRequired      : raw['humanReviewRequired'] === true || fc === 'F6' || fc === 'F7' || fc === 'F8',
    validationPassed         : true,
    validationErrors         : [],
  };

  return { parsed: result, errors };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function safeFailResult(
  runId        : string,
  schemaVersion: string,
  context      : AgentContext,
  evidenceRefs : EvidenceReference[],
  reason       : string,
): FitAssessmentResult {
  const dpCode = EDITION_TO_DP[context.deploymentModel] ?? 'DP-VERIFY';
  return {
    agentRunId                : runId,
    schemaVersion,
    fitClassification         : 'F8',
    deploymentCompatibility   : dpCode,
    evidenceConfidence        : 'INSUFFICIENT_EVIDENCE',
    confidence                : 0.0,
    businessIntentSummary     : 'Assessment could not be completed.',
    processClassification     : 'Unknown',
    targetDeploymentContext   : `${EDITION_LABELS[context.deploymentModel] ?? context.deploymentModel}${context.release ? ' Release ' + context.release : ''}`,
    standardCapability        : undefined,
    gapDescription            : undefined,
    configurationOpportunity  : undefined,
    customizationRiskStatement: undefined,
    recommendedNextAction     : 'Manual review required. The AI assessment did not complete successfully.',
    recommendations           : [],
    evidenceReferences        : evidenceRefs,
    assumptions               : [],
    unknowns                  : [reason.slice(0, 500)],
    humanReviewRequired       : true,
    validationPassed          : false,
    validationErrors          : [reason],
  };
}

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

function withTimeout<T>(promise: Promise<T>, ms: number, msg: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(msg)), ms);
    promise.then(v => { clearTimeout(t); resolve(v); }, e => { clearTimeout(t); reject(e as Error); });
  });
}
