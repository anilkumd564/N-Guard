/**
 * N-Guard — Projects Page (Phase 2)
 * Architecture rule 2: Edition is always required; no default is applied.
 */
import React, { useCallback, useState } from 'react';
import { createProject, updateProject, deleteProject, listDeploymentProfiles } from '../api/client.js';
import { useProjectContext } from '../context/ProjectContext.js';
import { ProjectForm, EMPTY_FORM, formToPayload } from '../components/ProjectForm.js';
import type { ProjectFormState } from '../components/ProjectForm.js';
import type { Project, SAPDeploymentProfile, S4Edition } from '../types/api.js';
import { S4_EDITION_LABELS } from '../types/api.js';

const EC: Record<S4Edition, { bg:string; fg:string; bd:string }> = {
  ON_PREMISE    : { bg:'#eff6ff', fg:'#1d4ed8', bd:'#bfdbfe' },
  CLOUD_PRIVATE : { bg:'#f0fdf4', fg:'#15803d', bd:'#bbf7d0' },
  CLOUD_PUBLIC  : { bg:'#fdf4ff', fg:'#7e22ce', bd:'#e9d5ff' },
};

function ProfileList({ profiles }: { profiles: SAPDeploymentProfile[] }) {
  if (!profiles.length) return <p style={{ fontSize:'0.8rem', color:'#94a3b8', margin:'0.5rem 0 0' }}>No deployment profiles found.</p>;
  return (
    <div style={{ marginTop:'0.75rem', paddingTop:'0.75rem', borderTop:'1px solid #e2e8f0' }}>
      <p style={{ fontSize:'0.75rem', fontWeight:600, color:'#64748b', margin:'0 0 0.4rem', textTransform:'uppercase', letterSpacing:'0.05em' }}>Deployment Profiles</p>
      {profiles.map(p => {
        const ec = EC[p.deploymentModel] ?? EC.ON_PREMISE;
        return (
          <div key={p.ID} style={{ display:'flex', alignItems:'center', gap:'0.5rem', padding:'0.3rem 0', borderBottom:'1px solid #f8fafc', flexWrap:'wrap' }}>
            <span style={{ fontSize:'0.72rem', fontWeight:600, background:ec.bg, color:ec.fg, border:`1px solid ${ec.bd}`, borderRadius:8, padding:'0.1rem 0.4rem' }}>{S4_EDITION_LABELS[p.deploymentModel]}</span>
            <span style={{ fontSize:'0.8rem', color:'#374151', fontWeight:500 }}>{p.profileName}</span>
            {p.isPrimary && <span style={{ fontSize:'0.7rem', color:'#6366f1' }}>Primary</span>}
            {p.release && <span style={{ fontSize:'0.72rem', color:'#94a3b8' }}>R{p.release}</span>}
            {p.country && <span style={{ fontSize:'0.72rem', color:'#94a3b8' }}>{p.country}</span>}
            {p.industry && <span style={{ fontSize:'0.72rem', color:'#94a3b8' }}>{p.industry}</span>}
          </div>
        );
      })}
    </div>
  );
}

export default function ProjectsPage() {
  const { projects, selectedProject, loading, error, selectProject, refreshProjects } = useProjectContext();
  const [modal,   setModal]   = useState<'none'|'create'|'edit'>('none');
  const [editing, setEditing] = useState<Project|null>(null);
  const [form,    setForm]    = useState<ProjectFormState>(EMPTY_FORM);
  const [formErr, setFormErr] = useState<string|null>(null);
  const [saving,  setSaving]  = useState(false);
  const [pfMap,   setPfMap]   = useState<Record<string, SAPDeploymentProfile[]>>({});
  const [loadPf,  setLoadPf]  = useState<Record<string, boolean>>({});
  const [delId,   setDelId]   = useState<string|null>(null);

  const openCreate = () => { setForm(EMPTY_FORM); setEditing(null); setFormErr(null); setModal('create'); };
  const openEdit   = (p: Project) => {
    setForm({ name:p.name, description:p.description??'', edition:p.edition, release:p.release??'',
      transformationType:p.transformationType??'', cleanCorePolicy:p.cleanCorePolicy??'',
      profileName:'', country:'', industry:'', processAreasText:'', sourceSystemDescription:'' });
    setEditing(p); setFormErr(null); setModal('edit');
  };
  const close = () => { setModal('none'); setEditing(null); setFormErr(null); };

  const doCreate = useCallback(async () => {
    if (!form.name.trim()) { setFormErr('Project name is required.'); return; }
    if (!form.edition)     { setFormErr('Edition is required — never leave unspecified (architecture rule 2).'); return; }
    setSaving(true);
    try {
      const created = await createProject(formToPayload(form));
      await refreshProjects();
      selectProject(created);
      close();
    } catch(e) { setFormErr(e instanceof Error ? e.message : String(e)); }
    finally { setSaving(false); }
  }, [form, refreshProjects, selectProject]);

  const doEdit = useCallback(async () => {
    if (!editing) return;
    if (!form.name.trim()) { setFormErr('Project name is required.'); return; }
    if (!form.edition)     { setFormErr('Edition is required.'); return; }
    setSaving(true);
    try {
      const p = formToPayload(form);
      await updateProject(editing.ID, { name:p.name, description:p.description, edition:p.edition,
        release:p.release, transformationType:p.transformationType, cleanCorePolicy:p.cleanCorePolicy });
      await refreshProjects();
      close();
    } catch(e) { setFormErr(e instanceof Error ? e.message : String(e)); }
    finally { setSaving(false); }
  }, [editing, form, refreshProjects]);

  const doDelete = useCallback(async (id: string) => {
    try {
      await deleteProject(id);
      if (selectedProject?.ID === id) selectProject(null);
      await refreshProjects();
    } catch(e) { alert(`Delete failed: ${e instanceof Error ? e.message : String(e)}`); }
    finally { setDelId(null); }
  }, [selectedProject, selectProject, refreshProjects]);

  const toggleProfiles = useCallback(async (id: string) => {
    if (pfMap[id]) { const n = {...pfMap}; delete n[id]; setPfMap(n); return; }
    setLoadPf(p => ({...p, [id]:true}));
    try { const r = await listDeploymentProfiles(id); setPfMap(p => ({...p, [id]:r})); }
    catch { /**/ }
    finally { setLoadPf(p => ({...p, [id]:false})); }
  }, [pfMap]);

  return (
    <div style={{ maxWidth:960 }}>
      {/* Modal */}
      {modal !== 'none' && (
        <ProjectForm mode={modal} form={form} onChange={setForm}
          onSubmit={modal==='create' ? doCreate : doEdit}
          onCancel={close} error={formErr} saving={saving} />
      )}

      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1.5rem' }}>
        <div>
          <h1 style={{ fontSize:'1.4rem', fontWeight:700, color:'#0f172a', margin:0 }}>Projects</h1>
          <p style={{ fontSize:'0.875rem', color:'#64748b', marginTop:'0.2rem' }}>Manage SAP implementation projects and deployment profiles.</p>
        </div>
        <button onClick={openCreate}
          style={{ padding:'0.45rem 1rem', background:'#3b82f6', color:'#fff', border:'none', borderRadius:6, fontSize:'0.875rem', fontWeight:600, cursor:'pointer' }}>
          + New Project
        </button>
      </div>

      {/* Error banner */}
      {error && (
        <div style={{ background:'#fef2f2', border:'1px solid #fecaca', borderRadius:6, padding:'0.75rem 1rem', marginBottom:'1rem', fontSize:'0.875rem', color:'#991b1b', display:'flex', justifyContent:'space-between' }}>
          <span>{error}</span>
          <button onClick={() => refreshProjects()} style={{ color:'#3b82f6', border:'none', background:'none', cursor:'pointer', fontSize:'0.8rem' }}>Retry</button>
        </div>
      )}

      {loading && <div style={{ color:'#64748b', padding:'2rem 0', fontSize:'0.875rem' }}>Loading projects…</div>}

      {!loading && !error && projects.length === 0 && (
        <div style={{ textAlign:'center', padding:'3rem', border:'1px dashed #cbd5e1', borderRadius:8, background:'#f8fafc' }}>
          <div style={{ fontSize:'2.5rem' }}>📁</div>
          <h2 style={{ fontSize:'1rem', fontWeight:600, color:'#0f172a' }}>No projects yet</h2>
          <p style={{ fontSize:'0.875rem', color:'#64748b' }}>Create your first project to start governing design requests.</p>
          <button onClick={openCreate}
            style={{ marginTop:'1rem', padding:'0.45rem 1rem', background:'#3b82f6', color:'#fff', border:'none', borderRadius:6, fontSize:'0.875rem', fontWeight:600, cursor:'pointer' }}>
            + New Project
          </button>
        </div>
      )}

      {/* Project list */}
      {!loading && projects.map(project => {
        const isSel = selectedProject?.ID === project.ID;
        const ec    = EC[project.edition] ?? EC.ON_PREMISE;
        const pfs   = pfMap[project.ID];
        const lpf   = loadPf[project.ID];

        return (
          <div key={project.ID} style={{ background:isSel?'#eff6ff':'#fff', border:isSel?'2px solid #3b82f6':'1px solid #e2e8f0', borderRadius:8, padding:'1rem 1.25rem', marginBottom:'0.75rem' }}>

            {/* Project header row */}
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:'0.75rem' }}>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:'flex', alignItems:'center', gap:'0.5rem', flexWrap:'wrap' }}>
                  <span style={{ fontSize:'1rem', fontWeight:600, color:'#0f172a' }}>{project.name}</span>
                  {isSel && <span style={{ fontSize:'0.7rem', fontWeight:700, background:'#3b82f6', color:'#fff', borderRadius:10, padding:'0.1rem 0.5rem' }}>Active</span>}
                  <span style={{ fontSize:'0.72rem', fontWeight:600, background:ec.bg, color:ec.fg, border:`1px solid ${ec.bd}`, borderRadius:10, padding:'0.1rem 0.55rem' }}>
                    {S4_EDITION_LABELS[project.edition]}
                  </span>
                  {project.release && (
                    <span style={{ fontSize:'0.72rem', color:'#64748b', background:'#f1f5f9', border:'1px solid #e2e8f0', borderRadius:10, padding:'0.1rem 0.5rem' }}>
                      R {project.release}
                    </span>
                  )}
                  {project.transformationType && (
                    <span style={{ fontSize:'0.72rem', color:'#64748b' }}>{project.transformationType}</span>
                  )}
                  {project.cleanCorePolicy && project.cleanCorePolicy !== 'NOT_SET' && (
                    <span style={{ fontSize:'0.72rem', color:'#64748b' }}>Clean Core: {project.cleanCorePolicy}</span>
                  )}
                </div>
                {project.description && (
                  <p style={{ fontSize:'0.8rem', color:'#475569', margin:'0.3rem 0 0' }}>{project.description}</p>
                )}
              </div>

              {/* Action buttons */}
              <div style={{ display:'flex', gap:'0.35rem', flexShrink:0 }}>
                {!isSel && (
                  <button onClick={() => selectProject(project)}
                    style={{ padding:'0.3rem 0.7rem', background:'#f0fdf4', color:'#15803d', border:'1px solid #bbf7d0', borderRadius:5, fontSize:'0.78rem', fontWeight:600, cursor:'pointer' }}>
                    Select
                  </button>
                )}
                <button onClick={() => toggleProfiles(project.ID)}
                  style={{ padding:'0.3rem 0.6rem', background:'#f8fafc', border:'1px solid #e2e8f0', borderRadius:5, fontSize:'0.78rem', cursor:'pointer', color:'#64748b' }}>
                  {lpf ? '…' : (pfs ? 'Hide profiles' : 'Profiles')}
                </button>
                <button onClick={() => openEdit(project)}
                  style={{ padding:'0.3rem 0.6rem', background:'#f8fafc', border:'1px solid #e2e8f0', borderRadius:5, fontSize:'0.78rem', cursor:'pointer', color:'#374151' }}>
                  Edit
                </button>
                <button onClick={() => setDelId(project.ID)}
                  style={{ padding:'0.3rem 0.6rem', background:'#fef2f2', border:'1px solid #fecaca', borderRadius:5, fontSize:'0.78rem', cursor:'pointer', color:'#dc2626' }}>
                  Delete
                </button>
              </div>
            </div>

            {/* Profiles panel */}
            {pfs && <ProfileList profiles={pfs} />}

            {/* Delete confirmation */}
            {delId === project.ID && (
              <div style={{ marginTop:'0.75rem', padding:'0.75rem', background:'#fef2f2', borderRadius:6, border:'1px solid #fecaca' }}>
                <p style={{ fontSize:'0.875rem', color:'#7f1d1d', margin:'0 0 0.5rem' }}>
                  Delete <strong>{project.name}</strong>? This cannot be undone.
                </p>
                <div style={{ display:'flex', gap:'0.5rem' }}>
                  <button onClick={() => doDelete(project.ID)}
                    style={{ padding:'0.35rem 0.8rem', background:'#dc2626', color:'#fff', border:'none', borderRadius:5, fontSize:'0.8rem', fontWeight:600, cursor:'pointer' }}>
                    Confirm Delete
                  </button>
                  <button onClick={() => setDelId(null)}
                    style={{ padding:'0.35rem 0.8rem', background:'#f1f5f9', color:'#374151', border:'none', borderRadius:5, fontSize:'0.8rem', cursor:'pointer' }}>
                    Cancel
                  </button>
                </div>
              </div>
            )}

          </div>
        );
      })}
    </div>
  );
}
