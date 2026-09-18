/**
 * N-Guard — MockFitAIProvider (Phase 7)
 *
 * A deterministic MockAIProvider for Fit-to-Standard assessment testing.
 * Returns specific F1–F8 classifications based on keywords in the input.
 *
 * Architecture rule 7: All LLM calls go through AIProvider — this mock
 * satisfies the interface without making real API calls.
 *
 * Keyword mapping (case-insensitive, first match wins):
 *  "standard fit" / "fits standard"  → F1
 *  "configure" / "customizing"       → F2
 *  "minor extension"                 → F3
 *  "btp" / "side-by-side" / "key-user" → F4
 *  "redesign" / "simplify"           → F5
 *  "custom code" / "abap" / "risk"   → F6
 *  "unique" / "differentiator"       → F7
 *  (default / "insufficient")        → F8
 */

import { MockAIProvider } from '../providers/MockAIProvider.js';
import type { AICompletionRequest, AICompletionResponse } from '../providers/AIProvider.js';

type ClassificationRule = { keywords: string[]; fc: string; dp: string; ec: string; conf: number };

const RULES: ClassificationRule[] = [
  { keywords: ['standard fit', 'fits standard', 'f1'],      fc: 'F1', dp: 'DP-ALL',    ec: 'VERIFIED',              conf: 0.9 },
  { keywords: ['configur', 'customizing', 'f2'],            fc: 'F2', dp: 'DP-ALL',    ec: 'LIKELY',                conf: 0.8 },
  { keywords: ['minor extension', 'f3'],                     fc: 'F3', dp: 'DP-ALL',    ec: 'LIKELY',                conf: 0.75 },
  { keywords: ['btp', 'side-by-side', 'key-user', 'f4'],    fc: 'F4', dp: 'DP-VERIFY', ec: 'NEEDS_SME_REVIEW',      conf: 0.6 },
  { keywords: ['redesign', 'simplif', 'standardiz', 'f5'],  fc: 'F5', dp: 'DP-ALL',    ec: 'LIKELY',                conf: 0.7 },
  { keywords: ['custom code', 'custom abap', 'risk', 'f6'], fc: 'F6', dp: 'DP-OP',     ec: 'NEEDS_SME_REVIEW',      conf: 0.65 },
  { keywords: ['unique', 'differentiator', 'f7'],            fc: 'F7', dp: 'DP-OP',     ec: 'NEEDS_SME_REVIEW',      conf: 0.55 },
  { keywords: ['insufficient', 'no evidence', 'f8', 'unknown'], fc: 'F8', dp: 'DP-VERIFY', ec: 'INSUFFICIENT_EVIDENCE', conf: 0.0 },
];

export class MockFitAIProvider extends MockAIProvider {
  override async complete(request: AICompletionRequest): Promise<AICompletionResponse> {
    // Only match keywords from user messages — system prompt contains F1-F8 labels
    // which would otherwise always match F1 first.
    const userContent = request.messages
      .filter(m => m.role === 'user')
      .map(m => m.content)
      .join(' ')
      .toLowerCase();
    const fullText = userContent;

    // Find first matching rule
    let rule: ClassificationRule = RULES[RULES.length - 1]; // default F8
    for (const r of RULES) {
      if (r.keywords.some(kw => fullText.includes(kw))) {
        rule = r;
        break;
      }
    }

    // Use the rule's default DP code.
    // Edition-specific DP-* codes are determined by FitAssessmentEngine context
    // and the production LLM — the mock stays deterministic.
    const dpCode = rule.dp;

    const payload = {
      fitClassification        : rule.fc,
      deploymentCompatibility  : dpCode,
      evidenceConfidence       : rule.ec,
      confidence               : rule.conf,
      businessIntentSummary    : 'Test business intent summary for automated scenario test.',
      processClassification    : 'Order-to-Cash',
      targetDeploymentContext  : 'SAP S/4HANA test context.',
      standardCapability       : rule.fc === 'F1' || rule.fc === 'F2' ? 'SAP Standard Pricing' : null,
      gapDescription           : rule.fc !== 'F1' ? 'Gap description for test.' : null,
      configurationOpportunity : rule.fc === 'F2' ? 'Configure pricing conditions.' : null,
      customizationRiskStatement: rule.fc === 'F6' || rule.fc === 'F7' ? 'High risk of upgrade impact.' : null,
      recommendedNextAction    : `Review ${rule.fc} classification with the architecture board.`,
      recommendations          : [{
        type       : 'STANDARD_ALTERNATIVE',
        description: 'Use SAP standard process.',
        effort     : 'LOW',
        priority   : 'HIGH',
        rationale  : 'Reduces TCO and upgrade risk.',
      }],
      assumptions              : ['SAP standard covers basic use case'],
      unknowns                 : rule.fc === 'F8' ? ['No evidence available'] : [],
      humanReviewRequired      : rule.fc === 'F6' || rule.fc === 'F7' || rule.fc === 'F8',
    };

    return {
      content : JSON.stringify(payload),
      model   : 'mock-fit-4o',
      usage   : { promptTokens: 100, completionTokens: 200, totalTokens: 300 },
    };
  }
}
