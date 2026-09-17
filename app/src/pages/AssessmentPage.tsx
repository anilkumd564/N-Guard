import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getAssessment, approveAssessment, rejectAssessment } from '../api/client.js';
import type { ComplianceAssessment, EvidenceSource, Recommendation } from '../types/api.js';
import { VerdictBadge, LoadingSpinner, ErrorMessage } from '../components/index.js';

export default function AssessmentPage() {
  const { id }   = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [assessment, setAssessment] = useState<ComplianceAssessment | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState<string | null>(null);
  const [acting,     setActing]     = useState(false);

  useEffect(() => {
    if (!id) return;
    getAssessment(id)
      .then(setAssessment)
      .catch(err => setError(String(err)))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleApprove() {
    if (!assessment) return;
    setActing(true);
    try {
      await approveAssessment(assessment.ID);
      navigate('/requests');
    } catch (err) {
      setError(String(err));
    } finally {
      setActing(false);
    }
  }

  async function handleReject() {
    if (!assessment) return;
    const reason = window.prompt('Reason for rejection (optional):') ?? '';
    setActing(true);
    try {
      await rejectAssessment(assessment.ID, reason);
      navigate('/requests');
    } catch (err) {
      setError(String(err));
    } finally {
      setActing(false);
    }
  }

  if (loading)        return <LoadingSpinner label="Loading assessment…" />;
  if (error)          return <ErrorMessage message={error} />;
  if (!assessment)    return <ErrorMessage message="Assessment not found." />;

  const evidenceSources: EvidenceSource[] = assessment.evidenceSources
    ? JSON.parse(assessment.evidenceSources) as EvidenceSource[]
    : [];

  const isCompleted = assessment.status === 'COMPLETED';

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <button className="btn btn--ghost btn--sm" onClick={() => navigate(-1)}>← Back</button>
          <h1 className="page-title" style={{ marginTop: '0.5rem' }}>
            Compliance Assessment
          </h1>
        </div>
        {isCompleted && (
          <div className="btn-group">
            <button className="btn btn--success" disabled={acting} onClick={handleApprove}>
              ✓ Approve
            </button>
            <button className="btn btn--danger" disabled={acting} onClick={handleReject}>
              ✗ Reject
            </button>
          </div>
        )}
      </div>

      {/* Status + Verdict */}
      <div className="assessment-summary card">
        <div className="assessment-summary__row">
          <div>
            <span className="label">Status</span>
            <span className={`status-chip status-chip--${assessment.status.toLowerCase()}`}>
              {assessment.status}
            </span>
          </div>
          {assessment.verdict && (
            <div>
              <span className="label">Verdict</span>
              <VerdictBadge verdict={assessment.verdict} />
            </div>
          )}
          {assessment.confidence !== undefined && (
            <div>
              <span className="label">Confidence</span>
              <span className="confidence-bar">
                <span
                  className="confidence-bar__fill"
                  style={{ width: `${Math.round(assessment.confidence * 100)}%` }}
                />
                <span className="confidence-bar__label">
                  {Math.round(assessment.confidence * 100)}%
                </span>
              </span>
            </div>
          )}
        </div>

        {assessment.rationale && (
          <div className="assessment-summary__rationale">
            <span className="label">Rationale</span>
            <p>{assessment.rationale}</p>
          </div>
        )}
      </div>

      {/* Evidence Sources */}
      {evidenceSources.length > 0 && (
        <section className="section">
          <h2 className="section__title">Evidence Sources</h2>
          <div className="evidence-list">
            {evidenceSources.map((src, i) => (
              <div key={src.docId ?? i} className="evidence-item card">
                <div className="evidence-item__header">
                  <strong>{src.title}</strong>
                  <span className="score-badge">Score: {(src.score * 100).toFixed(0)}%</span>
                </div>
                <p className="evidence-item__excerpt">{src.excerpt}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Recommendations */}
      {assessment.recommendations && assessment.recommendations.length > 0 && (
        <section className="section">
          <h2 className="section__title">Recommendations</h2>
          <div className="recommendations-list">
            {assessment.recommendations.map((rec: Recommendation) => (
              <div key={rec.ID} className="recommendation-item card">
                <div className="recommendation-item__header">
                  <span className="rec-type-badge">{rec.type.replace('_', ' ')}</span>
                  <span className={`priority-badge priority-badge--${rec.priority.toLowerCase()}`}>
                    {rec.priority}
                  </span>
                  <span className={`effort-badge effort-badge--${rec.effort.toLowerCase()}`}>
                    Effort: {rec.effort}
                  </span>
                </div>
                <p className="recommendation-item__description">{rec.description}</p>
                {rec.rationale && (
                  <p className="recommendation-item__rationale">{rec.rationale}</p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="human-authority-notice">
        ⚠️ <strong>Human architects remain the final decision authority.</strong>
        N-Guard recommendations are advisory only.
      </div>
    </div>
  );
}
