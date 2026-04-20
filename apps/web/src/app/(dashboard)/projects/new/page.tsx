'use client';
import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { uploadAndRegister } from '@/lib/assets/upload-client';

export default function NewProjectPage() {
  const router = useRouter();
  const [prompt, setPrompt] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setFiles((f) => [...f, ...Array.from(e.dataTransfer.files)]);
  }, []);

  const onPickFiles = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    setFiles((f) => [...f, ...Array.from(e.target.files!)]);
  }, []);

  const create = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      // Step 1: create an empty project shell. Reuses the existing
      // api.createProject(filename, title?, description?) signature — we pass
      // the first file's name (or a placeholder) as the filename, and a
      // prompt-derived title.
      const seedFilename = files[0]?.name ?? 'project';
      const title = prompt.trim().slice(0, 50) || 'New Project';
      const { projectId } = await api.createProject(seedFilename, title, prompt.trim());

      // Step 2: upload + register all files against this project.
      // uploadAndRegister auto-links the asset to the project in asset-system-v2.
      const results = await Promise.allSettled(
        files.map((file) => uploadAndRegister({ file, source: 'upload', projectId }))
      );
      const failures = results.filter((r) => r.status === 'rejected');
      if (failures.length > 0) {
        console.error('[new-project] upload failures', failures);
      }

      // Step 3: redirect to editor with the initial prompt as a query param.
      // The editor's AIAssistantPanel can pick this up on mount in a later
      // wire-up (or the user can retype it). The prompt survives in the URL.
      const search = prompt.trim() ? `?initialPrompt=${encodeURIComponent(prompt)}` : '';
      router.push(`/edit/${projectId}${search}`);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }, [files, prompt, router]);

  const canSubmit = !busy && files.length > 0 && prompt.trim() !== '';

  return (
    <div className="mx-auto max-w-2xl p-8">
      <h1 className="text-2xl font-semibold">New Project</h1>
      <div
        onDrop={onDrop}
        onDragOver={(e) => e.preventDefault()}
        className="mt-6 rounded-lg border-2 border-dashed p-10 text-center"
      >
        {files.length === 0 ? (
          <div className="text-sm text-muted-foreground">
            Drop video, audio, images here
            <label className="mt-2 block cursor-pointer text-primary underline">
              or pick files
              <input type="file" multiple className="hidden" onChange={onPickFiles} />
            </label>
          </div>
        ) : (
          <ul className="text-left text-sm">
            {files.map((f, i) => (
              <li key={i} className="py-0.5">
                {f.name} <span className="text-muted-foreground">({Math.round(f.size / 1024)} KB)</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <label className="mt-6 block">
        <span className="text-sm font-medium">Prompt</span>
        <textarea
          aria-label="Prompt"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={4}
          className="mt-1 block w-full rounded border p-2 text-sm"
          placeholder="Describe the video you want..."
        />
      </label>

      {error && <div className="mt-2 text-sm text-red-500">{error}</div>}

      <button
        type="button"
        disabled={!canSubmit}
        onClick={create}
        className="mt-6 rounded bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50"
      >
        {busy ? 'Creating…' : 'Create'}
      </button>
    </div>
  );
}
