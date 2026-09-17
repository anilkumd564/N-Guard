/**
 * N-Guard — Knowledge Base Page (Phase 4)
 *
 * Admin UI for:
 *  - Managing knowledge sources (create, delete)
 *  - Uploading documents with full metadata
 *  - Inspecting ingestion status, extracted text, and chunks
 *  - Viewing ingestion errors
 *
 * Architecture rule 2: Edition is optional on knowledge documents
 * (null = applies to all editions). When set, it must be valid.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  listKnowledgeSources, createKnowledgeSource, deleteKnowledgeSource,
  listKnowledgeDocuments, deleteKnowledgeDocument, ingestDocument,
  listKnowledgeChunks, listIngestionJobs,
} from '../api/client.js';
import { useProjectContext } from '../context/ProjectContext.js';
import type {
  KnowledgeSource, KnowledgeDocument, KnowledgeChunk,
  IngestionJob, KnowledgeSourceType, AuthorityLevel,
} from '../types/api.js';
import { KNOWLEDGE_SOURCE_TYPE_LABELS, AUTHORITY_LEVEL_LABELS, S4_EDITION_LABELS } from '../types/api.js';

const STATUS_COLOURS: Record<string, string> = {
  PENDING:'#94a3b8', PROCESSING:'#a16207', COMPLETED:'#15803d',
  FAILED:'#dc2626', SKIPPED:'#64748b',
};
const AUTH_OPTS: [string,string][] = Object.entries(AUTHORITY_LEVEL_LABELS) as [string,string][];
const SRC_TYPE_OPTS: [string,string][] = Object.entries(KNOWLEDGE_SOURCE_TYPE_LABELS) as [string,string][];
const DOC_TYPE_OPTS: [string,string][] = [
  ['SAP_BEST_PRACTICE','SAP Best Practice'],['RELEASE_NOTE','Release Note'],
  ['CUSTOMIZING_GUIDE','Customizing Guide'],['EXTENSIBILITY_GUIDE','Extensibility Guide'],
  ['FIT_GAP_ANALYSIS','Fit-Gap Analysis'],['ARCHITECTURE_DECISION','Architecture Decision'],
  ['OTHER','Other'],
];
const EDITION_OPTS: [string,string][] = [
  ['','All Editions (global)'],
  ...Object.entries(S4_EDITION_LABELS) as [string,string][],
];

export default function KnowledgePage() {
  const { selectedProject } = useProjectContext();
  const [sources,       setSources]       = useState<KnowledgeSource[]>([]);
  const [loading,       setLoading]       = useState(false);
  const [error,         setError]         = useState<string|null>(null);
  const [selectedSrc,   setSelectedSrc]   = useState<KnowledgeSource|null>(null);
  const [docs,          setDocs]          = useState<KnowledgeDocument[]>([]);
  const [docsLoading,   setDocsLoading]   = useState(false);
  const [jobs,          setJobs]          = useState<IngestionJob[]>([]);
  const [chunks,        setChunks]        = useState<KnowledgeChunk[]>([]);
  const [chunksDocId,   setChunksDocId]   = useState<string|null>(null);
  const [showNewSrc,    setShowNewSrc]    = useState(false);
  const [showIngest,    setShowIngest]    = useState(false);
  const [srcForm,       setSrcForm]       = useState({ name:'', description:'', sourceType:'FILE_UPLOAD', authorityLevel:'INTERNAL', baseUrl:'' });
  const [ingestForm,    setIngestForm]    = useState({ title:'', edition:'', release:'', country:'', industry:'', processArea:'', scopeItem:'', authorityLevel:'', docType:'OTHER', language:'EN' });
  const [ingestFile,    setIngestFile]    = useState<File|null>(null);
  const [saving,        setSaving]        = useState(false);
  const [ingesting,     setIngesting]     = useState(false);
  const [delSrcId,      setDelSrcId]      = useState<string|null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const loadSources = useCallback(async () => {
    setLoading(true); setError(null);
    try { setSources(await listKnowledgeSources(selectedProject?.ID)); }
    catch(e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setLoading(false); }
  }, [selectedProject]);

  useEffect(() => { loadSources(); }, [loadSources]);

  const selectSource = useCallback(async (src: KnowledgeSource) => {
    setSelectedSrc(src); setChunks([]); setChunksDocId(null);
    setDocsLoading(true);
    try {
      const [d, j] = await Promise.all([
        listKnowledgeDocuments(src.ID),
        listIngestionJobs(src.ID),
      ]);
      setDocs(d); setJobs(j);
    } catch(e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setDocsLoading(false); }
  }, []);

  const doCreateSource = async () => {
    if (!srcForm.name.trim()) { setError('Source name is required.'); return; }
    setSaving(true);
    try {
      await createKnowledgeSource({ ...srcForm, projectId: selectedProject?.ID });
      setShowNewSrc(false);
      setSrcForm({ name:'', description:'', sourceType:'FILE_UPLOAD', authorityLevel:'INTERNAL', baseUrl:'' });
      await loadSources();
    } catch(e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setSaving(false); }
  };

  const doDeleteSource = async (id: string) => {
    try { await deleteKnowledgeSource(id); if (selectedSrc?.ID === id) setSelectedSrc(null); await loadSources(); }
    catch(e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setDelSrcId(null); }
  };

  const doIngest = async () => {
    if (!selectedSrc || !ingestFile || !ingestForm.title.trim()) { setError('Title and file are required.'); return; }
    setIngesting(true);
    try {
      await ingestDocument({ knowledgeSourceId: selectedSrc.ID, file: ingestFile, ...ingestForm });
      setShowIngest(false);
      setIngestFile(null);
      setIngestForm({ title:'', edition:'', release:'', country:'', industry:'', processArea:'', scopeItem:'', authorityLevel:'', docType:'OTHER', language:'EN' });
      await selectSource(selectedSrc);
    } catch(e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setIngesting(false); }
  };

  const showChunks = async (docId: string) => {
    if (chunksDocId === docId) { setChunks([]); setChunksDocId(null); return; }
    try { const c = await listKnowledgeChunks(docId); setChunks(c); setChunksDocId(docId); }
    catch(e) { setError(e instanceof Error ? e.message : String(e)); }
  };

  const lbl = (t: string) => <span style={{ fontSize:'0.78rem', fontWeight:600, color:'#374151', display:'block', marginBottom:'0.2rem' }}>{t}</span>;
  const fld = (k: string, v: string, set: (x:string)=>void, ph='') => (
    <label style={{ display:'block', marginBottom:'0.65rem' }}>
      {lbl(k)}
      <input value={v} onChange={e=>set(e.target.value)} placeholder={ph}
        style={{ width:'100%', padding:'0.4rem 0.6rem', border:'1px solid #d1d5db', borderRadius:5, fontSize:'0.85rem', boxSizing:'border-box' }} />
    </label>
  );
  const slct = (k: string, v: string, set: (x:string)=>void, opts: [string,string][]) => (
    <label style={{ display:'block', marginBottom:'0.65rem' }}>
      {lbl(k)}
      <select value={v} onChange={e=>set(e.target.value)}
        style={{ width:'100%', padding:'0.4rem 0.6rem', border:'1px solid #d1d5db', borderRadius:5, fontSize:'0.85rem', background:'#fff', boxSizing:'border-box' }}>
        {opts.map(([val,lab])=><option key={val} value={val}>{lab}</option>)}
      </select>
    </label>
  );

  return (
    <div style={{ maxWidth:1100 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1.5rem' }}>
        <div>
          <h1 style={{ fontSize:'1.4rem', fontWeight:700, color:'#0f172a', margin:0 }}>Knowledge Base</h1>
          <p style={{ fontSize:'0.8rem', color:'#64748b', marginTop:'0.2rem' }}>Manage knowledge sources and ingest documents for evidence-backed assessments.</p>
        </div>
        <button onClick={()=>setShowNewSrc(v=>!v)}
          style={{ padding:'0.4rem 0.9rem', background:'#3b82f6', color:'#fff', border:'none', borderRadius:6, fontSize:'0.8rem', fontWeight:600, cursor:'pointer' }}>
          {showNewSrc ? 'Cancel' : '+ New Source'}
        </button>
      </div>

      {error && (
        <div style={{ background:'#fef2f2', border:'1px solid #fecaca', borderRadius:6, padding:'0.6rem 1rem', marginBottom:'1rem', fontSize:'0.875rem', color:'#991b1b', display:'flex', justifyContent:'space-between' }}>
          <span>{error}</span>
          <button onClick={()=>setError(null)} style={{ border:'none', background:'none', color:'#991b1b', cursor:'pointer', fontWeight:700 }}>✕</button>
        </div>
      )}

      {/* New source form */}
      {showNewSrc && (
        <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:8, padding:'1.25rem', marginBottom:'1rem' }}>
          <h2 style={{ fontSize:'0.95rem', fontWeight:700, color:'#0f172a', margin:'0 0 1rem' }}>New Knowledge Source</h2>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0.65rem' }}>
            {fld('Name *', srcForm.name, v=>setSrcForm(p=>({...p,name:v})), 'e.g. SAP Help Portal S/4HANA 2024')}
            {fld('Base URL', srcForm.baseUrl, v=>setSrcForm(p=>({...p,baseUrl:v})), 'https://help.sap.com/...')}
            {slct('Source Type', srcForm.sourceType, v=>setSrcForm(p=>({...p,sourceType:v})), SRC_TYPE_OPTS)}
            {slct('Authority Level', srcForm.authorityLevel, v=>setSrcForm(p=>({...p,authorityLevel:v})), AUTH_OPTS)}
          </div>
          {fld('Description', srcForm.description, v=>setSrcForm(p=>({...p,description:v})), 'Optional description')}
          <div style={{ display:'flex', justifyContent:'flex-end', gap:'0.5rem' }}>
            <button onClick={()=>setShowNewSrc(false)} style={{ padding:'0.4rem 0.8rem', background:'#f1f5f9', color:'#374151', border:'none', borderRadius:6, fontSize:'0.85rem', cursor:'pointer' }}>Cancel</button>
            <button onClick={doCreateSource} disabled={saving} style={{ padding:'0.4rem 0.9rem', background:'#3b82f6', color:'#fff', border:'none', borderRadius:6, fontSize:'0.85rem', fontWeight:600, cursor:'pointer', opacity:saving?0.7:1 }}>{saving?'Saving…':'Create'}</button>
          </div>
        </div>
      )}

      <div style={{ display:'grid', gridTemplateColumns:'280px 1fr', gap:'1rem', alignItems:'start' }}>
        {/* Sources list */}
        <div>
          {loading && <div style={{ color:'#64748b', fontSize:'0.875rem', padding:'1rem 0' }}>Loading…</div>}
          {!loading && sources.length === 0 && (
            <div style={{ textAlign:'center', padding:'2rem', border:'1px dashed #cbd5e1', borderRadius:8, background:'#f8fafc', fontSize:'0.875rem', color:'#64748b' }}>
              No knowledge sources.<br/>Create one to start ingesting documents.
            </div>
          )}
          {sources.map(src => (
            <div key={src.ID}
              style={{ background: selectedSrc?.ID===src.ID?'#eff6ff':'#fff', border: selectedSrc?.ID===src.ID?'2px solid #3b82f6':'1px solid #e2e8f0', borderRadius:8, padding:'0.75rem', marginBottom:'0.5rem', cursor:'pointer' }}
              onClick={()=>selectSource(src)}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:'0.875rem', fontWeight:600, color:'#0f172a' }}>{src.name}</div>
                  <div style={{ fontSize:'0.72rem', color:'#64748b', marginTop:'0.15rem' }}>{KNOWLEDGE_SOURCE_TYPE_LABELS[src.sourceType as KnowledgeSourceType]}</div>
                  <div style={{ fontSize:'0.72rem', color:'#94a3b8', marginTop:'0.1rem' }}>{AUTHORITY_LEVEL_LABELS[src.authorityLevel as AuthorityLevel]}</div>
                </div>
                <button onClick={e=>{e.stopPropagation();setDelSrcId(src.ID);}}
                  style={{ padding:'0.2rem 0.45rem', background:'#fef2f2', border:'1px solid #fecaca', borderRadius:4, fontSize:'0.72rem', cursor:'pointer', color:'#dc2626', flexShrink:0 }}>
                  Delete
                </button>
              </div>
              {delSrcId === src.ID && (
                <div style={{ marginTop:'0.5rem', padding:'0.5rem', background:'#fef2f2', borderRadius:5, fontSize:'0.75rem' }}>
                  <div style={{ color:'#7f1d1d', marginBottom:'0.35rem' }}>Delete this source and all its documents?</div>
                  <div style={{ display:'flex', gap:'0.4rem' }}>
                    <button onClick={e=>{e.stopPropagation();doDeleteSource(src.ID);}} style={{ padding:'0.25rem 0.6rem', background:'#dc2626', color:'#fff', border:'none', borderRadius:4, fontSize:'0.75rem', cursor:'pointer' }}>Confirm</button>
                    <button onClick={e=>{e.stopPropagation();setDelSrcId(null);}} style={{ padding:'0.25rem 0.6rem', background:'#f1f5f9', color:'#374151', border:'none', borderRadius:4, fontSize:'0.75rem', cursor:'pointer' }}>Cancel</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Documents panel */}
        {selectedSrc ? (
          <div>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'0.75rem' }}>
              <h2 style={{ fontSize:'1rem', fontWeight:700, color:'#0f172a', margin:0 }}>{selectedSrc.name}</h2>
              <button onClick={()=>setShowIngest(v=>!v)}
                style={{ padding:'0.35rem 0.75rem', background:'#3b82f6', color:'#fff', border:'none', borderRadius:6, fontSize:'0.8rem', fontWeight:600, cursor:'pointer' }}>
                {showIngest ? 'Cancel' : '+ Ingest Document'}
              </button>
            </div>

            {/* Ingest form */}
            {showIngest && (
              <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:8, padding:'1.25rem', marginBottom:'1rem' }}>
                <h3 style={{ fontSize:'0.9rem', fontWeight:700, color:'#0f172a', margin:'0 0 1rem' }}>Ingest Document</h3>
                <p style={{ fontSize:'0.75rem', color:'#64748b', margin:'0 0 1rem' }}>
                  Supported: TXT, MD, CSV, JSON. PDF and DOCX extraction stubs installed — install pdf-parse / mammoth to enable.
                </p>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0.65rem' }}>
                  {fld('Title *', ingestForm.title, v=>setIngestForm(p=>({...p,title:v})), 'Document title')}
                  {slct('Document Type', ingestForm.docType, v=>setIngestForm(p=>({...p,docType:v})), DOC_TYPE_OPTS)}
                  {slct('Edition (optional)', ingestForm.edition, v=>setIngestForm(p=>({...p,edition:v})), EDITION_OPTS)}
                  {fld('Release', ingestForm.release, v=>setIngestForm(p=>({...p,release:v})), 'e.g. 2024')}
                  {fld('Country', ingestForm.country, v=>setIngestForm(p=>({...p,country:v})), 'e.g. US, DE, GLOBAL')}
                  {fld('Industry', ingestForm.industry, v=>setIngestForm(p=>({...p,industry:v})), 'e.g. Manufacturing')}
                  {fld('Process Area', ingestForm.processArea, v=>setIngestForm(p=>({...p,processArea:v})), 'e.g. Order-to-Cash')}
                  {fld('Scope Item', ingestForm.scopeItem, v=>setIngestForm(p=>({...p,scopeItem:v})), 'e.g. BH1')}
                </div>
                <label style={{ display:'block', marginBottom:'0.75rem' }}>
                  <span style={{ fontSize:'0.78rem', fontWeight:600, color:'#374151', display:'block', marginBottom:'0.3rem' }}>File *</span>
                  <div style={{ display:'flex', alignItems:'center', gap:'0.75rem' }}>
                    <button onClick={()=>fileRef.current?.click()} style={{ padding:'0.35rem 0.75rem', background:'#f1f5f9', border:'1px solid #d1d5db', borderRadius:5, fontSize:'0.8rem', cursor:'pointer', color:'#374151' }}>
                      {ingestFile ? ingestFile.name : 'Choose file…'}
                    </button>
                    {ingestFile && <span style={{ fontSize:'0.75rem', color:'#64748b' }}>{(ingestFile.size / 1024).toFixed(1)} KB</span>}
                  </div>
                  <input ref={fileRef} type="file" style={{ display:'none' }} onChange={e=>setIngestFile(e.target.files?.[0] ?? null)} />
                </label>
                <div style={{ display:'flex', justifyContent:'flex-end', gap:'0.5rem' }}>
                  <button onClick={()=>setShowIngest(false)} style={{ padding:'0.4rem 0.8rem', background:'#f1f5f9', color:'#374151', border:'none', borderRadius:6, fontSize:'0.85rem', cursor:'pointer' }}>Cancel</button>
                  <button onClick={doIngest} disabled={ingesting || !ingestFile || !ingestForm.title.trim()}
                    style={{ padding:'0.4rem 0.9rem', background:'#3b82f6', color:'#fff', border:'none', borderRadius:6, fontSize:'0.85rem', fontWeight:600, cursor:'pointer', opacity:(ingesting||!ingestFile||!ingestForm.title.trim())?0.6:1 }}>
                    {ingesting ? 'Ingesting…' : 'Ingest'}
                  </button>
                </div>
              </div>
            )}

            {docsLoading && <div style={{ color:'#64748b', fontSize:'0.875rem', padding:'1rem 0' }}>Loading documents…</div>}

            {!docsLoading && docs.length === 0 && (
              <div style={{ textAlign:'center', padding:'2rem', border:'1px dashed #cbd5e1', borderRadius:8, background:'#f8fafc', fontSize:'0.875rem', color:'#64748b' }}>
                No documents ingested yet. Click "+ Ingest Document" to add one.
              </div>
            )}

            {docs.map(doc => {
              const job = jobs.find(j => j.document_ID === doc.ID);
              const statusCol = STATUS_COLOURS[doc.ingestionStatus] ?? '#94a3b8';
              return (
                <div key={doc.ID} style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:8, padding:'1rem', marginBottom:'0.75rem' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:'0.5rem' }}>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:'0.5rem', flexWrap:'wrap' }}>
                        <span style={{ fontSize:'0.875rem', fontWeight:600, color:'#0f172a' }}>{doc.title}</span>
                        <span style={{ fontSize:'0.72rem', fontWeight:600, color: statusCol }}>{doc.ingestionStatus}</span>
                        {doc.chunkCount > 0 && <span style={{ fontSize:'0.72rem', color:'#64748b' }}>{doc.chunkCount} chunks</span>}
                        {doc.mimeType && <span style={{ fontSize:'0.72rem', color:'#94a3b8' }}>{doc.mimeType}</span>}
                      </div>
                      <div style={{ display:'flex', gap:'0.75rem', marginTop:'0.3rem', flexWrap:'wrap' }}>
                        {doc.edition && <span style={{ fontSize:'0.72rem', color:'#64748b' }}>{doc.edition}</span>}
                        {doc.processArea && <span style={{ fontSize:'0.72rem', color:'#64748b' }}>{doc.processArea}</span>}
                        {doc.country && <span style={{ fontSize:'0.72rem', color:'#94a3b8' }}>{doc.country}</span>}
                      </div>
                      {doc.ingestionError && (
                        <div style={{ marginTop:'0.3rem', padding:'0.4rem 0.6rem', background:'#fef2f2', borderRadius:4, fontSize:'0.75rem', color:'#991b1b' }}>
                          Error: {doc.ingestionError}
                        </div>
                      )}
                      {job && job.extractedLength != null && (
                        <div style={{ fontSize:'0.72rem', color:'#64748b', marginTop:'0.2rem' }}>
                          {job.extractedLength.toLocaleString()} chars extracted
                          {job.completedAt && ` · ${new Date(job.completedAt).toLocaleString()}`}
                        </div>
                      )}
                    </div>
                    <div style={{ display:'flex', gap:'0.35rem', flexShrink:0 }}>
                      {doc.chunkCount > 0 && (
                        <button onClick={()=>showChunks(doc.ID)}
                          style={{ padding:'0.25rem 0.55rem', background:'#f1f5f9', border:'1px solid #e2e8f0', borderRadius:4, fontSize:'0.72rem', cursor:'pointer', color:'#374151' }}>
                          {chunksDocId === doc.ID ? 'Hide chunks' : 'View chunks'}
                        </button>
                      )}
                      <button onClick={async ()=>{ await deleteKnowledgeDocument(doc.ID); await selectSource(selectedSrc!); }}
                        style={{ padding:'0.25rem 0.55rem', background:'#fef2f2', border:'1px solid #fecaca', borderRadius:4, fontSize:'0.72rem', cursor:'pointer', color:'#dc2626' }}>
                        Delete
                      </button>
                    </div>
                  </div>

                  {/* Chunks */}
                  {chunksDocId === doc.ID && chunks.length > 0 && (
                    <div style={{ marginTop:'0.75rem', borderTop:'1px solid #f1f5f9', paddingTop:'0.75rem' }}>
                      <p style={{ fontSize:'0.75rem', fontWeight:600, color:'#6366f1', margin:'0 0 0.5rem', textTransform:'uppercase', letterSpacing:'0.04em' }}>
                        {chunks.length} Chunks
                      </p>
                      {chunks.slice(0, 5).map(c => (
                        <div key={c.ID} style={{ marginBottom:'0.5rem', padding:'0.5rem 0.75rem', background:'#f8fafc', borderRadius:5, border:'1px solid #f1f5f9' }}>
                          <div style={{ fontSize:'0.72rem', color:'#6366f1', fontWeight:600, marginBottom:'0.2rem' }}>
                            Chunk {c.sequence} · {c.tokenCount ?? '?'} words
                          </div>
                          <div style={{ fontSize:'0.78rem', color:'#374151', lineHeight:1.5, maxHeight:'3.5rem', overflow:'hidden', textOverflow:'ellipsis' }}>
                            {c.text}
                          </div>
                        </div>
                      ))}
                      {chunks.length > 5 && (
                        <div style={{ fontSize:'0.75rem', color:'#64748b', textAlign:'center', padding:'0.25rem' }}>
                          … and {chunks.length - 5} more chunks
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'200px', background:'#f8fafc', borderRadius:8, border:'1px dashed #cbd5e1' }}>
            <p style={{ color:'#94a3b8', fontSize:'0.875rem' }}>Select a knowledge source to view its documents.</p>
          </div>
        )}
      </div>
    </div>
  );
}
