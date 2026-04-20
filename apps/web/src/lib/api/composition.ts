import { getSessionToken } from '../auth';

export interface ResolvedAsset {
  id: string;
  filename: string;
  mimeType: string;
  durationMs: number | null;
  width: number | null;
  height: number | null;
  url: string;
  thumbnailUrl: string | null;
}

export interface Composition {
  tracks: Array<{ id: string; projectId: string; position: number; type: string; name: string }>;
  timelineItems: Array<{ id: string; trackId: string; type: string; startMs: number; endMs: number; data: Record<string, unknown> }>;
  assets: Record<string, ResolvedAsset>;
}

export class CompositionApi {
  constructor(private readonly baseUrl: string) {}

  async getComposition(projectId: string): Promise<Composition> {
    const token = getSessionToken();
    const res = await fetch(`${this.baseUrl}/api/projects/${projectId}/composition-v2`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    if (!res.ok) throw new Error(`${res.status} composition: ${await res.text()}`);
    return res.json() as Promise<Composition>;
  }
}
