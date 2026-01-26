import { create } from 'zustand';
import type { Project, TestCase, Scenario, Step } from '@/lib/api';

interface ProjectState {
  currentProject: Project | null;
  projects: Project[];
  testCases: TestCase[];
  currentScenario: Scenario | null;
  activeStepId: string | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  setCurrentProject: (project: Project | null) => void;
  setProjects: (projects: Project[]) => void;
  setTestCases: (testCases: TestCase[]) => void;
  setCurrentScenario: (scenario: Scenario | null) => void;
  setActiveStepId: (stepId: string | null) => void;
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;

  // Scenario builder actions
  addStep: (step: Step) => void;
  updateStep: (stepId: string, updates: Partial<Step>) => void;
  removeStep: (stepId: string) => void;
  reorderSteps: (fromIndex: number, toIndex: number) => void;

  // Reset
  reset: () => void;
}

const initialState = {
  currentProject: null,
  projects: [],
  testCases: [],
  currentScenario: null,
  activeStepId: null,
  isLoading: false,
  error: null,
};

export const useProjectStore = create<ProjectState>((set, get) => ({
  ...initialState,

  setCurrentProject: (project) => set({ currentProject: project }),

  setProjects: (projects) => set({ projects }),

  setTestCases: (testCases) => set({ testCases }),

  setCurrentScenario: (scenario) => set({ currentScenario: scenario }),

  setActiveStepId: (stepId) => set({ activeStepId: stepId }),

  setLoading: (isLoading) => set({ isLoading }),

  setError: (error) => set({ error }),

  addStep: (step) => {
    const { currentScenario } = get();
    if (!currentScenario) return;

    set({
      currentScenario: {
        ...currentScenario,
        steps: [...currentScenario.steps, step],
      },
    });
  },

  updateStep: (stepId, updates) => {
    const { currentScenario } = get();
    if (!currentScenario) return;

    set({
      currentScenario: {
        ...currentScenario,
        steps: currentScenario.steps.map((step) =>
          step.id === stepId ? { ...step, ...updates } : step
        ),
      },
    });
  },

  removeStep: (stepId) => {
    const { currentScenario, activeStepId } = get();
    if (!currentScenario) return;

    const newSteps = currentScenario.steps.filter((step) => step.id !== stepId);
    set({
      currentScenario: {
        ...currentScenario,
        steps: newSteps,
      },
      activeStepId: activeStepId === stepId ? null : activeStepId,
    });
  },

  reorderSteps: (fromIndex, toIndex) => {
    const { currentScenario } = get();
    if (!currentScenario) return;

    const steps = [...currentScenario.steps];
    const [removed] = steps.splice(fromIndex, 1);
    steps.splice(toIndex, 0, removed);

    set({
      currentScenario: {
        ...currentScenario,
        steps,
      },
    });
  },

  reset: () => set(initialState),
}));
