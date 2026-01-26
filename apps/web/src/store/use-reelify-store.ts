import { create } from "zustand";
import { api, Project } from "@/lib/api";
import { projectToDesignComboFormat, designComboToProjectUpdates } from "@/lib/project-converter";

interface ReelifyStore {
  // Project data
  project: Project | null;
  projectId: string | null;
  isLoading: boolean;
  error: string | null;

  // Video URL (presigned from MinIO)
  videoUrl: string | null;

  // DesignCombo format data
  designComboData: ReturnType<typeof projectToDesignComboFormat> | null;

  // Actions
  loadProject: (projectId: string) => Promise<void>;
  saveProject: () => Promise<void>;
  setDesignComboData: (data: ReturnType<typeof projectToDesignComboFormat>) => void;
  reset: () => void;

  // Render/Export
  isRendering: boolean;
  renderProgress: number;
  renderJobId: string | null;
  startRender: () => Promise<void>;
  setRenderProgress: (progress: number) => void;
  setRenderComplete: () => void;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export const useReelifyStore = create<ReelifyStore>((set, get) => ({
  // Initial state
  project: null,
  projectId: null,
  isLoading: false,
  error: null,
  videoUrl: null,
  designComboData: null,
  isRendering: false,
  renderProgress: 0,
  renderJobId: null,

  loadProject: async (projectId: string) => {
    set({ isLoading: true, error: null, projectId });

    try {
      // Load project from API
      const project = await api.getProject(projectId);
      console.log('[ReelifyStore] Project loaded:', {
        id: project.id,
        status: project.status,
        itemCount: project.items?.length,
        items: project.items?.map((i: any) => ({ type: i.type, startMs: i.startMs })),
      });

      // Construct video URL (MinIO presigned URL via API proxy or direct)
      // For local dev, we'll construct a direct MinIO URL
      const videoUrl = project.videoKey
        ? `${API_URL}/api/projects/${projectId}/video`
        : null;

      // If no video URL from API, we need to get a presigned URL
      // For now, we'll use a direct MinIO URL pattern
      const actualVideoUrl = videoUrl ||
        `http://localhost:9000/uploads/${project.videoKey}`;

      // Convert to DesignCombo format
      const designComboData = projectToDesignComboFormat(project, actualVideoUrl);

      set({
        project,
        videoUrl: actualVideoUrl,
        designComboData,
        isLoading: false,
      });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : "Failed to load project",
        isLoading: false,
      });
    }
  },

  saveProject: async () => {
    const { project, designComboData, projectId } = get();

    if (!project || !designComboData || !projectId) {
      return;
    }

    try {
      // Convert DesignCombo changes back to our format
      const updates = designComboToProjectUpdates(designComboData, project);

      // Save to API
      await api.updateProject(projectId, updates);

      // Reload project to get fresh data
      const updatedProject = await api.getProject(projectId);
      set({ project: updatedProject });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Failed to save project" });
    }
  },

  setDesignComboData: (data) => {
    set({ designComboData: data });
  },

  reset: () => {
    set({
      project: null,
      projectId: null,
      isLoading: false,
      error: null,
      videoUrl: null,
      designComboData: null,
      isRendering: false,
      renderProgress: 0,
      renderJobId: null,
    });
  },

  startRender: async () => {
    const { projectId } = get();

    if (!projectId) {
      return;
    }

    set({ isRendering: true, renderProgress: 0 });

    try {
      const { jobId } = await api.renderProject(projectId);
      set({ renderJobId: jobId });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : "Failed to start render",
        isRendering: false,
      });
    }
  },

  setRenderProgress: (progress: number) => {
    set({ renderProgress: progress });
  },

  setRenderComplete: () => {
    set({ isRendering: false, renderProgress: 100 });
  },
}));
