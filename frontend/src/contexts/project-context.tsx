'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export interface Project {
  id: string;
  name: string;
  appUrl: string;
  source: 'url' | 'github' | 'gitlab' | 'upload' | 'android' | 'ios';
  connectedAt: string;
  // Mobile-specific properties
  deviceId?: string;
  packageName?: string;
  bundleId?: string;
}

interface ProjectContextType {
  currentProject: Project | null;
  setCurrentProject: (project: Project | null) => void;
  clearProject: () => void;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export function ProjectProvider({ children }: { children: ReactNode }) {
  const [currentProject, setCurrentProject] = useState<Project | null>(null);

  // Load project from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('autotest-current-project');
    if (stored) {
      try {
        setCurrentProject(JSON.parse(stored));
      } catch (e) {
        localStorage.removeItem('autotest-current-project');
      }
    }
  }, []);

  // Save project to localStorage when it changes
  useEffect(() => {
    if (currentProject) {
      localStorage.setItem('autotest-current-project', JSON.stringify(currentProject));
    } else {
      localStorage.removeItem('autotest-current-project');
    }
  }, [currentProject]);

  const clearProject = () => {
    setCurrentProject(null);
    localStorage.removeItem('autotest-current-project');
  };

  return (
    <ProjectContext.Provider value={{ currentProject, setCurrentProject, clearProject }}>
      {children}
    </ProjectContext.Provider>
  );
}

export function useProject() {
  const context = useContext(ProjectContext);
  if (context === undefined) {
    throw new Error('useProject must be used within a ProjectProvider');
  }
  return context;
}
