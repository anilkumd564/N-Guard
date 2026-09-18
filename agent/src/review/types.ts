/**
 * N-Guard — Human Review Workflow Types (Phase 10)
 *
 * Architecture rules:
 *  - Rule 5: AI NEVER becomes the final design authority.
 *             All approvals, exceptions, and rejections require a human actor.
 *  - Rule 4: Every state transition is audited with actor, timestamp, and rationale.
 */

import type { Verdict } from '../types/index.js';
import type { EvidenceReference } from '../orchestration/types.js';

// ─── Review Status ────────────────────────────────────────────────────────────

/**
 * Lifecycle status of a compliance assessment in the human review workflow.
 */
export type ReviewStatus =
  | 'NOT_SUBMITTED'       // Assessment completed but not yet submitted for review
  | 'PENDING_REVIEW'      // Submitted — awaiting reviewer pick-up
  | 'UNDER_REVIEW'        // A reviewer has opened the assessment
  | 'ACCEPTED'            // Reviewer accepted the AI recommendation
  | 'MODIFIED'            // Reviewer modified the disposition
  | 'EXCEPTION_APPROVED'  // A governance exception was formally approved
  | 'REJECTED'            // Proposed customization rejected
  | 'RETURNED'            // Returned to requirement owner for clarification
  | 'SME_ESCALATED'       // Escalated to Subject Matter Expert
  | 'ARCHIVED';           // Historical — no further action required

export const REVIEW_STATUS_LABELS: Record<ReviewStatus, string> = {
  NOT_SUBMITTED     : 'Not Submitted',
  PENDING_REVIEW    : 'Pending Review',
  UNDER_REVIEW      : 'Under Review',
  ACCEPTED          : 'Accepted',
  MODIFIED          : 'Modified',
  EXCEPTION_APPROVED: 'Exception Approved',
  REJECTED          : 'Rejected',
  RETURNED          : 'Returned to Owner',
  SME_ESCALATED     : 'Escalated to SME',
  ARCHIVED          : 'Archived',
};

export const REVIEW_STATUS_COLORS: Record<ReviewStatus, string> = {
  NOT_SUBMITTED     : '#475569',
  PENDING_REVIEW    : '#94a3b8',
  UNDER_REVIEW      : '#60a5fa',
  ACCEPTED          : '#22c55e',
  MODIFIED          : '#84cc16',
  EXCEPTION_APPROVED: '#a78bfa',
  REJECTED          : '#ef4444',
  RETURNED          : '#facc15',
  SME_ESCALATED     : '#fb923c',
  ARCHIVED          : '#334155',
};

// ─── Review Actions ───────────────────────────────────────────────────────────

/**
 * Actions a human reviewer can take on an assessment.
 * Rule 5: Every action is taken by a human — AI is never the actor.
 */
export type ReviewAction =
  | 'ACCEPT'                // Accept the AI recommendation as-is
  | 'MODIFY_DISPOSITION'    // Accept with modification (must supply modifiedVerdict)
  | 'REQUEST_MORE_EVIDENCE' // Return for additional evidence gathering
  | 'SEND_TO_SME'           // Escalate to Subject Matter Expert
  | 'APPROVE_EXCEPTION'     // Formally approve a governance exception (rationale required)
  | 'REJECT_CUSTOMIZATION'  // Reject the proposed customization (rationale required)
  | 'RETURN_TO_OWNER';      // Return to requirement owner for clarification

export const REVIEW_ACTION_LABELS: Record<ReviewAction, string> = {
  ACCEPT                : 'Accept Recommendation',
  MODIFY_DISPOSITION    : 'Modify Disposition',
  REQUEST_MORE_EVIDENCE : 'Request More Evidence',
  SEND_TO_SME           : 'Send to SME Review',
  APPROVE_EXCEPTION     : 'Approve Exception',
  REJECT_CUSTOMIZATION  : 'Reject Customization',
  RETURN_TO_OWNER       : 'Return to Requirement Owner',
};

/** Which review status follows each action. */
export const ACTION_NEXT_STATUS: Record<ReviewAction, ReviewStatus> = {
  ACCEPT                : 'ACCEPTED',
  MODIFY_DISPOSITION    : 'MODIFIED',
  REQUEST_MORE_EVIDENCE : 'RETURNED',
  SEND_TO_SME           : 'SME_ESCALATED',
  APPROVE_EXCEPTION     : 'EXCEPTION_APPROVED',
  REJECT_CUSTOMIZATION  : 'REJECTED',
  RETURN_TO_OWNER       : 'RETURNED',
};

/** Actions that REQUIRE a rationale string. */
export const RATIONALE_REQUIRED: Set<ReviewAction> = new Set([
  'APPROVE_EXCEPTION',
  'REJECT_CUSTOMIZATION',
  'MODIFY_DISPOSITION',
]);

// ─── Design Decision ──────────────────────────────────────────────────────────

/**
 * A single recorded governance decision.
 * Forms the Design Decision / Exception Register (rule 5).
 * AI is NEVER the actor — this is enforced in the handler.
 */
export interface DesignDecision {
  /** Unique decision identifier. */
  id                 : string;
  /** Associated design request. */
  designRequestId    : string;
  /** Associated compliance assessment. */
  assessmentId?      : string;
  /** Project scope. */
  projectId          : string;
  /** Tenant scope. */
  tenantId           : string;
  /** Type of governance record. */
  recordType         : 'DECISION' | 'EXCEPTION' | 'ESCALATION';
  /** Review action taken. */
  reviewAction       : ReviewAction;
  /** Status after this action. */
  newStatus          : ReviewStatus;
  /** Status before this action. */
  priorStatus        : ReviewStatus;
  /** Human actor who made the decision (never 'AI'). */
  actor              : string;
  /** ISO 8601 timestamp of the decision. */
  decidedAt          : string;
  /** Required rationale for exceptions and rejections. */
  rationale?         : string;
  /** Modified verdict when action = MODIFY_DISPOSITION. */
  modifiedVerdict?   : Verdict;
  /** Disposition notes (free-form, additional context). */
  dispositionNotes?  : string;
  /** Evidence references linked to this decision. */
  linkedEvidence     : EvidenceReference[];
  /**
   * Always false — AI is never recorded as the final approver.
   * This field is an explicit audit checkpoint (rule 5).
   */
  isAIFinalApprover  : false;
}

// ─── Review Request ───────────────────────────────────────────────────────────

/** Input to record a human review decision. */
export interface RecordReviewDecisionInput {
  assessmentId     : string;
  reviewAction     : ReviewAction;
  actor            : string;
  rationale?       : string;
  modifiedVerdict? : Verdict;
  dispositionNotes?: string;
}

// ─── Evidence Confidence ─────────────────────────────────────────────────────

// Re-export from Phase 7 for use in review context
export type { EvidenceConfidence } from '../assessment/types.js';

export const CONFIDENCE_REVIEW_STATES: Record<string, ReviewAction[]> = {
  VERIFIED              : ['ACCEPT', 'MODIFY_DISPOSITION'],
  LIKELY                : ['ACCEPT', 'MODIFY_DISPOSITION', 'REQUEST_MORE_EVIDENCE'],
  NEEDS_SME_REVIEW      : ['SEND_TO_SME', 'REQUEST_MORE_EVIDENCE', 'RETURN_TO_OWNER'],
  INSUFFICIENT_EVIDENCE : ['REQUEST_MORE_EVIDENCE', 'RETURN_TO_OWNER'],
};
