import { getSessionToken } from '../auth';

export type AssetSource = 'upload' | 'generated' | 'chat' | 'derived';
export type AssetStatus = 'uploading' | 'ready' | 'failed' | 'deleted';
export type AddedVia = 'upload' | 'chat' | 'generated' | 'library';

export interface Asset {
  id: string;
  userId: string;
  filename: string;
  label: string;
  mimeType: string;
  fileSize: number;
  sha256: string;
  storageKey: string;
  source: AssetSource;
  status: AssetStatus;
  durationMs: number | null;
  width: number | null;
  height: number | null;
  thumbnailKey: string | null;
  transcriptAssetId: string | null;
  userDescription: string | null;
  userIntent: string | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  /**
   * Presigned URL to the asset's thumbnail image. Populated by the list
   * endpoints (`GET /assets`, `GET /projects/:id/assets`) only; optional
   * because single-asset endpoints return the raw row without enrichment.
   */
  thumbnailUrl?: string | null;
}

export interface UploadUrlsRequest {
  filename: string;
  mimeType: string;
  fileSize: number;
  partCount: number;
}

export interface UploadUrlsResponse {
  uploadId: string;
  partUrls: { partNumber: number; url: string }[];
  storageKey: string;
  expiresAt: string;
}

export interface RegisterAssetRequest {
  sha256: string;
  storageKey: string;
  filename: string;
  mimeType: string;
  fileSize: number;
  source: AssetSource;
  userIntent?: string;
  parentAssetIds?: string[];
  projectId?: string;
}

export interface RegisterAssetResponse {
  asset: Asset;
  deduped: boolean;
}

export interface ArrangementOutput {
  timelineItems: {
    assetId: string;
    trackIndex: number;
    startMs: number;
    durationMs: number;
    sourceStartMs?: number;
    sourceDurationMs?: number;
  }[];
  summary: string;
}

export class AssetsApi {
  constructor(private readonly baseUrl: string) {}

  private headers(extra: Record<string, string> = {}): Record<string, string> {
    const token = getSessionToken();
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...extra,
    };
  }

  private async send<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: { ...this.headers(), ...(init?.headers as Record<string, string> ?? {}) },
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`${res.status} ${path}: ${body}`);
    }
    return res.json() as Promise<T>;
  }

  listUserAssets(): Promise<{ assets: Asset[] }> {
    return this.send('/assets');
  }

  getAsset(id: string): Promise<{ asset: Asset }> {
    return this.send(`/assets/${id}`);
  }

  getAssetUrl(id: string): Promise<{ url: string; expiresAt: string }> {
    return this.send(`/assets/${id}/url`);
  }

  getUploadUrls(req: UploadUrlsRequest): Promise<UploadUrlsResponse> {
    return this.send('/assets/upload-urls', { method: 'POST', body: JSON.stringify(req) });
  }

  registerAsset(req: RegisterAssetRequest): Promise<RegisterAssetResponse> {
    return this.send('/assets/register', { method: 'POST', body: JSON.stringify(req) });
  }

  patchAsset(id: string, patch: { label?: string; userDescription?: string | null; userIntent?: string | null; tags?: string[] }): Promise<{ asset: Asset }> {
    return this.send(`/assets/${id}`, { method: 'PATCH', body: JSON.stringify(patch) });
  }

  deleteAsset(id: string): Promise<{ ok: boolean }> {
    return this.send(`/assets/${id}`, { method: 'DELETE' });
  }

  linkToProject(projectId: string, req: { assetId: string; addedVia: AddedVia }): Promise<{ link: unknown }> {
    return this.send(`/projects/${projectId}/assets/link`, { method: 'POST', body: JSON.stringify(req) });
  }

  unlinkFromProject(projectId: string, assetId: string): Promise<{ ok: boolean }> {
    return this.send(`/projects/${projectId}/assets/${assetId}`, { method: 'DELETE' });
  }

  listProjectAssets(projectId: string): Promise<{ assets: Asset[] }> {
    return this.send(`/projects/${projectId}/assets`);
  }

  computeArrangement(projectId: string): Promise<ArrangementOutput> {
    return this.send(`/projects/${projectId}/arrangement/compute`, { method: 'POST' });
  }
}
