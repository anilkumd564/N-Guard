/**
 * N-Guard — Shared UI Components
 */

import React from 'react';
import type { Verdict, S4Edition } from '../types/api.js';

// ─── VerdictBadge ─────────────────────────────────────────────────────────────

const VERDICT_STYLES: Record<Verdict, { label: string; color: string }> = {
  FIT_TO_STANDARD    : { label: 'Fit to Standard',    color: '#16a34a' },
  ACCEPTABLE_GAP     : { label: 'Acceptable Gap',     color: '#2563eb' },
  CUSTOMIZATION_RISK : { label: 'Customization Risk', color: '#ca8a04' },
  REJECT             : { label: 'Reject',             color: '#dc2626' },
  NEEDS_REVIEW       : { label: 'Needs Review',       color: '#7c3aed' },
};

export function VerdictBadge({ verdict }: { verdict: Verdict }) {
  const style = VERDICT_STYLES[verdict] ?? { label: verdict, color: '#64748b' };
  return (
    <span
      style={{
        background   : style.color,
        color        : '#fff',
        borderRadius : '4px',
        padding      : '2px 8px',
        fontSize     : '0.8rem',
        fontWeight   : 600,
        letterSpacing: '0.02em',
        whiteSpace   : 'nowrap',
      }}
    >
      {style.label}
    </span>
  );
}

// ─── EditionBadge ─────────────────────────────────────────────────────────────

const EDITION_COLORS: Record<S4Edition, string> = {
  ON_PREMISE    : '#0f172a',
  CLOUD_PRIVATE : '#1e40af',
  CLOUD_PUBLIC  : '#0369a1',
};

const EDITION_LABELS: Record<S4Edition, string> = {
  ON_PREMISE    : 'On-Premise',
  CLOUD_PRIVATE : 'Cloud Private',
  CLOUD_PUBLIC  : 'Cloud Public',
};

export function EditionBadge({ edition }: { edition: S4Edition }) {
  const color = EDITION_COLORS[edition] ?? '#64748b';
  const label = EDITION_LABELS[edition] ?? edition;
  return (
    <span
      style={{
        background   : color,
        color        : '#fff',
        borderRadius : '4px',
        padding      : '2px 8px',
        fontSize     : '0.75rem',
        fontWeight   : 500,
        whiteSpace   : 'nowrap',
      }}
    >
      {label}
    </span>
  );
}

// ─── LoadingSpinner ───────────────────────────────────────────────────────────

export function LoadingSpinner({ label = 'Loading…' }: { label?: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
      <div
        style={{
          display      : 'inline-block',
          width        : '32px',
          height       : '32px',
          border       : '3px solid #e2e8f0',
          borderTop    : '3px solid #0070f3',
          borderRadius : '50%',
          animation    : 'spin 0.8s linear infinite',
          marginBottom : '0.75rem',
        }}
      />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <p style={{ fontSize: '0.9rem' }}>{label}</p>
    </div>
  );
}

// ─── ErrorMessage ─────────────────────────────────────────────────────────────

export function ErrorMessage({
  message,
  onDismiss,
}: {
  message: string;
  onDismiss?: () => void;
}) {
  return (
    <div
      style={{
        background  : '#fef2f2',
        border      : '1px solid #fecaca',
        borderRadius: '8px',
        padding     : '1rem 1.25rem',
        marginBottom: '1rem',
        display     : 'flex',
        alignItems  : 'flex-start',
        gap         : '0.75rem',
        color       : '#991b1b',
      }}
    >
      <span style={{ fontSize: '1.1rem' }}>⚠️</span>
      <span style={{ flex: 1, fontSize: '0.9rem' }}>{message}</span>
      {onDismiss && (
        <button
          onClick={onDismiss}
          style={{
            background  : 'none',
            border      : 'none',
            color       : '#991b1b',
            cursor      : 'pointer',
            fontSize    : '1rem',
            padding     : '0',
            lineHeight  : 1,
          }}
          aria-label="Dismiss"
        >
          ×
        </button>
      )}
    </div>
  );
}
