/**
 * N-Guard — React Error Boundary
 *
 * Catches JavaScript errors anywhere in the child component tree,
 * logs them, and renders a recovery UI instead of crashing the page.
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children    : ReactNode;
  /** Optional custom fallback UI.  Receives the error. */
  fallback?   : (error: Error, reset: () => void) => ReactNode;
}

interface State {
  hasError : boolean;
  error    : Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
    this.reset = this.reset.bind(this);
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // In production this would send to an observability service
    console.error('[N-Guard] Unhandled error:', error, info.componentStack);
  }

  reset(): void {
    this.setState({ hasError: false, error: null });
  }

  render(): ReactNode {
    const { hasError, error } = this.state;
    const { children, fallback } = this.props;

    if (!hasError || !error) return children;

    if (fallback) return fallback(error, this.reset);

    return (
      <div style={{
        padding      : '2rem',
        margin       : '2rem auto',
        maxWidth     : '600px',
        background   : '#fef2f2',
        border       : '1px solid #fecaca',
        borderRadius : '8px',
        color        : '#991b1b',
      }}>
        <h2 style={{ marginBottom: '0.75rem' }}>Something went wrong</h2>
        <p style={{ fontSize: '0.9rem', marginBottom: '1rem' }}>
          {error.message}
        </p>
        <button
          onClick={this.reset}
          style={{
            padding      : '0.5rem 1rem',
            background   : '#dc2626',
            color        : '#fff',
            border       : 'none',
            borderRadius : '6px',
            cursor       : 'pointer',
          }}
        >
          Try again
        </button>
      </div>
    );
  }
}

export default ErrorBoundary;
