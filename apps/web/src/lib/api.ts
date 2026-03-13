import type { RenderOptions, GenerateVisualsOptions } from '@viona/shared';
import { getSessionToken } from './auth';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export interface CreateProjectResponse {
  projectId: string;
  uploadUrl: string;
  videoKey: string;
  projectType?: 'video' | 'audio';
}

export interface ProcessProjectResponse {
  jobId: string;
  transcribeJobId: string;
  enhanceJobId: string | null;
  headTrackJobId?: string | null;
  totalJobs?: number;
}

export interface Project {
  id: string;
  title: string | null;
  status: string;
  projectType?: 'video' | 'audio';
  videoKey: string | null;
  audioKey?: string | null;
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
  videoPresignedUrl?: string | null;
  audioPresignedUrl?: string | null;
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
  progressMeta?: {
    phase?: string;
    phaseName?: string;
    scene?: number;
    totalScenes?: number;
    iteration?: number;
    maxIterations?: number;
    score?: number;
    detail?: string;
  } | null;
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
  trackId: string;
  itemId: string;
  src: string;
}

// StylePreset, VisualsLayoutMode, VisualsDimensions, GenerateVisualsOptions
// are imported from @viona/shared
export type { StylePreset, VisualsLayoutMode, VisualsDimensions, GenerateVisualsOptions } from '@viona/shared';

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
  projectType?: 'video' | 'audio';
  videoKey: string | null;
  audioKey?: string | null;
  thumbnailKey: string | null;
  durationMs: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectMediaAsset {
  id: string;
  filename: string;
  label?: string | null;
  description?: string | null;
  mimeType: string;
  fileSize: number | null;
  url: string;
  previewUrl?: string;
  createdAt: string;
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
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers as Record<string, string> || {}),
    };

    // Add Authorization header if we have a token
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);

    let response: Response;
    try {
      response = await fetch(url, {
        ...options,
        headers,
        credentials: 'include', // Include cookies
        signal: controller.signal,
      });
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        throw new Error('Request timed out after 30 seconds');
      }
      throw err;
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      console.error('[API Error]', response.status, url, JSON.stringify(error).slice(0, 500));
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
    updates: { title?: string; tracks?: Partial<Track>[]; items?: Partial<TimelineItem>[]; captionItemIds?: string[]; visualItemIds?: string[]; videoItemIds?: string[]; audioItemIds?: string[]; videoSettings?: Record<string, unknown> }
  ): Promise<{ success: boolean }> {
    return this.request(`/api/projects/${projectId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  }

  async renderProject(projectId: string, options?: RenderOptions): Promise<ProcessProjectResponse> {
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

  async generateCaptionStyles(projectId: string): Promise<{ jobId: string }> {
    return this.request(`/api/projects/${projectId}/generate-caption-styles`, {
      method: 'POST',
      body: JSON.stringify({}),
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

  async getJobActivity(jobId: string): Promise<{ activity: any[]; progress: any }> {
    return this.request(`/api/jobs/${jobId}/activity`);
  }

  async cancelJob(jobId: string): Promise<{ success: boolean }> {
    return this.request(`/api/jobs/${jobId}/cancel`, {
      method: 'POST',
    });
  }

  // Agent
  async chatWithAgent(
    projectId: string,
    body: {
      message: string;
      context?: {
        selectedTimeRange?: { startMs: number; endMs: number };
        selectedSceneId?: number;
        selectedElement?: { name: string; sceneId: number };
        selectedVisualItem?: { id: string; description: string };
      };
      widgetResponse?: { widgetId: string; value: unknown };
    },
    signal?: AbortSignal,
    lastEventId?: number,
  ): Promise<ReadableStream<Uint8Array>> {
    const url = `${this.baseUrl}/api/projects/${projectId}/agent/chat`;
    const token = getSessionToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    if (lastEventId !== undefined) {
      headers['Last-Event-ID'] = String(lastEventId);
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      credentials: 'include',
      body: JSON.stringify(body),
      signal,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || `Request failed: ${response.status}`);
    }

    if (!response.body) {
      throw new Error('No response body');
    }

    return response.body;
  }

  async getConversation(projectId: string): Promise<{
    conversationId: string | null;
    messages: Array<{
      id: string;
      role: 'user' | 'assistant';
      content: unknown;
      createdAt: string;
    }>;
    activeJob?: {
      id: string;
      type: string;
      progress: number;
      message: string | null;
      phase?: string;
      phaseName?: string;
      jobType?: string;
      progressMeta?: {
        phase?: string;
        phaseName?: string;
        scene?: number;
        totalScenes?: number;
        iteration?: number;
        maxIterations?: number;
        score?: number;
        detail?: string;
      } | null;
    } | null;
  }> {
    return this.request(`/api/projects/${projectId}/agent/conversation`);
  }

  async clearConversation(projectId: string): Promise<{ success: boolean }> {
    return this.request(`/api/projects/${projectId}/agent/conversation`, {
      method: 'DELETE',
    });
  }

  async updatePlanScenes(
    projectId: string,
    planJobId: string,
    scenes: Array<{ id: number; title?: string; description?: string; displayMode?: 'default' | 'fullscreen' | 'overlay' }>
  ): Promise<{ success: boolean; scenes: Array<{
    startMs: number; endMs: number; title: string; description: string;
    emotion?: string; displayMode?: string;
    keySync?: { word: string; timestamp: number; visualEvent: string };
    buildsFrom?: string | null; connectsTo?: string | null;
    layout?: Record<string, unknown> | null; frames?: [number, number] | null;
    icons?: string[]; transition?: { enter: { type: string; durationMs: number }; exit: { type: string; durationMs: number } };
  }> }> {
    return this.request(`/api/projects/${projectId}/plan/${planJobId}`, {
      method: 'PATCH',
      body: JSON.stringify({ scenes }),
    });
  }

  async cancelAgent(projectId: string): Promise<{ ok: boolean; cancelledJobId: string | null }> {
    return this.request(`/api/projects/${projectId}/agent/cancel`, {
      method: 'POST',
    });
  }

  // Project media (B-roll assets)
  async getProjectMedia(projectId: string): Promise<{ assets: ProjectMediaAsset[] }> {
    return this.request(`/api/projects/${projectId}/media`);
  }

  async uploadProjectMedia(
    projectId: string,
    file: File,
    label?: string,
    onProgress?: (progress: number) => void
  ): Promise<ProjectMediaAsset> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const formData = new FormData();
      formData.append('file', file);
      if (label) formData.append('label', label);

      if (onProgress) {
        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable) {
            onProgress(Math.round((event.loaded / event.total) * 100));
          }
        });
      }

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try { resolve(JSON.parse(xhr.responseText)); }
          catch { reject(new Error('Failed to parse response')); }
        } else {
          reject(new Error(`Upload failed: ${xhr.status}`));
        }
      });

      xhr.addEventListener('error', () => reject(new Error('Upload failed')));
      xhr.open('POST', `${this.baseUrl}/api/projects/${projectId}/media`);
      const token = getSessionToken();
      if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      xhr.withCredentials = true;
      xhr.send(formData);
    });
  }

  async deleteProjectMedia(projectId: string, assetId: string): Promise<{ success: boolean }> {
    return this.request(`/api/projects/${projectId}/media/${assetId}`, {
      method: 'DELETE',
    });
  }

  async generateBroll(projectId: string): Promise<{ jobId: string }> {
    return this.request(`/api/projects/${projectId}/generate-broll`, {
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
  async splitVisualScene(projectId: string, data: {
    compositionId: string;
    sourceSceneId?: number;
    splitAtMs: number;
    leftItemId: string;
    rightItemId: string;
  }): Promise<{ jobId: string }> {
    return this.request<{ jobId: string }>(`/api/projects/${projectId}/split-visual`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }
}

export const api = new ApiClient(API_URL);

// ============================================
// YouTube Clip API
// ============================================

export interface YouTubeStreamInfo {
  tokenId: string;
  title: string;
  channel: string;
  duration: number;
  thumbnail: string;
}

export interface YouTubeClipJob {
  clipId?: string;
  clipUrl?: string;
  sourceTitle?: string;
  duration?: number;
  thumbnail?: string;
  status: string;
  progress: number;
}

export const youtubeApi = {
  async getStreamInfo(url: string): Promise<YouTubeStreamInfo> {
    const res = await fetch(`${API_URL}/youtube-clips/stream-info?url=${encodeURIComponent(url)}`, {
      headers: { Authorization: `Bearer ${getSessionToken()}` },
      credentials: 'include',
    });
    if (!res.ok) throw new Error((await res.json()).message || 'Failed to get stream info');
    return res.json();
  },

  getProxyUrl(tokenId: string): string {
    return `${API_URL}/youtube-clips/proxy/${tokenId}`;
  },

  getClipUrl(clipPath: string): string {
    if (clipPath.startsWith('http')) return clipPath;
    return `${API_URL}${clipPath}`;
  },

  async extractClip(url: string, startSeconds: number, endSeconds: number): Promise<{ jobId: string }> {
    const res = await fetch(`${API_URL}/youtube-clips/extract`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${getSessionToken()}`,
      },
      credentials: 'include',
      body: JSON.stringify({ url, startSeconds, endSeconds }),
    });
    if (!res.ok) throw new Error((await res.json()).message || 'Failed to start extraction');
    return res.json();
  },

  async pollUntilComplete(
    jobId: string,
    onProgress?: (progress: number) => void,
  ): Promise<YouTubeClipJob> {
    const maxAttempts = 120;
    for (let i = 0; i < maxAttempts; i++) {
      const res = await fetch(`${API_URL}/youtube-clips/jobs/${jobId}`, {
        headers: { Authorization: `Bearer ${getSessionToken()}` },
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to check job status');
      const job: YouTubeClipJob = await res.json();
      onProgress?.(job.progress);
      if (job.status === 'completed') return job;
      if (job.status === 'failed') throw new Error('Clip extraction failed');
      await new Promise((r) => setTimeout(r, 1000));
    }
    throw new Error('Clip extraction timed out');
  },
};
