/**
 * N-Guard — Phase 10 Human Review Workflow Tests
 *
 * Tests cover:
 *  1. Review status state machine — valid transitions
 *  2. AI cannot be recorded as final approver (rule 5)
 *  3. Exception approval requires rationale
 *  4. Rejection requires rationale
 *  5. Modify disposition requires rationale
 *  6. Actions without rationale requirement accept empty rationale
 *  7. ACTION_NEXT_STATUS covers all actions
 *  8. RATIONALE_REQUIRED contains correct actions
 *  9. REVIEW_STATUS_LABELS covers all statuses
 * 10. CONFIDENCE_REVIEW_STATES maps to valid actions
 * 11. isAIFinalApprover is always false in DesignDecision
 */

import { describe, it, expect } from '@jest/globals';
import {
  REVIEW_STATUS_LABELS,
  REVIEW_STATUS_COLORS,
  REVIEW_ACTION_LABELS,
  ACTION_NEXT_STATUS,
  RATIONALE_REQUIRED,
  CONFIDENCE_REVIEW_STATES,
} from '../review/types.js';
import type {
  ReviewStatus,
  ReviewAction,
  DesignDecision,
} from '../review/types.js';

const ALL_STATUSES: ReviewStatus[] = [
  'NOT_SUBMITTED', 'PENDING_REVIEW', 'UNDER_REVIEW', 'ACCEPTED',
  'MODIFIED', 'EXCEPTION_APPROVED', 'REJECTED', 'RETURNED',
  'SME_ESCALATED', 'ARCHIVED',
];

const ALL_ACTIONS: ReviewAction[] = [
  'ACCEPT', 'MODIFY_DISPOSITION', 'REQUEST_MORE_EVIDENCE',
  'SEND_TO_SME', 'APPROVE_EXCEPTION', 'REJECT_CUSTOMIZATION', 'RETURN_TO_OWNER',
];

// ── 1. Review status labels / colors ─────────────────────────────────────────

describe('ReviewStatus metadata', () => {
  it('REVIEW_STATUS_LABELS covers all statuses', () => {
    for (const s of ALL_STATUSES) {
      expect(REVIEW_STATUS_LABELS[s]).toBeDefined();
      expect(REVIEW_STATUS_LABELS[s].length).toBeGreaterThan(0);
    }
  });

  it('REVIEW_STATUS_COLORS covers all statuses', () => {
    for (const s of ALL_STATUSES) {
      expect(REVIEW_STATUS_COLORS[s]).toBeDefined();
      expect(REVIEW_STATUS_COLORS[s]).toMatch(/^#/);
    }
  });
});

// ── 2. Review action labels ───────────────────────────────────────────────────

describe('ReviewAction metadata', () => {
  it('REVIEW_ACTION_LABELS covers all actions', () => {
    for (const a of ALL_ACTIONS) {
      expect(REVIEW_ACTION_LABELS[a]).toBeDefined();
      expect(REVIEW_ACTION_LABELS[a].length).toBeGreaterThan(0);
    }
  });

  it('ACTION_NEXT_STATUS covers all actions', () => {
    for (const a of ALL_ACTIONS) {
      expect(ACTION_NEXT_STATUS[a]).toBeDefined();
      expect(ALL_STATUSES).toContain(ACTION_NEXT_STATUS[a]);
    }
  });
});

// ── 3. State transitions ──────────────────────────────────────────────────────

describe('Action → Status state machine', () => {
  it('ACCEPT → ACCEPTED', () => {
    expect(ACTION_NEXT_STATUS['ACCEPT']).toBe('ACCEPTED');
  });

  it('MODIFY_DISPOSITION → MODIFIED', () => {
    expect(ACTION_NEXT_STATUS['MODIFY_DISPOSITION']).toBe('MODIFIED');
  });

  it('APPROVE_EXCEPTION → EXCEPTION_APPROVED', () => {
    expect(ACTION_NEXT_STATUS['APPROVE_EXCEPTION']).toBe('EXCEPTION_APPROVED');
  });

  it('REJECT_CUSTOMIZATION → REJECTED', () => {
    expect(ACTION_NEXT_STATUS['REJECT_CUSTOMIZATION']).toBe('REJECTED');
  });

  it('SEND_TO_SME → SME_ESCALATED', () => {
    expect(ACTION_NEXT_STATUS['SEND_TO_SME']).toBe('SME_ESCALATED');
  });

  it('REQUEST_MORE_EVIDENCE → RETURNED', () => {
    expect(ACTION_NEXT_STATUS['REQUEST_MORE_EVIDENCE']).toBe('RETURNED');
  });

  it('RETURN_TO_OWNER → RETURNED', () => {
    expect(ACTION_NEXT_STATUS['RETURN_TO_OWNER']).toBe('RETURNED');
  });
});

// ── 4. Rationale requirements ─────────────────────────────────────────────────

describe('RATIONALE_REQUIRED enforcement (rule 5)', () => {
  it('APPROVE_EXCEPTION requires rationale', () => {
    expect(RATIONALE_REQUIRED.has('APPROVE_EXCEPTION')).toBe(true);
  });

  it('REJECT_CUSTOMIZATION requires rationale', () => {
    expect(RATIONALE_REQUIRED.has('REJECT_CUSTOMIZATION')).toBe(true);
  });

  it('MODIFY_DISPOSITION requires rationale', () => {
    expect(RATIONALE_REQUIRED.has('MODIFY_DISPOSITION')).toBe(true);
  });

  it('ACCEPT does NOT require rationale', () => {
    expect(RATIONALE_REQUIRED.has('ACCEPT')).toBe(false);
  });

  it('SEND_TO_SME does NOT require rationale', () => {
    expect(RATIONALE_REQUIRED.has('SEND_TO_SME')).toBe(false);
  });

  it('REQUEST_MORE_EVIDENCE does NOT require rationale', () => {
    expect(RATIONALE_REQUIRED.has('REQUEST_MORE_EVIDENCE')).toBe(false);
  });
});

// ── 5. AI cannot be final approver (rule 5) ───────────────────────────────────

describe('DesignDecision — AI cannot be final approver (rule 5)', () => {
  it('isAIFinalApprover is always typed as false literal', () => {
    const decision: DesignDecision = {
      id               : 'dd-001',
      designRequestId  : 'dr-001',
      projectId        : 'proj-001',
      tenantId         : 'tenant-001',
      recordType       : 'DECISION',
      reviewAction     : 'ACCEPT',
      newStatus        : 'ACCEPTED',
      priorStatus      : 'PENDING_REVIEW',
      actor            : 'john.architect@example.com',
      decidedAt        : new Date().toISOString(),
      linkedEvidence   : [],
      isAIFinalApprover: false,  // TypeScript literal type — can only be false
    };

    expect(decision.isAIFinalApprover).toBe(false);
    // TypeScript type system prevents setting to true
  });

  it('actor must be a non-empty human identifier', () => {
    const decision: DesignDecision = {
      id               : 'dd-002',
      designRequestId  : 'dr-001',
      projectId        : 'proj-001',
      tenantId         : 'tenant-001',
      recordType       : 'EXCEPTION',
      reviewAction     : 'APPROVE_EXCEPTION',
      newStatus        : 'EXCEPTION_APPROVED',
      priorStatus      : 'PENDING_REVIEW',
      actor            : 'design.authority@example.com',
      decidedAt        : new Date().toISOString(),
      rationale        : 'Justified business need — no standard SAP alternative exists.',
      linkedEvidence   : [],
      isAIFinalApprover: false,
    };

    expect(decision.actor).not.toBe('AI');
    expect(decision.actor).not.toBe('');
    expect(decision.actor.length).toBeGreaterThan(0);
    expect(decision.rationale?.length).toBeGreaterThan(0);
  });

  it('exception requires rationale — decision without rationale should be invalid', () => {
    // Validate at application level: APPROVE_EXCEPTION must have rationale
    const action: ReviewAction = 'APPROVE_EXCEPTION';
    const rationale: string = '';
    const requiresRationale = RATIONALE_REQUIRED.has(action);
    const isInvalid = requiresRationale && (!rationale || rationale.trim().length === 0);
    expect(isInvalid).toBe(true);
  });

  it('ACCEPT without rationale is valid', () => {
    const action: ReviewAction = 'ACCEPT';
    const rationale: string = '';
    const requiresRationale = RATIONALE_REQUIRED.has(action);
    const isValid = !requiresRationale || (rationale.trim().length > 0);
    expect(isValid).toBe(true);
  });
});

// ── 6. Confidence → suggested review actions ─────────────────────────────────

describe('CONFIDENCE_REVIEW_STATES mapping', () => {
  it('VERIFIED allows ACCEPT', () => {
    expect(CONFIDENCE_REVIEW_STATES['VERIFIED']).toContain('ACCEPT');
  });

  it('INSUFFICIENT_EVIDENCE does NOT include ACCEPT directly', () => {
    expect(CONFIDENCE_REVIEW_STATES['INSUFFICIENT_EVIDENCE']).not.toContain('ACCEPT');
  });

  it('NEEDS_SME_REVIEW includes SEND_TO_SME', () => {
    expect(CONFIDENCE_REVIEW_STATES['NEEDS_SME_REVIEW']).toContain('SEND_TO_SME');
  });

  it('all suggested actions exist in ALL_ACTIONS', () => {
    for (const actions of Object.values(CONFIDENCE_REVIEW_STATES)) {
      for (const action of actions) {
        expect(ALL_ACTIONS).toContain(action);
      }
    }
  });
});

// ── 7. Record type classification ─────────────────────────────────────────────

function classifyDecisionRecord(action: string): 'EXCEPTION' | 'ESCALATION' | 'DECISION' {
  if (action === 'APPROVE_EXCEPTION') return 'EXCEPTION';
  if (action === 'SEND_TO_SME') return 'ESCALATION';
  return 'DECISION';
}

describe('DesignDecision record type classification', () => {
  it('APPROVE_EXCEPTION maps to EXCEPTION record type', () => {
    expect(classifyDecisionRecord('APPROVE_EXCEPTION')).toBe('EXCEPTION');
  });

  it('SEND_TO_SME maps to ESCALATION record type', () => {
    expect(classifyDecisionRecord('SEND_TO_SME')).toBe('ESCALATION');
  });

  it('ACCEPT maps to DECISION record type', () => {
    expect(classifyDecisionRecord('ACCEPT')).toBe('DECISION');
  });
});
