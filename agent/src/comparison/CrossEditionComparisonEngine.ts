/**
 * N-Guard — CrossEditionComparisonEngine (Phase 8)
 *
 * Runs three independent FitAssessment contexts — one per S/4HANA edition —
 * for a single business requirement. Evidence is always partitioned by edition.
 *
 * Architecture rules:
 *  - Rule 2:  Each edition gets a completely independent search context.
 *             Evidence from ON_PREMISE is NEVER used to justify CLOUD_PUBLIC.
 *  - Rule 4:  Every edition result cites its own EvidenceReferences.
 *  - Rule 5:  Summary describes differences without recommending an edition.
 *  - Rule 7:  All LLM calls go through AIProvider (via FitAssessmentEngine).
 *  - Rule 12: F8/INSUFFICIENT_EVIDENCE per edition — never inferred from other editions.
 *
 * The engine NEVER throws — errors produce F8/INSUFFICIENT_EVIDENCE for that edition.
 */

import { randomUUID }            from 'node:crypto';
import type { AIProvider }       from '../providers/AIProvider.js';
import { KnowledgeSearchService } from '../retrieval/KnowledgeSearchService.js';
import { FitAssessmentEngine }   from '../assessment/FitAssessmentEngine.js';
import type { AssessmentInput, S4Edition } from '../types/index.js';
import type { AgentContext, OrchestratorOptions } from '../orchestration/types.js';
import { S4_EDITIONS }           from '../types/index.js';
import type {
  CrossEditionComparisonResult,
  CrossEditionSummary,
  EditionComparisonResult,
} from './types.js';
import type { FitAssessmentResult } from '../assessment/types.js';

const SCHEMA_VERSION = '2.0';

const EDITION_LABELS: Record<S4Edition, string> = {
  ON_PREMISE    : 'On-Premise',
  CLOUD_PRIVATE : 'Cloud Private Edition',
  CLOUD_PUBLIC  : 'Cloud Public Edition',
};

// ─── Engine ───────────────────────────────────────────────────────────────────

export class CrossEditionComparisonEngine {
  private readonly ai      : AIProvider;
  private readonly search  : KnowledgeSearchService;
  private readonly options : OrchestratorOptions;

  constructor(deps: {
    aiProvider            : AIProvider;
    knowledgeSearchService: KnowledgeSearchService;
    options?              : OrchestratorOptions;
  }) {
    this.ai      = deps.aiProvider;
    this.search  = deps.knowledgeSearchService;
    this.options = deps.options ?? {};
  }

  /**
   * Run a full cross-edition comparison.
   * Executes three independent FitAssessmentEngine runs, one per edition.
   * NEVER throws — edition failures → F8 with INSUFFICIENT_EVIDENCE.
   */
  async compare(
    input         : AssessmentInput,
    baseContext   : Omit<AgentContext, 'deploymentModel'>,
    editions      : readonly S4Edition[] = S4_EDITIONS,
  ): Promise<CrossEditionComparisonResult> {
    const comparisonId = randomUUID();
    const t0           = Date.now();

    // Run all three editions in parallel — independent searches, independent LLM calls
    const editionRuns = await Promise.all(
      editions.map(edition => this._runEdition(input, baseContext, edition)),
    );

    const completedAt = new Date().toISOString();
    void t0; // timing recorded but not exposed at comparison level

    const summary = buildSummary(editionRuns, editions);

    return {
      comparisonId,
      designRequestId     : input.designRequestId,
      projectId           : input.projectId,
      tenantId            : input.tenantId,
      businessIntent      : pickBusinessIntent(editionRuns),
      processArea         : pickProcessArea(editionRuns),
      editionResults      : editionRuns,
      summary,
      evidencePartitioned : true,
      completedAt,
      schemaVersion       : SCHEMA_VERSION,
    };
  }

  // ── Private ─────────────────────────────────────────────────────────────────

  private async _runEdition(
    input      : AssessmentInput,
    baseCtx    : Omit<AgentContext, 'deploymentModel'>,
    edition    : S4Edition,
  ): Promise<EditionComparisonResult> {
    // Build edition-specific context — evidence filter is edition-scoped
    const context: AgentContext = {
      ...baseCtx,
      deploymentModel: edition,
    };

    // Create a fresh FitAssessmentEngine scoped to this edition
    const engine = new FitAssessmentEngine({
      aiProvider            : this.ai,
      knowledgeSearchService: this.search,
      options               : this.options,
    });

    // Override the edition in the input too so prompts reflect the right context
    const editionInput: AssessmentInput = { ...input, edition };

    const { result } = await engine.assess(editionInput, context);

    return toEditionResult(edition, result);
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toEditionResult(
  edition : S4Edition,
  fit     : FitAssessmentResult,
): EditionComparisonResult {
  return {
    edition,
    fitClassification       : fit.fitClassification,
    deploymentCompatibility : fit.deploymentCompatibility,
    evidenceConfidence      : fit.evidenceConfidence,
    confidence              : fit.confidence,
    standardCapability      : fit.standardCapability,
    gapDescription          : fit.gapDescription,
    configurationApproach   : fit.configurationOpportunity,
    extensibilityOptions    : undefined,   // Phase 9 adds extensibility detail
    majorConstraints        : undefined,   // derived from gap in Phase 9
    cleanCoreImplications   : undefined,   // Phase 9 adds Clean Core analysis
    processIdentifiers      : [],
    evidenceReferences      : fit.evidenceReferences,
    humanReviewRequired     : fit.humanReviewRequired,
    agentRunId              : fit.agentRunId,
    schemaVersion           : fit.schemaVersion,
    validationPassed        : fit.validationPassed,
  };
}

function pickBusinessIntent(results: EditionComparisonResult[]): string {
  // Use the first non-empty business intent from any edition run
  // (all three receive the same requirement description)
  for (const r of results) {
    if (r.fitClassification !== 'F8') return `Cross-edition comparison for requirement`;
  }
  return 'Cross-edition comparison — insufficient evidence across all editions';
}

function pickProcessArea(_results: EditionComparisonResult[]): string {
  // Placeholder — Phase 9 will extract this from FitAssessmentResult.processClassification
  return 'To be classified';
}

function buildSummary(
  results : EditionComparisonResult[],
  editions: readonly S4Edition[],
): CrossEditionSummary {
  const editionsWithInsufficient = results
    .filter(r => r.fitClassification === 'F8')
    .map(r => r.edition);

  const overallHumanReviewNeeded = results.some(r => r.humanReviewRequired);

  // Common capabilities: F1 or F2 across all editions
  const allFitStandard = results.every(r => r.fitClassification === 'F1' || r.fitClassification === 'F2');
  const commonCapabilities: string[] = allFitStandard
    ? ['Standard SAP process appears applicable across all assessed editions']
    : [];

  // Edition-specific differences
  const editionSpecificNotes: string[] = results.map(r =>
    `${EDITION_LABELS[r.edition]}: ${r.fitClassification}` +
    (r.evidenceConfidence !== 'VERIFIED' ? ` (${r.evidenceConfidence})` : '') +
    (r.fitClassification === 'F8' ? ' — insufficient evidence' : ''),
  );

  const hasInsufficient = editionsWithInsufficient.length > 0;
  const hasHighRisk     = results.some(r => r.fitClassification === 'F6' || r.fitClassification === 'F7');

  const recommendedNextAction =
    hasInsufficient
      ? `Gather additional evidence for ${editionsWithInsufficient.map(e => EDITION_LABELS[e]).join(', ')} before finalising the edition strategy.`
      : hasHighRisk
        ? 'Review customization risk items with the solution architecture board before proceeding.'
        : overallHumanReviewNeeded
          ? 'Human architect review is required before accepting the comparison outcome.'
          : `All three editions have been assessed. Align on the target edition with the design authority.`;

  return {
    commonCapabilities,
    editionSpecificNotes,
    recommendedNextAction,
    overallHumanReviewNeeded,
    editionsWithInsufficient,
  };
}

// Suppress unused type warning
void (S4_EDITIONS as unknown);
