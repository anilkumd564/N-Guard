import React, { useCallback, useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  listDesignRequests,
  createDesignRequest,
  submitForAssessment,
} from '../api/client.js';
import type { DesignRequest } from '../types/api.js';
import { LoadingSpinner, ErrorMessage } from '../components/index.js';

const STATUS_COLORS: Record<string, string> = {
  DRAFT      : 'neutral',
  SUBMITTED  : 'info',
  ASSESSING  : 'warning',
  ASSESSED   : 'success',
  APPROVED   : 'success',
  REJECTED   : 'danger',
};

export default function DesignRequestsPage() {
  const [searchParams] = useSearchParams();
  const projectId = searchParams.get('projectId') ?? undefined;
  const navigate   = useNavigate();

  const [requests, setRequests] = useState<DesignRequest[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [title,       setTitle]       = useState('');
  const [description, setDescription] = useState('');
  const [bizProcess,  setBizProcess]  = useState('');
  const [module,      setModule]      = useState('');
  const [submitting,  setSubmitting]  = useState(false);

  const loadRequests = useCallback(() => {
    setLoading(true);
    listDesignRequests(projectId)
      .then(setRequests)
      .catch(err => setError(String(err)))
      .finally(() => setLoading(false));
  }, [projectId]);

  useEffect(() => { loadRequests(); }, [loadRequests]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!projectId) return;
    setSubmitting(true);
    try {
      await createDesignRequest({
        project_ID      : projectId,
        tenant_ID       : 'default',
        workItemType    : 'REQUIREMENT',
        priority        : 'MEDIUM',
        title,
        description,
        businessProcess : bizProcess,
        module,
      });
      setShowForm(false);
      setTitle(''); setDescription(''); setBizProcess(''); setModule('');
      loadRequests();
    } catch (err) {
      setError(String(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSubmitForAssessment(drId: string) {
    try {
      const assessment = await submitForAssessment(drId);
      loadRequests();
      navigate(`/assessments/${assessment.ID}`);
    } catch (err) {
      setError(String(err));
    }
  }

  if (loading) return <LoadingSpinner label="Loading design requests…" />;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Design Requests</h1>
          <p className="page-subtitle">
            Submit requirements for fit-to-standard assessment by the N-Guard Agent.
          </p>
        </div>
        {projectId && (
          <button className="btn btn--primary" onClick={() => setShowForm(v => !v)}>
            {showForm ? 'Cancel' : '+ New Request'}
          </button>
        )}
      </div>

      {error && <ErrorMessage message={error} onDismiss={() => setError(null)} />}

      {showForm && (
        <form className="form card" onSubmit={handleCreate}>
          <h2 className="form__title">New Design Request</h2>
          <label className="form__label">
            Title *
            <input className="form__input" value={title} onChange={e => setTitle(e.target.value)} required />
          </label>
          <label className="form__label">
            Description *
            <textarea className="form__textarea" rows={5} value={description}
              onChange={e => setDescription(e.target.value)} required />
          </label>
          <div className="form__row">
            <label className="form__label">
              Business Process
              <input className="form__input" value={bizProcess}
                placeholder="e.g. Order-to-Cash"
                onChange={e => setBizProcess(e.target.value)} />
            </label>
            <label className="form__label">
              SAP Module
              <input className="form__input" value={module}
                placeholder="e.g. SD, MM, FI"
                onChange={e => setModule(e.target.value)} />
            </label>
          </div>
          <div className="form__actions">
            <button type="submit" className="btn btn--primary" disabled={submitting}>
              {submitting ? 'Saving…' : 'Save as Draft'}
            </button>
          </div>
        </form>
      )}

      {requests.length === 0 ? (
        <div className="empty-state">
          <p>No design requests yet. {projectId ? 'Click "+ New Request" to add one.' : 'Select a project first.'}</p>
        </div>
      ) : (
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Process</th>
                <th>Module</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {requests.map(dr => (
                <tr key={dr.ID}>
                  <td className="table__title">{dr.title}</td>
                  <td>{dr.businessProcess ?? '—'}</td>
                  <td>{dr.module ?? '—'}</td>
                  <td>
                    <span className={`status-chip status-chip--${STATUS_COLORS[dr.status] ?? 'neutral'}`}>
                      {dr.status}
                    </span>
                  </td>
                  <td>
                    {(dr.status === 'DRAFT' || dr.status === 'SUBMITTED') && (
                      <button
                        className="btn btn--sm btn--primary"
                        onClick={() => handleSubmitForAssessment(dr.ID)}
                      >
                        Assess
                      </button>
                    )}
                    {dr.status === 'ASSESSED' && (
                      <button
                        className="btn btn--sm btn--secondary"
                        onClick={() => navigate(`/assessments/${dr.ID}`)}
                      >
                        View Result
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
