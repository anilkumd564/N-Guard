/**
 * N-Guard — Project Create/Edit Modal Form (Phase 2)
 */
import React from 'react';
import type { S4Edition, TransformationType, CleanCorePolicy, CreateProjectPayload } from '../types/api.js';
import { S4_EDITION_LABELS, TRANSFORMATION_TYPE_LABELS, CLEAN_CORE_POLICY_LABELS } from '../types/api.js';

export interface ProjectFormState {
  name: string; description: string; edition: S4Edition | '';
  release: string; transformationType: TransformationType | ''; cleanCorePolicy: CleanCorePolicy | '';
  profileName: string; country: string; industry: string;
  processAreasText: string; sourceSystemDescription: string;
}
export const EMPTY_FORM: ProjectFormState = {
  name:'', description:'', edition:'', release:'',
  transformationType:'', cleanCorePolicy:'', profileName:'',
  country:'', industry:'', processAreasText:'', sourceSystemDescription:'',
};

export function formToPayload(f: ProjectFormState): CreateProjectPayload {
  const pa = f.processAreasText.trim()
    ? JSON.stringify(f.processAreasText.split(',').map(s => s.trim()).filter(Boolean))
    : undefined;
  return {
    name: f.name.trim(), description: f.description.trim() || undefined,
    edition: f.edition as S4Edition, release: f.release.trim() || undefined,
    transformationType: (f.transformationType || undefined) as TransformationType | undefined,
    cleanCorePolicy: (f.cleanCorePolicy || undefined) as CleanCorePolicy | undefined,
    profileName: f.profileName.trim() || undefined, country: f.country.trim() || undefined,
    industry: f.industry.trim() || undefined, processAreas: pa,
    sourceSystemDescription: f.sourceSystemDescription.trim() || undefined,
  };
}

interface Props {
  mode: 'create' | 'edit';
  form: ProjectFormState;
  onChange: (f: ProjectFormState) => void;
  onSubmit: () => void;
  onCancel: () => void;
  error: string | null;
  saving: boolean;
}

function F({ label, v, set, req=false, ph='' }: { label:string; v:string; set:(x:string)=>void; req?:boolean; ph?:string }) {
  return (
    <label style={{ display:'block', marginBottom:'0.6rem' }}>
      <span style={{ fontSize:'0.78rem', fontWeight:600, color:'#374151', display:'block', marginBottom:'0.2rem' }}>
        {label}{req && <span style={{ color:'#dc2626' }}> *</span>}
      </span>
      <input value={v} onChange={e => set(e.target.value)} placeholder={ph}
        style={{ width:'100%', padding:'0.4rem 0.6rem', border:'1px solid #d1d5db', borderRadius:5, fontSize:'0.85rem', boxSizing:'border-box' }} />
    </label>
  );
}

function S({ label, v, set, opts, req=false }: { label:string; v:string; set:(x:string)=>void; opts:[string,string][]; req?:boolean }) {
  return (
    <label style={{ display:'block', marginBottom:'0.6rem' }}>
      <span style={{ fontSize:'0.78rem', fontWeight:600, color:'#374151', display:'block', marginBottom:'0.2rem' }}>
        {label}{req && <span style={{ color:'#dc2626' }}> *</span>}
      </span>
      <select value={v} onChange={e => set(e.target.value)}
        style={{ width:'100%', padding:'0.4rem 0.6rem', border:'1px solid #d1d5db', borderRadius:5, fontSize:'0.85rem', background:'#fff', boxSizing:'border-box' }}>
        <option value="">— Select —</option>
        {opts.map(([val,lbl]) => <option key={val} value={val}>{lbl}</option>)}
      </select>
    </label>
  );
}

export function ProjectForm({ mode, form, onChange, onSubmit, onCancel, error, saving }: Props) {
  const set = (k: keyof ProjectFormState) => (v: string) => onChange({ ...form, [k]: v });
  const edOpts: [string,string][] = [
    ['ON_PREMISE', S4_EDITION_LABELS.ON_PREMISE],
    ['CLOUD_PRIVATE', S4_EDITION_LABELS.CLOUD_PRIVATE],
    ['CLOUD_PUBLIC', S4_EDITION_LABELS.CLOUD_PUBLIC],
  ];
  const ttOpts = Object.entries(TRANSFORMATION_TYPE_LABELS) as [string,string][];
  const ccOpts = Object.entries(CLEAN_CORE_POLICY_LABELS) as [string,string][];

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 }}>
      <div style={{ background:'#fff', borderRadius:10, padding:'1.5rem', width:'min(560px,95vw)', maxHeight:'90vh', overflowY:'auto', boxShadow:'0 20px 60px rgba(0,0,0,0.3)' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1.25rem' }}>
          <h2 style={{ fontSize:'1.1rem', fontWeight:700, color:'#0f172a', margin:0 }}>
            {mode === 'create' ? 'New Project' : 'Edit Project'}
          </h2>
          <button onClick={onCancel} style={{ border:'none', background:'none', fontSize:'1.2rem', cursor:'pointer', color:'#94a3b8' }}>x</button>
        </div>

        {error && (
          <div style={{ background:'#fef2f2', border:'1px solid #fecaca', borderRadius:6, padding:'0.6rem 0.8rem', marginBottom:'1rem', fontSize:'0.825rem', color:'#991b1b' }}>
            {error}
          </div>
        )}

        <div style={{ borderBottom:'1px solid #f1f5f9', marginBottom:'1rem', paddingBottom:'0.5rem' }}>
          <h3 style={{ fontSize:'0.8rem', fontWeight:700, color:'#6366f1', textTransform:'uppercase', letterSpacing:'0.05em', margin:'0 0 0.75rem' }}>Project Details</h3>
          {F({ label:'Project Name', v:form.name, set:set('name'), req:true, ph:'e.g. S/4HANA Cloud Migration 2025' })}
          {F({ label:'Description', v:form.description, set:set('description'), ph:'Brief project description' })}
        </div>

        <div style={{ borderBottom:'1px solid #f1f5f9', marginBottom:'1rem', paddingBottom:'0.5rem' }}>
          <h3 style={{ fontSize:'0.8rem', fontWeight:700, color:'#6366f1', textTransform:'uppercase', letterSpacing:'0.05em', margin:'0 0 0.75rem' }}>Primary Deployment (required)</h3>
          <p style={{ fontSize:'0.75rem', color:'#64748b', margin:'0 0 0.75rem' }}>
            Edition must be specified explicitly — no default is applied (architecture rule 2).
          </p>
          {S({ label:'SAP S/4HANA Edition', v:form.edition, set:set('edition'), opts:edOpts, req:true })}
          {F({ label:'Release (optional)', v:form.release, set:set('release'), ph:'e.g. 2024 or 2024FPS01' })}
          {S({ label:'Transformation Type', v:form.transformationType, set:set('transformationType'), opts:ttOpts })}
          {S({ label:'Clean Core Policy', v:form.cleanCorePolicy, set:set('cleanCorePolicy'), opts:ccOpts })}
        </div>

        {mode === 'create' && (
          <div style={{ marginBottom:'1rem' }}>
            <h3 style={{ fontSize:'0.8rem', fontWeight:700, color:'#6366f1', textTransform:'uppercase', letterSpacing:'0.05em', margin:'0 0 0.75rem' }}>Deployment Profile Details (optional)</h3>
            {F({ label:'Profile Name', v:form.profileName, set:set('profileName'), ph:'Defaults to project name' })}
            {F({ label:'Country / Region', v:form.country, set:set('country'), ph:'e.g. US, DE, GLOBAL' })}
            {F({ label:'Industry', v:form.industry, set:set('industry'), ph:'e.g. Manufacturing, Retail' })}
            {F({ label:'Process Areas (comma-separated)', v:form.processAreasText, set:set('processAreasText'), ph:'e.g. Order-to-Cash, Procure-to-Pay' })}
            {F({ label:'Source System Description', v:form.sourceSystemDescription, set:set('sourceSystemDescription'), ph:'e.g. SAP ECC 6.0 EHP8' })}
          </div>
        )}

        <div style={{ display:'flex', justifyContent:'flex-end', gap:'0.6rem', paddingTop:'0.5rem', borderTop:'1px solid #f1f5f9' }}>
          <button onClick={onCancel} disabled={saving}
            style={{ padding:'0.4rem 0.9rem', background:'#f1f5f9', color:'#374151', border:'none', borderRadius:6, fontSize:'0.85rem', cursor:'pointer' }}>
            Cancel
          </button>
          <button onClick={onSubmit} disabled={saving}
            style={{ padding:'0.4rem 0.9rem', background:'#3b82f6', color:'#fff', border:'none', borderRadius:6, fontSize:'0.85rem', fontWeight:600, cursor:'pointer', opacity:saving?0.7:1 }}>
            {saving ? 'Saving…' : (mode === 'create' ? 'Create Project' : 'Save Changes')}
          </button>
        </div>
      </div>
    </div>
  );
}
