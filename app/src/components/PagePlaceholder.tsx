/**
 * N-Guard — Page Placeholder (Phase 1)
 *
 * Renders a consistent "coming soon" UI for pages that have not yet been
 * implemented.  All placeholder pages use this component so the shell can
 * be validated end-to-end without any business logic present.
 */

import React from 'react';

interface Props {
  title       : string;
  description : string;
  phase       : string;
  icon?       : string;
}

export default function PagePlaceholder({ title, description, phase, icon = '🚧' }: Props) {
  return (
    <div style={{
      display        : 'flex',
      flexDirection  : 'column',
      alignItems     : 'center',
      justifyContent : 'center',
      minHeight      : '60vh',
      color          : '#64748b',
      textAlign      : 'center',
      gap            : '1rem',
      padding        : '2rem',
    }}>
      <span style={{ fontSize: '3rem' }}>{icon}</span>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>
        {title}
      </h1>
      <p style={{ fontSize: '0.95rem', maxWidth: '480px', lineHeight: 1.6, margin: 0 }}>
        {description}
      </p>
      <span style={{
        fontSize     : '0.75rem',
        background   : '#f1f5f9',
        color        : '#475569',
        padding      : '0.3rem 0.75rem',
        borderRadius : '999px',
        fontWeight   : 500,
      }}>
        Planned: {phase}
      </span>
    </div>
  );
}
