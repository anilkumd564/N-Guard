/**
 * N-Guard — NGuardAgentEngine
 *
 * The core orchestration engine for compliance assessment.
 *
 * Responsibilities:
 *  1. Build a grounded system prompt that includes the target S/4HANA edition.
 *  2. Retrieve relevant knowledge documents via VectorStore (rule 3 filtering).
 *  3. Compose user prompt with design request details + retrieved context.
 *  4. Call AIProvider for a structured JSON assessment (rules 7, 12).
 *  5. Parse and validate the structured response.
 *  6. Return a typed AssessmentResult.
 *
 * Architecture rules:
 *  - Rule 6:  This engine is entirely independent of CAP / Express.
 *  - Rule 7:  All LLM access is via the injected AIProvider.
 *  - Rule 8:  All vector access is via the injected VectorStore.
 *  - Rule 12: AI output is parsed into a typed contract before returning.
 *  - Rule 4:  Every assessment cites evidence sources.
 *  - Rule 5:  The engine never approves or rejects — it recommends only.
 */

import type { AIProvider }  from '../providers/AIProvider.js';
import type { VectorStore } from '../vector/VectorStore.js';
import type {
  AssessmentInput,
  AssessmentResult,
  AssessmentRecommendation,
  EvidenceSource,
  EmbedDocumentInput,
  Verdict,
} from '../types/index.js';

// ─── Engine Interface ─────────────────────────────────────────────────────────

export interface AgentEngine {
  assess(input: AssessmentInput): Promise<AssessmentResult>;
  embedDocument(input: EmbedDocumentInput): Promise<void>;
}

// ─── Engine Dependencies ──────────────────────────────────────────────────────

export interface AgentEngineDeps {
  aiProvider  : AIProvider;
  vectorStore : VectorStore;
}

// ─── Raw LLM Output Shape ─────────────────────────────────────────────────────

interface RawAssessmentOutput {
  verdict          : string;
  rationale        : string;
  confidence       : number;
  evidenceSources  : Array<{
    docId   : string;
    title   : string;
    excerpt : string;
    score   : number;
  }>;
  recommendations  : Array<{
    type        : string;
    description : string;
    effort      : string;
    priority    : string;
    rationale   : string;
  }>;
}

const VALID_VERDICTS: Verdict[] = [
  'FIT_TO_STANDARD',
  'ACCEPTABLE_GAP',
  'CUSTOMIZATION_RISK',
  'REJECT',
  'NEEDS_REVIEW',
];

// ─── Implementation ───────────────────────────────────────────────────────────

export class NGuardAgentEngine implements AgentEngine {
  private readonly ai    : AIProvider;
  private readonly store : VectorStore;

  readonly agentVersion = '0.1.0';

  constructor(deps: AgentEngineDeps) {
    this.ai    = deps.aiProvider;
    this.store = deps.vectorStore;
  }

  // ── assess ─────────────────────────────────────────────────────────────────

  async assess(input: AssessmentInput): Promise<AssessmentResult> {
    // 1. Retrieve relevant knowledge (rule 3: filter by edition + release first)
    const searchResults = await this.store.search(
      `${input.title} ${input.description}`,
      {
        filter: {
          tenantId  : input.tenantId,
          projectId : input.projectId,
          edition   : input.edition,
          release   : input.release,
        },
        limit     : 6,
        threshold : 0.0, // Accept all results in mock; real store will filter
      },
    );

    const contextDocs = searchResults.map(r => ({
      docId   : r.document.id,
      title   : r.document.metadata.title ?? r.document.id,
      excerpt : r.document.content.slice(0, 500),
      score   : r.score,
    }));

    // 2. Build prompts
    const systemPrompt = buildSystemPrompt(input.edition, input.release);
    const userPrompt   = buildUserPrompt(input, contextDocs);

    // 3. Call LLM (rule 7)
    const response = await this.ai.complete({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userPrompt   },
      ],
      temperature    : 0.2,
      responseFormat : 'json',
    });

    // 4. Parse and validate structured output (rule 12)
    const raw = parseAssessmentOutput(response.content);

    // 5. Return typed result
    return {
      verdict         : raw.verdict as Verdict,
      rationale       : raw.rationale,
      confidence      : clamp(raw.confidence, 0, 1),
      evidenceSources : raw.evidenceSources as EvidenceSource[],
      recommendations : raw.recommendations as AssessmentRecommendation[],
    };
  }

  // ── embedDocument ──────────────────────────────────────────────────────────

  async embedDocument(input: EmbedDocumentInput): Promise<void> {
    const embeddingResponse = await this.ai.embed({
      texts: [input.content],
    });

    await this.store.upsert([
      {
        id        : input.id,
        content   : input.content,
        embedding : embeddingResponse.embeddings[0],
        metadata  : input.metadata,
      },
    ]);
  }
}

// ─── Prompt Builders ──────────────────────────────────────────────────────────

function buildSystemPrompt(edition: string, release?: string): string {
  const editionLabel = {
    ON_PREMISE    : 'SAP S/4HANA On-Premise',
    CLOUD_PRIVATE : 'SAP S/4HANA Cloud, Private Edition',
    CLOUD_PUBLIC  : 'SAP S/4HANA Cloud, Public Edition',
  }[edition] ?? edition;

  const releaseClause = release ? ` (Release ${release})` : '';

  return `You are N-Guard, an expert SAP S/4HANA fit-to-standard compliance agent.

Your role is to assess whether a proposed design requirement or customization is necessary,
or whether it can be met by SAP standard functionality in ${editionLabel}${releaseClause}.

CRITICAL RULES:
1. You are assessing specifically for ${editionLabel}${releaseClause}.
   Never assume features from other editions are available.
2. Every assessment must be evidence-backed. Cite specific SAP documentation or best practices.
3. You challenge unnecessary customization — your default stance is fit-to-standard.
4. Human architects make the final decision. Your role is to inform, not to approve.
5. Never invent SAP API names, transaction codes, or capabilities that do not exist.

RESPONSE FORMAT:
You MUST respond with a single valid JSON object matching this exact schema:
{
  "verdict": "<FIT_TO_STANDARD|ACCEPTABLE_GAP|CUSTOMIZATION_RISK|REJECT|NEEDS_REVIEW>",
  "rationale": "<detailed explanation, max 1000 chars>",
  "confidence": <0.0 to 1.0>,
  "evidenceSources": [
    { "docId": "<id>", "title": "<title>", "excerpt": "<excerpt>", "score": <0.0-1.0> }
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
  input: AssessmentInput,
  context: Array<{ docId: string; title: string; excerpt: string; score: number }>,
): string {
  const contextSection = context.length > 0
    ? `\n\nRELEVANT KNOWLEDGE BASE DOCUMENTS:\n${
        context.map((d, i) =>
          `[${i + 1}] (score: ${d.score.toFixed(2)}) ${d.title}\n${d.excerpt}`
        ).join('\n\n')
      }`
    : '\n\n(No relevant knowledge documents found in the retrieval corpus.)';

  return `DESIGN REQUEST ASSESSMENT

Title: ${input.title}
Business Process: ${input.businessProcess ?? 'Not specified'}
SAP Module: ${input.module ?? 'Not specified'}
Target Edition: ${input.edition}${input.release ? ` / Release ${input.release}` : ''}

Description:
${input.description}
${contextSection}

Please assess this design request and respond with the JSON schema specified in your instructions.`;
}

// ─── Output Parser ────────────────────────────────────────────────────────────

function parseAssessmentOutput(content: string): RawAssessmentOutput {
  let parsed: unknown;
  try {
    // Strip markdown code fences if the LLM wraps output
    const cleaned = content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    parsed = JSON.parse(cleaned);
  } catch {
    // Fallback for non-JSON responses
    return {
      verdict         : 'NEEDS_REVIEW',
      rationale       : `Agent returned non-JSON response. Manual review required. Raw: ${content.slice(0, 300)}`,
      confidence      : 0.0,
      evidenceSources : [],
      recommendations : [],
    };
  }

  const obj = parsed as Record<string, unknown>;

  const verdict = typeof obj['verdict'] === 'string' && VALID_VERDICTS.includes(obj['verdict'] as Verdict)
    ? obj['verdict'] as Verdict
    : 'NEEDS_REVIEW';

  return {
    verdict,
    rationale       : typeof obj['rationale']  === 'string' ? obj['rationale']  : '',
    confidence      : typeof obj['confidence'] === 'number' ? obj['confidence'] : 0,
    evidenceSources : Array.isArray(obj['evidenceSources']) ? obj['evidenceSources'] : [],
    recommendations : Array.isArray(obj['recommendations']) ? obj['recommendations'] : [],
  };
}

function clamp(val: number, min: number, max: number): number {
  return Math.min(Math.max(val, min), max);
}
