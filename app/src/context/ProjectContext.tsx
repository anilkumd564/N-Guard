/**
 * N-Guard — Project Context (Phase 2)
 *
 * Provides the currently selected project and project list to the entire
 * React application.  The selected project is persisted to localStorage
 * so it survives page refreshes.
 *
 * Architecture rules:
 *  - Rule 10: All future operations use the selected project's tenant_ID
 *             and ID for scoping.
 *  - No edition default is applied — the project carries its explicit edition.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { listProjects } from '../api/client.js';
import type { Project } from '../types/api.js';

// ─── Context Shape ────────────────────────────────────────────────────────────

export interface ProjectContextValue {
  /** All projects visible to the current user. */
  projects        : Project[];
  /** The project the user has selected as the active workspace. */
  selectedProject : Project | null;
  /** True while the project list is loading. */
  loading         : boolean;
  /** Error message from the last failed load. */
  error           : string | null;
  /** Select a project (or clear by passing null). */
  selectProject   : (project: Project | null) => void;
  /** Reload the project list from the backend. */
  refreshProjects : () => Promise<void>;
}

const STORAGE_KEY = 'nguard.selectedProjectId';

// ─── Context ──────────────────────────────────────────────────────────────────

const ProjectContext = createContext<ProjectContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function ProjectProvider({ children }: { children: React.ReactNode }) {
  const [projects,        setProjects]        = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [loading,         setLoading]         = useState(true);
  const [error,           setError]           = useState<string | null>(null);

  const refreshProjects = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listProjects();
      setProjects(data);

      // Restore previously selected project from localStorage
      const storedId = localStorage.getItem(STORAGE_KEY);
      if (storedId) {
        const match = data.find(p => p.ID === storedId);
        if (match) {
          setSelectedProject(match);
        } else {
          // Stored project no longer exists — clear it
          localStorage.removeItem(STORAGE_KEY);
          setSelectedProject(null);
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshProjects();
  }, [refreshProjects]);

  const selectProject = useCallback((project: Project | null) => {
    setSelectedProject(project);
    if (project) {
      localStorage.setItem(STORAGE_KEY, project.ID);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  return (
    <ProjectContext.Provider
      value={{
        projects,
        selectedProject,
        loading,
        error,
        selectProject,
        refreshProjects,
      }}
    >
      {children}
    </ProjectContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * useProjectContext — access the project context from any component.
 * Throws if called outside of ProjectProvider.
 */
export function useProjectContext(): ProjectContextValue {
  const ctx = useContext(ProjectContext);
  if (!ctx) {
    throw new Error('useProjectContext must be used inside <ProjectProvider>');
  }
  return ctx;
}
