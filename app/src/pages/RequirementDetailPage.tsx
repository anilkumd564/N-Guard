/**
 * N-Guard — Requirement Detail Page (Phase 3)
 *
 * Displays all fields of a single workspace item.
 * Includes a placeholder section for future N-Guard assessments (Phase 7+).
 * Does not implement AI calls.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getDesignRequestById, updateDesignRequest, deleteDesignRequest } from '../api/client.js';
import type { DesignRequest } from '../types/api.js';
import {
  WORK_ITEM_TYPE_LABELS, WORK_ITEM_TYPES,
  WORK_ITEM_PRIORITY_LABELS, WORK_ITEM_PRIORITIES,
} from '../types/api.js';

const STATUS_COLOURS: Record<string, { bg: string; fg: string }> = {
  DRAFT      : { bg: '#f1f5f9', fg: '#64748b' },
  SUBMITTED  : { bg: '#eff6ff', fg: '#1d4ed8' },
  ASSESSING  : { bg: '#fefce8', fg: '#a16207' },
  ASSESSED   : { bg: '#f0fdf4', fg: '#15803d' },
  APPROVED   : { bg: '#f0fdf4', fg: '#15803d' },
  REJECTED   : { bg: '#fef2f2', fg: '#dc2626' },
};

function Badge({ label, style }: { label: string; style?: React.CSSProperties }) {
  return <span style={{ display:'inline-block', fontSize:'0.72rem', fontWeight:600, borderRadius:8, padding:'0.15rem 0.5rem', ...style }}>{label}</span>;
}

function Field({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div style={{ marginBottom:'0.75rem' }}>
      <dt style={{ fontSize:'0.75rem', fontWeight:600, color:'#64748b', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:'0.2rem' }}>{label}</dt>
      <dd style={{ margin:0, fontSize:'0.875rem', color:'#0f172a', whiteSpace:'pre-wrap' }}>{value}</dd>
    </div>
  );
}

interface Props { id: string }

export default function RequirementDetailPage({ id }: Props) {
  const navigate = useNavigate();
  const [item,     setItem]    = useState<DesignRequest | null>(null);
  const [loading,  setLoading] = useState(true);
  const [error,    setError]   = useState<string | null>(null);
  const [editing,  setEditing] = useState(false);
  const [saving,   setSaving]  = useState(false);
  const [editForm, setEditForm] = useState<Partial<DesignRequest>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getDesignRequestById(id);
      setItem(data);
    } catch(e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const startEdit = () => {
    if (!item) return;
    setEditForm({ ...item });
    setEditing(true);
  };

  const saveEdit = async () => {
    if (!item) return;
    setSaving(true);
    try {
      await updateDesignRequest(item.ID, {
        workItemType      : editForm.workItemType,
        title             : editForm.title,
        description       : editForm.description,
        businessObjective : editForm.businessObjective,
        businessProcess   : editForm.businessProcess,
        module            : editForm.module,
        priority          : editForm.priority,
        source            : editForm.source,
        owner             : editForm.owner,
        externalReference : editForm.externalReference,
      });
      await load();
      setEditing(false);
    } catch(e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setSaving(false); }
  };

  const doDelete = async () => {
    if (!item || !confirm(`Delete "${item.title}"?`)) return;
    await deleteDesignRequest(item.ID);
    navigate('/requirements');
  };

  if (loading) return <div style={{ color:'#64748b', padding:'2rem', fontSize:'0.875rem' }}>Loading…</div>;
  if (error)   return <div style={{ color:'#dc2626', padding:'2rem', fontSize:'0.875rem' }}>{error}</div>;
  if (!item)   return <div style={{ color:'#64748b', padding:'2rem' }}>Not found.</div>;

  const sc = STATUS_COLOURS[item.status] ?? STATUS_COLOURS['DRAFT'];
  const tags: string[] = item.tags ? (JSON.parse(item.tags) as string[]) : [];

  if (editing) {
    const ef = editForm;
    const set = (k: keyof DesignRequest) => (v: string) => setEditForm(p => ({ ...p, [k]: v }));
    const lbl = (t: string, req = false) => <span style={{ fontSize:'0.78rem', fontWeight:600, color:'#374151', display:'block', marginBottom:'0.2rem' }}>{t}{req && <span style={{ color:'#dc2626' }}> *</span>}</span>;
    const inp = (label: string, k: keyof DesignRequest, req = false, ph = '') => (
      <label style={{ display:'block', marginBottom:'0.65rem' }}>
        {lbl(label, req)}
        <input value={(ef[k] as string) ?? ''} onChange={e => set(k)(e.target.value)} placeholder={ph}
          style={{ width:'100%', padding:'0.4rem 0.6rem', border:'1px solid #d1d5db', borderRadius:5, fontSize:'0.85rem', boxSizing:'border-box' }} />
      </label>
    );
    const selField = (label: string, k: keyof DesignRequest, opts: [string,string][]) => (
      <label style={{ display:'block', marginBottom:'0.65rem' }}>
        {lbl(label)}
        <select value={(ef[k] as string) ?? ''} onChange={e => set(k)(e.target.value)}
          style={{ width:'100%', padding:'0.4rem 0.6rem', border:'1px solid #d1d5db', borderRadius:5, fontSize:'0.85rem', background:'#fff', boxSizing:'border-box' }}>
          {opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </label>
    );
    return (
      <div style={{ maxWidth:720, padding:'1.5rem' }}>
        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'1.25rem', alignItems:'center' }}>
          <h2 style={{ fontSize:'1.1rem', fontWeight:700, color:'#0f172a', margin:0 }}>Edit Workspace Item</h2>
          <button onClick={() => setEditing(false)} style={{ border:'none', background:'none', color:'#94a3b8', cursor:'pointer', fontSize:'1.1rem' }}>✕</button>
        </div>
        {error && <div style={{ background:'#fef2f2', border:'1px solid #fecaca', borderRadius:6, padding:'0.6rem 0.8rem', marginBottom:'1rem', fontSize:'0.825rem', color:'#991b1b' }}>{error}</div>}
        {selField('Type', 'workItemType', WORK_ITEM_TYPES.map(t => [t, WORK_ITEM_TYPE_LABELS[t]]))}
        {inp('Title', 'title', true)}
        <label style={{ display:'block', marginBottom:'0.65rem' }}>
          {lbl('Description', true)}
          <textarea value={ef.description ?? ''} onChange={e => set('description')(e.target.value)} rows={5}
            style={{ width:'100%', padding:'0.4rem 0.6rem', border:'1px solid #d1d5db', borderRadius:5, fontSize:'0.85rem', boxSizing:'border-box', resize:'vertical' }} />
        </label>
        {inp('Business Objective', 'businessObjective', false, 'Why does this matter?')}
        {inp('Business Process', 'businessProcess', false, 'e.g. Order-to-Cash')}
        {inp('Module', 'module', false, 'e.g. SD, MM, FI')}
        {selField('Priority', 'priority', WORK_ITEM_PRIORITIES.map(p => [p, WORK_ITEM_PRIORITY_LABELS[p]]))}
        {inp('Source', 'source', false, 'e.g. Business workshop')}
        {inp('Owner', 'owner', false, 'Responsible person')}
        {inp('External Reference', 'externalReference', false, 'e.g. ADO-1234')}
        <div style={{ display:'flex', gap:'0.6rem', paddingTop:'0.75rem', borderTop:'1px solid #f1f5f9' }}>
          <button onClick={saveEdit} disabled={saving}
            style={{ padding:'0.4rem 0.9rem', background:'#3b82f6', color:'#fff', border:'none', borderRadius:6, fontSize:'0.85rem', fontWeight:600, cursor:'pointer', opacity:saving?0.7:1 }}>
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button onClick={() => setEditing(false)} style={{ padding:'0.4rem 0.9rem', background:'#f1f5f9', color:'#374151', border:'none', borderRadius:6, fontSize:'0.85rem', cursor:'pointer' }}>Cancel</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth:720 }}>
      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'1.5rem', gap:'0.75rem' }}>
        <div>
          <div style={{ display:'flex', alignItems:'center', gap:'0.5rem', flexWrap:'wrap', marginBottom:'0.4rem' }}>
            <Badge label={WORK_ITEM_TYPE_LABELS[item.workItemType]} style={{ background:'#eff6ff', color:'#1d4ed8', border:'1px solid #bfdbfe' }} />
            <Badge label={item.status} style={{ background:sc.bg, color:sc.fg }} />
            <Badge label={item.priority} style={{ background:'#f8fafc', color:'#64748b', border:'1px solid #e2e8f0' }} />
          </div>
          <h1 style={{ fontSize:'1.2rem', fontWeight:700, color:'#0f172a', margin:0 }}>{item.title}</h1>
        </div>
        <div style={{ display:'flex', gap:'0.4rem', flexShrink:0 }}>
          <button onClick={startEdit}
            style={{ padding:'0.35rem 0.7rem', background:'#f8fafc', border:'1px solid #e2e8f0', borderRadius:5, fontSize:'0.8rem', cursor:'pointer', color:'#374151' }}>
            Edit
          </button>
          <button onClick={doDelete}
            style={{ padding:'0.35rem 0.7rem', background:'#fef2f2', border:'1px solid #fecaca', borderRadius:5, fontSize:'0.8rem', cursor:'pointer', color:'#dc2626' }}>
            Delete
          </button>
        </div>
      </div>

      {/* Main details */}
      <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:8, padding:'1.25rem', marginBottom:'1rem' }}>
        <dl>
          <Field label="Description" value={item.description} />
          <Field label="Business Objective" value={item.businessObjective} />
          <Field label="Business Process" value={item.businessProcess} />
          <Field label="SAP Module" value={item.module} />
          <Field label="Source" value={item.source} />
          <Field label="Owner" value={item.owner} />
          <Field label="Requested By" value={item.requestedBy} />
          <Field label="External Reference" value={item.externalReference} />
        </dl>
        {tags.length > 0 && (
          <div style={{ marginTop:'0.5rem' }}>
            <dt style={{ fontSize:'0.75rem', fontWeight:600, color:'#64748b', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:'0.3rem' }}>Tags</dt>
            <dd style={{ margin:0, display:'flex', gap:'0.3rem', flexWrap:'wrap' }}>
              {tags.map(t => <span key={t} style={{ fontSize:'0.75rem', background:'#f1f5f9', color:'#475569', borderRadius:6, padding:'0.1rem 0.45rem', border:'1px solid #e2e8f0' }}>{t}</span>)}
            </dd>
          </div>
        )}
      </div>

      {/* Assessment placeholder */}
      <div style={{ background:'#fefce8', border:'1px solid #fde047', borderRadius:8, padding:'1rem 1.25rem' }}>
        <h3 style={{ fontSize:'0.9rem', fontWeight:600, color:'#92400e', margin:'0 0 0.4rem' }}>Fit-to-Standard Assessment</h3>
        <p style={{ fontSize:'0.825rem', color:'#78350f', margin:0, lineHeight:1.6 }}>
          No assessment has been run for this item yet.
          Assessment capability will be available in Phase 7 (Fit-to-Standard Assessment Engine).
        </p>
      </div>
    </div>
  );
}
