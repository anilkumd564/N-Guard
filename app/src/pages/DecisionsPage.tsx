import React from 'react';
import PagePlaceholder from '../components/PagePlaceholder.js';

export default function DecisionsPage() {
  return (
    <PagePlaceholder
      icon="📌"
      title="Design Decisions"
      description="Queryable register of approved design decisions, architecture exceptions, and governance outcomes. Every decision records the actor, timestamp, prior state, and linked evidence. AI is never the recorded approver."
      phase="Phase 10 — Evidence, Confidence, Human Review, and Exception Workflow"
    />
  );
}
