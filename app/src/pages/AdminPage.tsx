import React from 'react';
import PagePlaceholder from '../components/PagePlaceholder.js';

export default function AdminPage() {
  return (
    <PagePlaceholder
      icon="⚙️"
      title="Administration"
      description="Platform administration including tenant management, user roles, knowledge source configuration, provider settings, and audit log access. Role-based access control enforced server-side."
      phase="Phase 13 — Security, Tenant Isolation, and Production Controls"
    />
  );
}
