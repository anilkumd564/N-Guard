/**
 * N-Guard — Requirements Page (Phase 3)
 *
 * Full workspace UI: list, filter, search, create, bulk select,
 * CSV import (with row-level error display), CSV export, and detail navigation.
 * Architecture rule 10: all operations use the active project context.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  listDesignRequests, createDesignRequest,
  importRequirements, exportRequirements,
} from '../api/client.js';
import { useProjectContext } from '../context/ProjectContext.js';
import type { DesignRequest, WorkItemType, WorkItemPriority, CsvImportRowError } from '../types/api.js';
import {
  WORK_ITEM_TYPE_LABELS, WORK_ITEM_TYPES,
  WORK_ITEM_PRIORITY_LABELS, WORK_ITEM_PRIORITIES,
} from '../types/api.js';

// ── Priority badge colours ────────────────────────────────────────────────────
const PRI_COL: Record<WorkItemPriority, string> = {
  CRITICAL: '#dc2626', HIGH: '#ea580c', MEDIUM: '#0284c7', LOW: '#64748b',
};
const STATUS_COL: Record<string, string> = {
  DRAFT:'#94a3b8', SUBMITTED:'#1d4ed8', ASSESSING:'#a16207',
  ASSESSED:'#15803d', APPROVED:'#15803d', REJECTED:'#dc2626',
};

// ── CSV header template ───────────────────────────────────────────────────────
const CSV_TEMPLATE = 'workItemType,title,description,businessObjective,businessProcess,module,priority,source,owner,tags,externalReference\nREQUIREMENT,Example requirement,Detailed description here,Business value,Order-to-Cash,SD,HIGH,Workshop,Jane Doe,SD|Finance,ADO-1234';

interface CreateForm {
  workItemType: WorkItemType; title: string; description: string;
  businessObjective: string; businessProcess: string; module: string;
  priority: WorkItemPriority; source: string; owner: string;
  externalReference: string;
}
const INIT: CreateForm = {
  workItemType:'REQUIREMENT', title:'', description:'',
  businessObjective:'', businessProcess:'', module:'',
  priority:'MEDIUM', source:'', owner:'', externalReference:'',
};

export default function RequirementsPage() {
  const { selectedProject } = useProjectContext();
  const navigate = useNavigate();

  const [items,       setItems]       = useState<DesignRequest[]>([]);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState<string|null>(null);
  const [search,      setSearch]      = useState('');
  const [filterType,  setFilterType]  = useState<WorkItemType|''>('');
  const [filterPri,   setFilterPri]   = useState<WorkItemPriority|''>('');
  const [filterStatus,setFilterStatus]= useState('');
  const [selected,    setSelected]    = useState<Set<string>>(new Set());
  const [showCreate,  setShowCreate]  = useState(false);
  const [form,        setForm]        = useState<CreateForm>(INIT);
  const [saving,      setSaving]      = useState(false);
  const [csvModal,    setCsvModal]    = useState<'import'|'none'>('none');
  const [csvText,     setCsvText]     = useState('');
  const [csvResult,   setCsvResult]   = useState<{ imported:number; errors: CsvImportRowError[] }|null>(null);
  const [importing,   setImporting]   = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    if (!selectedProject) { setItems([]); return; }
    setLoading(true); setError(null);
    try { setItems(await listDesignRequests(selectedProject.ID)); }
    catch(e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setLoading(false); }
  }, [selectedProject]);

  useEffect(() => { load(); }, [load]);

  // ── Filtered items ─────────────────────────────────────────────────────────
  const filtered = items.filter(i => {
    if (filterType   && i.workItemType !== filterType) return false;
    if (filterPri    && i.priority !== filterPri)      return false;
    if (filterStatus && i.status !== filterStatus)     return false;
    if (search) {
      const q = search.toLowerCase();
      return i.title.toLowerCase().includes(q)
        || i.description.toLowerCase().includes(q)
        || (i.businessProcess ?? '').toLowerCase().includes(q)
        || (i.module ?? '').toLowerCase().includes(q)
        || (i.owner ?? '').toLowerCase().includes(q)
        || (i.externalReference ?? '').toLowerCase().includes(q);
    }
    return true;
  });

  // ── Selection ──────────────────────────────────────────────────────────────
  const allSelected = filtered.length > 0 && filtered.every(i => selected.has(i.ID));
  const toggleAll   = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(filtered.map(i => i.ID)));
  };
  const toggleOne = (id: string) => {
    const s = new Set(selected);
    if (s.has(id)) { s.delete(id); } else { s.add(id); }
    setSelected(s);
  };

  // ── Create ─────────────────────────────────────────────────────────────────
  const f = (k: keyof CreateForm) => (v: string) => setForm(p => ({ ...p, [k]: v }));
  const doCreate = async () => {
    if (!selectedProject || !form.title.trim() || !form.description.trim()) return;
    setSaving(true);
    try {
      const tenantId = selectedProject.tenant_ID ?? 'default';
      await createDesignRequest({
        project_ID       : selectedProject.ID,
        tenant_ID        : tenantId,
        workItemType     : form.workItemType,
        title            : form.title.trim(),
        description      : form.description.trim(),
        businessObjective: form.businessObjective.trim() || undefined,
        businessProcess  : form.businessProcess.trim() || undefined,
        module           : form.module.trim() || undefined,
        priority         : form.priority,
        source           : form.source.trim() || undefined,
        owner            : form.owner.trim() || undefined,
        externalReference: form.externalReference.trim() || undefined,
      });
      setForm(INIT); setShowCreate(false);
      await load();
    } catch(e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setSaving(false); }
  };

  // ── CSV import ─────────────────────────────────────────────────────────────
  const doImport = async () => {
    if (!selectedProject || !csvText.trim()) return;
    setImporting(true); setCsvResult(null);
    try {
      const res = await importRequirements(selectedProject.ID, csvText);
      const errors: CsvImportRowError[] = res.errors ? JSON.parse(res.errors) as CsvImportRowError[] : [];
      setCsvResult({ imported: res.imported, errors });
      if (res.imported > 0) await load();
    } catch(e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setImporting(false); }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setCsvText(ev.target?.result as string ?? '');
    reader.readAsText(file);
  };

  // ── CSV export ─────────────────────────────────────────────────────────────
  const doExport = async (type?: WorkItemType) => {
    if (!selectedProject) return;
    try {
      const csv = await exportRequirements(selectedProject.ID, type);
      const blob = new Blob([csv], { type: 'text/csv' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `requirements-${selectedProject.name.replace(/\s+/g,'-')}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch(e) { setError(e instanceof Error ? e.message : String(e)); }
  };

  const sel = (lbl: string, val: string, onChange: (v:string)=>void, opts: [string,string][], placeholder='All') => (
    <select value={val} onChange={e=>onChange(e.target.value)}
      style={{ padding:'0.35rem 0.55rem', border:'1px solid #d1d5db', borderRadius:5, fontSize:'0.8rem', background:'#fff', color:'#374151' }}>
      <option value="">{placeholder}</option>
      {opts.map(([v,l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  );

  // ── No project selected ────────────────────────────────────────────────────
  if (!selectedProject) {
    return (
      <div style={{ maxWidth:640 }}>
        <h1 style={{ fontSize:'1.4rem', fontWeight:700, color:'#0f172a', marginBottom:'1rem' }}>Requirements</h1>
        <div style={{ background:'#fefce8', border:'1px solid #fde047', borderRadius:8, padding:'1rem 1.25rem', fontSize:'0.875rem', color:'#713f12' }}>
          <strong>No active project selected.</strong>
          <p style={{ margin:'0.4rem 0 0', lineHeight:1.6 }}>
            Navigate to <strong>Projects</strong> and select a project to manage its requirements.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth:1100 }}>
      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1.25rem', flexWrap:'wrap', gap:'0.75rem' }}>
        <div>
          <h1 style={{ fontSize:'1.4rem', fontWeight:700, color:'#0f172a', margin:0 }}>Requirements</h1>
          <p style={{ fontSize:'0.8rem', color:'#64748b', marginTop:'0.2rem' }}>
            Project: <strong>{selectedProject.name}</strong> · {items.length} items
          </p>
        </div>
        <div style={{ display:'flex', gap:'0.4rem', flexWrap:'wrap' }}>
          <button onClick={() => setCsvModal('import')} style={{ padding:'0.4rem 0.8rem', background:'#f8fafc', border:'1px solid #e2e8f0', borderRadius:6, fontSize:'0.8rem', cursor:'pointer', color:'#374151' }}>
            Import CSV
          </button>
          <button onClick={() => doExport()} style={{ padding:'0.4rem 0.8rem', background:'#f8fafc', border:'1px solid #e2e8f0', borderRadius:6, fontSize:'0.8rem', cursor:'pointer', color:'#374151' }}>
            Export CSV
          </button>
          <button onClick={() => { setShowCreate(v => !v); setForm(INIT); }}
            style={{ padding:'0.4rem 0.9rem', background:'#3b82f6', color:'#fff', border:'none', borderRadius:6, fontSize:'0.8rem', fontWeight:600, cursor:'pointer' }}>
            {showCreate ? 'Cancel' : '+ New Item'}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div style={{ background:'#fef2f2', border:'1px solid #fecaca', borderRadius:6, padding:'0.6rem 1rem', marginBottom:'1rem', fontSize:'0.875rem', color:'#991b1b', display:'flex', justifyContent:'space-between' }}>
          <span>{error}</span>
          <button onClick={()=>setError(null)} style={{ border:'none', background:'none', color:'#991b1b', cursor:'pointer', fontWeight:700 }}>✕</button>
        </div>
      )}

      {/* Create form */}
      {showCreate && (
        <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:8, padding:'1.25rem', marginBottom:'1rem' }}>
          <h2 style={{ fontSize:'0.95rem', fontWeight:700, color:'#0f172a', margin:'0 0 1rem' }}>New Workspace Item</h2>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0.65rem' }}>
            {[['Type','workItemType',WORK_ITEM_TYPES.map(t=>[t,WORK_ITEM_TYPE_LABELS[t]]),'sel'],
              ['Priority','priority',WORK_ITEM_PRIORITIES.map(p=>[p,WORK_ITEM_PRIORITY_LABELS[p]]),'sel'],
              ['Business Process','businessProcess',[],'inp','e.g. Order-to-Cash'],
              ['Module','module',[],'inp','e.g. SD, MM'],
              ['Source','source',[],'inp','Workshop, migration analysis…'],
              ['Owner','owner',[],'inp','Responsible person'],
              ['External Reference','externalReference',[],'inp','e.g. ADO-1234'],
            ].map(([label, key, opts, type, ph]) => (
              <label key={key as string} style={{ display:'block' }}>
                <span style={{ fontSize:'0.78rem', fontWeight:600, color:'#374151', display:'block', marginBottom:'0.2rem' }}>{label as string}</span>
                {type === 'sel'
                  ? <select value={form[key as keyof CreateForm]} onChange={e=>f(key as keyof CreateForm)(e.target.value)}
                      style={{ width:'100%', padding:'0.4rem 0.6rem', border:'1px solid #d1d5db', borderRadius:5, fontSize:'0.85rem', background:'#fff', boxSizing:'border-box' }}>
                      {(opts as [string,string][]).map(([v,l])=><option key={v} value={v}>{l}</option>)}
                    </select>
                  : <input value={form[key as keyof CreateForm]} onChange={e=>f(key as keyof CreateForm)(e.target.value)} placeholder={ph as string}
                      style={{ width:'100%', padding:'0.4rem 0.6rem', border:'1px solid #d1d5db', borderRadius:5, fontSize:'0.85rem', boxSizing:'border-box' }} />
                }
              </label>
            ))}
          </div>
          <label style={{ display:'block', margin:'0.65rem 0' }}>
            <span style={{ fontSize:'0.78rem', fontWeight:600, color:'#374151', display:'block', marginBottom:'0.2rem' }}>
              Title <span style={{ color:'#dc2626' }}>*</span>
            </span>
            <input value={form.title} onChange={e=>f('title')(e.target.value)} placeholder="Brief title for this item"
              style={{ width:'100%', padding:'0.4rem 0.6rem', border:'1px solid #d1d5db', borderRadius:5, fontSize:'0.85rem', boxSizing:'border-box' }} />
          </label>
          <label style={{ display:'block', margin:'0.65rem 0' }}>
            <span style={{ fontSize:'0.78rem', fontWeight:600, color:'#374151', display:'block', marginBottom:'0.2rem' }}>
              Description <span style={{ color:'#dc2626' }}>*</span>
            </span>
            <textarea value={form.description} onChange={e=>f('description')(e.target.value)} rows={4}
              placeholder="Detailed description of this requirement, story, or change"
              style={{ width:'100%', padding:'0.4rem 0.6rem', border:'1px solid #d1d5db', borderRadius:5, fontSize:'0.85rem', boxSizing:'border-box', resize:'vertical' }} />
          </label>
          <label style={{ display:'block', margin:'0.65rem 0' }}>
            <span style={{ fontSize:'0.78rem', fontWeight:600, color:'#374151', display:'block', marginBottom:'0.2rem' }}>Business Objective</span>
            <input value={form.businessObjective} onChange={e=>f('businessObjective')(e.target.value)} placeholder="Why does this matter?"
              style={{ width:'100%', padding:'0.4rem 0.6rem', border:'1px solid #d1d5db', borderRadius:5, fontSize:'0.85rem', boxSizing:'border-box' }} />
          </label>
          <div style={{ display:'flex', justifyContent:'flex-end', gap:'0.5rem', marginTop:'1rem' }}>
            <button onClick={()=>{setShowCreate(false);setForm(INIT);}}
              style={{ padding:'0.4rem 0.8rem', background:'#f1f5f9', color:'#374151', border:'none', borderRadius:6, fontSize:'0.85rem', cursor:'pointer' }}>
              Cancel
            </button>
            <button onClick={doCreate} disabled={saving || !form.title.trim() || !form.description.trim()}
              style={{ padding:'0.4rem 0.9rem', background:'#3b82f6', color:'#fff', border:'none', borderRadius:6, fontSize:'0.85rem', fontWeight:600, cursor:'pointer', opacity:(saving||!form.title.trim()||!form.description.trim())?0.6:1 }}>
              {saving ? 'Saving…' : 'Create'}
            </button>
          </div>
        </div>
      )}

      {/* Filters + search */}
      <div style={{ display:'flex', gap:'0.5rem', marginBottom:'0.75rem', flexWrap:'wrap', alignItems:'center' }}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search title, description, owner…"
          style={{ flex:'1', minWidth:'200px', padding:'0.35rem 0.6rem', border:'1px solid #d1d5db', borderRadius:5, fontSize:'0.8rem' }} />
        {sel('Type',    filterType,    (v) => setFilterType(v as WorkItemType|''),    WORK_ITEM_TYPES.map(t=>[t,WORK_ITEM_TYPE_LABELS[t]]))}
        {sel('Priority',filterPri,     (v) => setFilterPri(v as WorkItemPriority|''), WORK_ITEM_PRIORITIES.map(p=>[p,WORK_ITEM_PRIORITY_LABELS[p]]))}
        {sel('Status',  filterStatus,  setFilterStatus,  [['DRAFT','Draft'],['SUBMITTED','Submitted'],['ASSESSING','Assessing'],['ASSESSED','Assessed'],['APPROVED','Approved'],['REJECTED','Rejected']])}
        {(filterType || filterPri || filterStatus || search) && (
          <button onClick={()=>{setSearch('');setFilterType('');setFilterPri('');setFilterStatus('');}}
            style={{ padding:'0.35rem 0.6rem', background:'#f1f5f9', border:'1px solid #e2e8f0', borderRadius:5, fontSize:'0.78rem', cursor:'pointer', color:'#64748b' }}>
            Clear
          </button>
        )}
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div style={{ background:'#eff6ff', border:'1px solid #bfdbfe', borderRadius:6, padding:'0.5rem 0.8rem', marginBottom:'0.75rem', display:'flex', alignItems:'center', gap:'0.75rem', fontSize:'0.8rem' }}>
          <span style={{ color:'#1d4ed8', fontWeight:600 }}>{selected.size} selected</span>
          <button onClick={()=>setSelected(new Set())} style={{ color:'#64748b', border:'none', background:'none', cursor:'pointer', fontSize:'0.8rem' }}>Clear selection</button>
        </div>
      )}

      {/* Loading */}
      {loading && <div style={{ color:'#64748b', fontSize:'0.875rem', padding:'2rem 0' }}>Loading…</div>}

      {/* Empty state */}
      {!loading && filtered.length === 0 && (
        <div style={{ textAlign:'center', padding:'3rem', border:'1px dashed #cbd5e1', borderRadius:8, background:'#f8fafc' }}>
          <div style={{ fontSize:'2.5rem' }}>📋</div>
          <h2 style={{ fontSize:'1rem', fontWeight:600, color:'#0f172a' }}>
            {items.length === 0 ? 'No workspace items yet' : 'No items match your filters'}
          </h2>
          <p style={{ fontSize:'0.875rem', color:'#64748b' }}>
            {items.length === 0
              ? 'Click "+ New Item" or import a CSV to get started.'
              : 'Try clearing filters or adjusting the search term.'}
          </p>
        </div>
      )}

      {/* List */}
      {!loading && filtered.length > 0 && (
        <div style={{ border:'1px solid #e2e8f0', borderRadius:8, overflow:'hidden', background:'#fff' }}>
          {/* Table header */}
          <div style={{ display:'grid', gridTemplateColumns:'36px 1fr 110px 80px 90px 100px', gap:'0.5rem', padding:'0.5rem 0.75rem', background:'#f8fafc', borderBottom:'1px solid #e2e8f0', fontSize:'0.75rem', fontWeight:600, color:'#64748b', textTransform:'uppercase', letterSpacing:'0.04em', alignItems:'center' }}>
            <input type="checkbox" checked={allSelected} onChange={toggleAll} style={{ cursor:'pointer' }} />
            <span>Title / Description</span>
            <span>Type</span>
            <span>Priority</span>
            <span>Status</span>
            <span>Reference</span>
          </div>
          {filtered.map(item => (
            <div key={item.ID}
              style={{ display:'grid', gridTemplateColumns:'36px 1fr 110px 80px 90px 100px', gap:'0.5rem', padding:'0.65rem 0.75rem', borderBottom:'1px solid #f1f5f9', alignItems:'start', cursor:'pointer', background: selected.has(item.ID) ? '#eff6ff' : '#fff' }}
              onClick={() => navigate(`/requirements/${item.ID}`)}>
              <input type="checkbox" checked={selected.has(item.ID)} onClick={e=>e.stopPropagation()} onChange={()=>toggleOne(item.ID)} style={{ cursor:'pointer', marginTop:'0.1rem' }} />
              <div>
                <div style={{ fontSize:'0.875rem', fontWeight:600, color:'#0f172a' }}>{item.title}</div>
                <div style={{ fontSize:'0.78rem', color:'#64748b', marginTop:'0.15rem', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:'400px' }}>{item.description}</div>
                {(item.businessProcess || item.module) && (
                  <div style={{ fontSize:'0.72rem', color:'#94a3b8', marginTop:'0.15rem' }}>
                    {[item.businessProcess, item.module].filter(Boolean).join(' · ')}
                  </div>
                )}
              </div>
              <span style={{ fontSize:'0.72rem', fontWeight:600, background:'#eff6ff', color:'#1d4ed8', borderRadius:6, padding:'0.15rem 0.45rem', alignSelf:'center' }}>
                {WORK_ITEM_TYPE_LABELS[item.workItemType]}
              </span>
              <span style={{ fontSize:'0.75rem', fontWeight:600, color: PRI_COL[item.priority] ?? '#64748b', alignSelf:'center' }}>
                {item.priority}
              </span>
              <span style={{ fontSize:'0.75rem', fontWeight:500, color: STATUS_COL[item.status] ?? '#64748b', alignSelf:'center' }}>
                {item.status}
              </span>
              <span style={{ fontSize:'0.72rem', color:'#94a3b8', alignSelf:'center', overflow:'hidden', textOverflow:'ellipsis' }}>
                {item.externalReference ?? '—'}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* CSV Import Modal */}
      {csvModal === 'import' && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 }}>
          <div style={{ background:'#fff', borderRadius:10, padding:'1.5rem', width:'min(640px,95vw)', maxHeight:'90vh', overflowY:'auto', boxShadow:'0 20px 60px rgba(0,0,0,0.3)' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1rem' }}>
              <h2 style={{ fontSize:'1rem', fontWeight:700, color:'#0f172a', margin:0 }}>Import Requirements CSV</h2>
              <button onClick={()=>{setCsvModal('none');setCsvResult(null);setCsvText('');}} style={{ border:'none', background:'none', color:'#94a3b8', cursor:'pointer', fontSize:'1.2rem' }}>✕</button>
            </div>
            <p style={{ fontSize:'0.8rem', color:'#64748b', margin:'0 0 0.75rem' }}>
              Required columns: <code>workItemType</code>, <code>title</code>, <code>description</code>.<br/>
              Optional: <code>businessObjective</code>, <code>businessProcess</code>, <code>module</code>, <code>priority</code>, <code>source</code>, <code>owner</code>, <code>tags</code> (pipe-separated), <code>externalReference</code>.
            </p>
            <div style={{ display:'flex', gap:'0.5rem', marginBottom:'0.75rem' }}>
              <button onClick={()=>setCsvText(CSV_TEMPLATE)} style={{ padding:'0.35rem 0.7rem', background:'#f1f5f9', border:'1px solid #e2e8f0', borderRadius:5, fontSize:'0.78rem', cursor:'pointer', color:'#374151' }}>Load Example</button>
              <button onClick={()=>fileRef.current?.click()} style={{ padding:'0.35rem 0.7rem', background:'#f1f5f9', border:'1px solid #e2e8f0', borderRadius:5, fontSize:'0.78rem', cursor:'pointer', color:'#374151' }}>Upload File</button>
              <input ref={fileRef} type="file" accept=".csv,.txt" style={{ display:'none' }} onChange={handleFileUpload} />
            </div>
            <textarea value={csvText} onChange={e=>setCsvText(e.target.value)} rows={10}
              placeholder="Paste CSV content here or upload a file…"
              style={{ width:'100%', padding:'0.5rem', border:'1px solid #d1d5db', borderRadius:5, fontSize:'0.78rem', fontFamily:'monospace', boxSizing:'border-box', resize:'vertical' }} />
            {csvResult && (
              <div style={{ margin:'0.75rem 0', padding:'0.75rem', background: csvResult.errors.length ? '#fef2f2' : '#f0fdf4', borderRadius:6, border:`1px solid ${csvResult.errors.length ? '#fecaca' : '#bbf7d0'}` }}>
                <p style={{ margin:'0 0 0.3rem', fontSize:'0.825rem', fontWeight:600, color: csvResult.errors.length ? '#991b1b' : '#15803d' }}>
                  Imported: {csvResult.imported} rows · Errors: {csvResult.errors.length}
                </p>
                {csvResult.errors.slice(0,10).map((e,i) => (
                  <div key={i} style={{ fontSize:'0.75rem', color:'#991b1b' }}>Row {e.row} / {e.field}: {e.message}</div>
                ))}
                {csvResult.errors.length > 10 && <div style={{ fontSize:'0.75rem', color:'#64748b' }}>…and {csvResult.errors.length - 10} more errors</div>}
              </div>
            )}
            <div style={{ display:'flex', justifyContent:'flex-end', gap:'0.5rem', marginTop:'0.75rem' }}>
              <button onClick={()=>{setCsvModal('none');setCsvResult(null);setCsvText('');}} style={{ padding:'0.4rem 0.8rem', background:'#f1f5f9', color:'#374151', border:'none', borderRadius:6, fontSize:'0.85rem', cursor:'pointer' }}>Close</button>
              <button onClick={doImport} disabled={importing || !csvText.trim()}
                style={{ padding:'0.4rem 0.9rem', background:'#3b82f6', color:'#fff', border:'none', borderRadius:6, fontSize:'0.85rem', fontWeight:600, cursor:'pointer', opacity:(importing||!csvText.trim())?0.6:1 }}>
                {importing ? 'Importing…' : 'Import'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
