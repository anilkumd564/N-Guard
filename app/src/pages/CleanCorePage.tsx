import React from 'react';
import PagePlaceholder from '../components/PagePlaceholder.js';

export default function CleanCorePage() {
  return (
    <PagePlaceholder
      icon="✦"
      title="Clean Core"
      description="Evaluate proposed designs against SAP Clean Core principles and extensibility governance rules. Identifies preferred implementation patterns (standard, configuration, key-user extension, side-by-side BTP extension) with edition-aware applicability."
      phase="Phase 9 — Clean Core and Extensibility Governance"
    />
  );
}
