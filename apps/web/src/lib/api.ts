const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

// Helper to get session token from cookies
function getSessionToken(): string | null {
  if (typeof document === 'undefined') return null;

  const cookies = document.cookie.split(';').reduce((acc, cookie) => {
    const [key, value] = cookie.trim().split('=');
    acc[key] = value;
    return acc;
  }, {} as Record<string, string>);

  // Prefer JWT for faster validation
  return cookies['stytch_session_jwt'] || cookies['stytch_session_token'] || null;
}

export interface CreateProjectResponse {
  projectId: string;
  uploadUrl: string;
  videoKey: string;
}

export interface ProcessProjectResponse {
  jobId: string;
  transcribeJobId: string;
  enhanceJobId: string;
}

export interface Project {
  id: string;
  title: string | null;
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
  progressMessage: string | null;
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
  styleGuide?: string;
}

export interface GenerateVisualsResponse {
  jobId: string;
}

export interface EditVisualsResponse {
  jobId: string;
}

export interface EditVisualsContext {
  type: 'element' | 'item' | 'scene' | 'composition';
  sceneId?: number | null;
  elementName?: string;
  itemId?: string;
  itemType?: string;
}

export interface SceneElement {
  name: string;
  type: string;
  description?: string;
  position: {
    x: string;  // e.g., "10%", "center"
    y: string;
  };
  size: {
    width: string;  // e.g., "30%", "auto"
    height: string;
  };
}

export interface SceneInfo {
  id: number;
  name: string;
  startMs: number;
  endMs: number;
  description: string;
  elements?: SceneElement[];
  contentDisplayMs?: number;
}

export interface ScenesResponse {
  scenes: SceneInfo[];
  compositionId: string;
}

export interface ExtractedAsset {
  id: string;
  name: string;
  type: 'component' | 'element' | 'text' | 'shape' | 'icon' | 'background';
  sceneId: number;
  sceneName: string;
  description: string;
  position?: { x: string; y: string };
  size?: { width: string; height: string };
}

export interface AssetsResponse {
  assets: ExtractedAsset[];
  compositionId: string | null;
  extractedAt?: string;
}

export interface UploadImageResponse {
  imageKey: string;
}

export type AnimationType = 'draw' | 'motion';
export type AnimationStyle = 'elegant' | 'playful' | 'minimal';

export interface SvgAnimationOptions {
  imageKey: string;
  animationType: AnimationType;
  animationStyle: AnimationStyle;
  durationSeconds: number;
  trackId: string | null;
  startMs: number;
  width: number;
  height: number;
  description?: string;  // Description for scene matching
  sceneId?: number | null;  // Target scene ID
  useOriginalImage?: boolean;  // Display original image instead of converting to SVG
}

export interface SvgAnimationResponse {
  jobId: string;
}

export interface UserProfile {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  createdAt: string;
}

export interface UserProject {
  id: string;
  title: string | null;
  status: string;
  videoKey: string | null;
  thumbnailKey: string | null;
  durationMs: number | null;
  createdAt: string;
  updatedAt: string;
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

    // Get auth token
    const token = getSessionToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {}),
    };

    // Add Authorization header if we have a token
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(url, {
      ...options,
      headers,
      credentials: 'include', // Include cookies
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || `Request failed: ${response.status}`);
    }

    return response.json();
  }

  // Projects
  async createProject(filename: string, title?: string): Promise<CreateProjectResponse> {
    return this.request('/api/projects', {
      method: 'POST',
      body: JSON.stringify({ filename, title }),
    });
  }

  async deleteProject(projectId: string): Promise<{ success: boolean; message: string }> {
    return this.request(`/api/projects/${projectId}`, {
      method: 'DELETE',
    });
  }

  getThumbnailUrl(projectId: string): string {
    return `${this.baseUrl}/api/projects/${projectId}/thumbnail`;
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

  async renderProject(projectId: string, options?: { layoutSettings?: any }): Promise<ProcessProjectResponse> {
    return this.request(`/api/projects/${projectId}/render`, {
      method: 'POST',
      body: JSON.stringify(options || {}),
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

  async editVisuals(
    projectId: string,
    prompt: string,
    context?: EditVisualsContext
  ): Promise<EditVisualsResponse> {
    return this.request(`/api/projects/${projectId}/edit-visuals`, {
      method: 'POST',
      body: JSON.stringify({
        prompt,
        sceneId: context?.sceneId,
        targetType: context?.type,
        elementName: context?.elementName,
        itemId: context?.itemId,
        itemType: context?.itemType,
      }),
    });
  }

  async getScenes(projectId: string): Promise<ScenesResponse> {
    return this.request(`/api/projects/${projectId}/scenes`);
  }

  async getAssets(projectId: string): Promise<AssetsResponse> {
    return this.request(`/api/projects/${projectId}/assets`);
  }

  // Upload image for SVG animation
  async uploadImageForAnimation(projectId: string, file: File): Promise<UploadImageResponse> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const formData = new FormData();
      formData.append('file', file);

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const response = JSON.parse(xhr.responseText);
            resolve(response);
          } catch {
            reject(new Error('Failed to parse response'));
          }
        } else {
          let errorMessage = `Upload failed: ${xhr.status}`;
          try {
            const response = JSON.parse(xhr.responseText);
            errorMessage = response.error || errorMessage;
          } catch {
            // ignore parse error
          }
          reject(new Error(errorMessage));
        }
      });

      xhr.addEventListener('error', () => {
        reject(new Error('Upload failed'));
      });

      xhr.open('POST', `${this.baseUrl}/api/projects/${projectId}/upload-image`);

      // Add auth header
      const token = getSessionToken();
      if (token) {
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      }

      xhr.withCredentials = true;
      xhr.send(formData);
    });
  }

  // Create SVG animation from uploaded image
  async createSvgAnimation(projectId: string, options: SvgAnimationOptions): Promise<SvgAnimationResponse> {
    return this.request(`/api/projects/${projectId}/svg-animation`, {
      method: 'POST',
      body: JSON.stringify(options),
    });
  }

  // Users
  async getCurrentUser(): Promise<UserProfile> {
    return this.request('/api/users/me');
  }

  async updateCurrentUser(updates: { name?: string; avatarUrl?: string }): Promise<UserProfile> {
    return this.request('/api/users/me', {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  }

  async getCurrentUserProjects(): Promise<UserProject[]> {
    return this.request('/api/users/me/projects');
  }

  async deleteCurrentUser(): Promise<{ success: boolean; message: string }> {
    return this.request('/api/users/me', {
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

  // Upload helper - direct to presigned URL (may have CORS issues in some environments)
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

  // Proxy upload - uploads through API server, bypasses CORS issues
  async uploadViaProxy(
    projectId: string,
    file: File,
    onProgress?: (progress: number) => void
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const formData = new FormData();
      formData.append('file', file);

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
          let errorMessage = `Upload failed: ${xhr.status}`;
          try {
            const response = JSON.parse(xhr.responseText);
            errorMessage = response.error || errorMessage;
          } catch {
            // ignore parse error
          }
          reject(new Error(errorMessage));
        }
      });

      xhr.addEventListener('error', () => {
        reject(new Error('Upload failed'));
      });

      xhr.open('POST', `${this.baseUrl}/api/projects/${projectId}/upload`);

      // Add auth header
      const token = getSessionToken();
      if (token) {
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      }

      xhr.withCredentials = true;
      xhr.send(formData);
    });
  }
}

export const api = new ApiClient(API_URL);
