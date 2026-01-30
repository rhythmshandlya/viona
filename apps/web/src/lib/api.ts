const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export interface CreateProjectResponse {
  projectId: string;
  uploadUrl: string;
}

export interface ProcessProjectResponse {
  jobId: string;
  transcribeJobId: string;
  enhanceJobId: string;
}

export interface Project {
  id: string;
  status: string;
  videoKey: string | null;
  outputKey: string | null;
  durationMs: number | null;
  fps: number;
  width: number;
  height: number;
  createdAt: string;
  updatedAt: string;
  tracks: Track[];
  items: TimelineItem[];
  transcript: Transcript | null;
}

export interface Track {
  id: string;
  projectId: string;
  type: string;
  name: string;
  position: number;
  locked: boolean;
  visible: boolean;
}

export interface TimelineItem {
  id: string;
  trackId: string;
  type: string;
  startMs: number;
  endMs: number;
  data: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface Transcript {
  id: string;
  projectId: string;
  words: TranscriptWord[];
  rawOutput: Record<string, unknown>;
  createdAt: string;
}

export interface TranscriptWord {
  text: string;
  startMs: number;
  endMs: number;
  confidence: number;
}

export interface JobMetrics {
  inputTokens?: number;
  outputTokens?: number;
  estimatedCostUsd?: number;
  durationMs?: number;
  llmModel?: string;
  filesWritten?: number;
  screenshotsTaken?: number;
}

export interface Job {
  id: string;
  projectId: string;
  type: string;
  status: string;
  progress: number;
  error: string | null;
  metrics?: JobMetrics | null;
  logs?: string[] | null;
  createdAt: string;
  completedAt: string | null;
}

export interface DownloadResponse {
  url: string;
  expiresAt: string;
}

export interface SeparateAudioResponse {
  jobId: string;
  trackId: string;
  itemId: string;
}

export type StylePreset = 'minimal' | 'modern' | 'playful' | 'bold' | 'classic';

export type VisualsLayoutMode = 'pip' | 'split-horizontal' | 'split-vertical';

export interface VisualsDimensions {
  width: number;
  height: number;
}

export interface GenerateVisualsOptions {
  stylePreset: StylePreset;
  layoutMode: VisualsLayoutMode;
  dimensions: VisualsDimensions;
}

export interface GenerateVisualsResponse {
  jobId: string;
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || `Request failed: ${response.status}`);
    }

    return response.json();
  }

  // Projects
  async createProject(filename: string): Promise<CreateProjectResponse> {
    return this.request('/api/projects', {
      method: 'POST',
      body: JSON.stringify({ filename }),
    });
  }

  async getProject(projectId: string): Promise<Project> {
    return this.request(`/api/projects/${projectId}`);
  }

  async processProject(projectId: string): Promise<ProcessProjectResponse> {
    return this.request(`/api/projects/${projectId}/process`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
  }

  async updateProject(
    projectId: string,
    updates: { title?: string; tracks?: Partial<Track>[]; items?: Partial<TimelineItem>[] }
  ): Promise<{ success: boolean }> {
    return this.request(`/api/projects/${projectId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  }

  async renderProject(projectId: string): Promise<ProcessProjectResponse> {
    return this.request(`/api/projects/${projectId}/render`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
  }

  async separateAudio(projectId: string, videoItemId: string): Promise<SeparateAudioResponse> {
    return this.request(`/api/projects/${projectId}/separate-audio`, {
      method: 'POST',
      body: JSON.stringify({ videoItemId }),
    });
  }

  async generateVisuals(projectId: string, options: GenerateVisualsOptions): Promise<GenerateVisualsResponse> {
    return this.request(`/api/projects/${projectId}/generate-visuals`, {
      method: 'POST',
      body: JSON.stringify(options),
    });
  }

  async getDownloadUrl(projectId: string): Promise<DownloadResponse> {
    return this.request(`/api/projects/${projectId}/download`);
  }

  async deleteVisuals(projectId: string): Promise<{ message: string; deleted: number }> {
    return this.request(`/api/projects/${projectId}/visuals`, {
      method: 'DELETE',
    });
  }

  // Jobs
  async getJob(jobId: string): Promise<Job> {
    return this.request(`/api/jobs/${jobId}`);
  }

  async cancelJob(jobId: string): Promise<{ success: boolean }> {
    return this.request(`/api/jobs/${jobId}/cancel`, {
      method: 'POST',
    });
  }

  // Upload helper
  async uploadToPresignedUrl(
    uploadUrl: string,
    file: File,
    onProgress?: (progress: number) => void
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable && onProgress) {
          const progress = Math.round((event.loaded / event.total) * 100);
          onProgress(progress);
        }
      });

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve();
        } else {
          reject(new Error(`Upload failed: ${xhr.status}`));
        }
      });

      xhr.addEventListener('error', () => {
        reject(new Error('Upload failed'));
      });

      xhr.open('PUT', uploadUrl);
      xhr.setRequestHeader('Content-Type', file.type || 'video/mp4');
      xhr.send(file);
    });
  }
}

export const api = new ApiClient(API_URL);
