import { describe, it, expect, vi, beforeEach } from 'vitest';

// -------------------- mocks (must be declared before importing SUT) --------------------

// db.insert / db.update arg-capture spies
const dbInsertValues = vi.fn();
const dbInsertReturning = vi.fn();
const dbUpdateSet = vi.fn();
const dbUpdateWhere = vi.fn();
const emitEvent = vi.fn().mockResolvedValue(undefined);
const downloadToTmp = vi.fn();
const uploadAssetFile = vi.fn();

// Whisper + audio helpers. These live inside transcribe.ts as non-exported
// functions, so we can't mock them directly — we instead mock the OpenAI SDK
// they call and the ffmpeg child_process spawn via `child_process`.
const openaiCreate = vi.fn();
const spawnMock = vi.fn();

vi.mock('../db/index.js', () => ({
  db: {
    insert: vi.fn(() => ({
      values: (...v: unknown[]) => {
        dbInsertValues(...v);
        return {
          returning: () => {
            dbInsertReturning();
            const ret = (dbInsertReturning as unknown as { _result?: unknown[] })._result;
            return Promise.resolve(ret ?? []);
          },
        };
      },
    })),
    update: vi.fn(() => ({
      set: (...s: unknown[]) => {
        dbUpdateSet(...s);
        return {
          where: (...w: unknown[]) => {
            dbUpdateWhere(...w);
            return Promise.resolve(undefined);
          },
        };
      },
    })),
  },
  assets: {},
  projects: {},
  tracks: {},
  timelineItems: {},
  transcripts: {},
  jobs: {},
}));

vi.mock('../services/asset-events.js', () => ({
  emitAssetEvent: (...a: unknown[]) => emitEvent(...a),
}));

vi.mock('../services/asset-storage.js', () => ({
  downloadToTmp: (...a: unknown[]) => downloadToTmp(...a),
  uploadFile: (...a: unknown[]) => uploadAssetFile(...a),
}));

// Stub out the legacy minio helper (only used by project-mode path; asset-mode
// tests never hit it, but the import still resolves).
vi.mock('../services/minio.js', () => ({
  downloadFile: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../services/redis.js', () => ({
  publishJobProgress: vi.fn().mockResolvedValue(undefined),
  publishJobComplete: vi.fn().mockResolvedValue(undefined),
  publishJobError: vi.fn().mockResolvedValue(undefined),
  setJobProjectId: vi.fn(),
}));

vi.mock('../utils/redis.js', () => ({
  redisConnection: {},
}));

vi.mock('../config.js', () => ({
  config: {
    transcription: {
      openaiApiKey: 'test-key',
      language: 'en',
    },
    minio: { bucket: 'test' },
    database: { url: 'postgres://test' },
  },
}));

// Mock OpenAI SDK: `new OpenAI(...).audio.transcriptions.create(...)` is the
// surface runOpenAIWhisper hits. We intercept `create` with our spy so we can
// control what STT "returns".
vi.mock('openai', () => {
  class OpenAI {
    audio = { transcriptions: { create: (...a: unknown[]) => openaiCreate(...a) } };
    chat = { completions: { create: vi.fn() } };
    constructor(_opts?: unknown) { /* no-op */ }
  }
  return { default: OpenAI };
});

// Mock child_process.spawn so ffmpeg/ffprobe calls from extractAudio/
// convertToWhisperWav/hasVideoStream resolve successfully in tests without
// touching the real binaries. We simulate a process that exits with code 0.
vi.mock('child_process', () => ({
  spawn: (...args: unknown[]) => spawnMock(...args),
}));

// Stub fs/promises mkdir/rm — asset-mode creates a workDir for audio conversion.
vi.mock('fs/promises', async (orig) => {
  const actual = await orig<typeof import('fs/promises')>();
  return {
    ...actual,
    mkdir: vi.fn().mockResolvedValue(undefined),
    rm: vi.fn().mockResolvedValue(undefined),
  };
});

// Stub fs.createReadStream (used by runOpenAIWhisper to upload to OpenAI).
vi.mock('fs', async (orig) => {
  const actual = await orig<typeof import('fs')>();
  return {
    ...actual,
    createReadStream: vi.fn(() => ({ /* minimal readable stub */ } as unknown)),
  };
});

// -------------------- SUT import (AFTER all mocks) --------------------
import { mapWordTypeToOverrides, processTranscribeJob } from './transcribe.js';

// Helper: make the mocked spawn simulate a successful ffmpeg/ffprobe run.
function installSuccessfulSpawn() {
  // spawn returns an EventEmitter-ish object. Our callers listen for 'close'
  // (code=0) and optionally read stdout. For hasVideoStream we must emit a
  // `{ streams: [{}] }`-style JSON payload on stdout so it decides "has video".
  // But in asset-mode we control the branch separately, so default to "no
  // video stream" (empty stdout → hasVideoStream returns false, convertToWhisperWav
  // is used). Individual tests can override.
  spawnMock.mockImplementation(() => {
    const listeners: Record<string, Array<(...a: unknown[]) => void>> = {};
    const proc = {
      stdout: {
        on: (event: string, cb: (chunk: Buffer) => void) => {
          if (event === 'data') {
            // emit empty JSON for hasVideoStream: { streams: [] }
            cb(Buffer.from(JSON.stringify({ streams: [] })));
          }
        },
      },
      stderr: { on: () => { /* no-op */ } },
      on: (event: string, cb: (...a: unknown[]) => void) => {
        listeners[event] = listeners[event] ?? [];
        listeners[event].push(cb);
        if (event === 'close') {
          // fire 'close' asynchronously so other listeners get registered first
          queueMicrotask(() => cb(0));
        }
      },
    };
    return proc;
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  (dbInsertReturning as unknown as { _result?: unknown[] })._result = undefined;
  installSuccessfulSpawn();
});

// -------------------- existing tests (preserved) --------------------

describe('mapWordTypeToOverrides', () => {
  it('returns power overrides for power words', () => {
    const result = mapWordTypeToOverrides('power');
    expect(result).not.toBeNull();
    expect(result!.scale).toBe(1.6);
    expect(result!.fontWeight).toBe(900);
    expect(result!.color).toBe('#ffffff');
    expect(result!.activeColor).toBe('#FFD400');
    expect(result!.textTransform).toBe('uppercase');
  });

  it('returns filler overrides for filler words', () => {
    const result = mapWordTypeToOverrides('filler');
    expect(result).not.toBeNull();
    expect(result!.scale).toBe(1.0);
    expect(result!.fontWeight).toBe(500);
    expect(result!.color).toBe('rgba(255,255,255,0.7)');
    expect(result!.activeColor).toBe('rgba(255,255,255,0.85)');
    expect(result!.textTransform).toBeUndefined();
  });

  it('returns null for medium words (use preset defaults)', () => {
    const result = mapWordTypeToOverrides('medium');
    expect(result).toBeNull();
  });
});

// -------------------- new asset-mode tests --------------------

describe('processTranscribeJob — asset mode', () => {
  it('runs STT, uploads transcript JSON, inserts derived asset row, updates parent, emits transcript_ready', async () => {
    // Arrange
    const cleanup = vi.fn().mockResolvedValue(undefined);
    downloadToTmp.mockResolvedValueOnce({ path: '/tmp/src.mp3', cleanup });

    openaiCreate.mockResolvedValueOnce({
      text: 'hello world',
      words: [
        { word: 'hello', start: 0, end: 0.5 },
        { word: 'world', start: 0.5, end: 1.0 },
      ],
      segments: [
        { text: 'hello world', start: 0, end: 1.0 },
      ],
    });

    uploadAssetFile.mockResolvedValueOnce('users/u/derived/a-1/transcript.json');
    (dbInsertReturning as unknown as { _result?: unknown[] })._result = [{ id: 'derived-1' }];

    // Act
    await processTranscribeJob({
      data: { mode: 'asset', assetId: 'a-1', userId: 'u', storageKey: 'users/u/assets/a-1/src.mp3' },
    } as never);

    // Assert: download
    expect(downloadToTmp).toHaveBeenCalledWith('users/u/assets/a-1/src.mp3');

    // Assert: STT was called with a file stream (createReadStream-produced object).
    expect(openaiCreate).toHaveBeenCalledTimes(1);
    const openaiArgs = openaiCreate.mock.calls[0][0] as Record<string, unknown>;
    expect(openaiArgs.model).toBe('whisper-1');

    // Assert: uploadFile called with a transcript.json key and application/json.
    expect(uploadAssetFile).toHaveBeenCalledTimes(1);
    const [uploadKey, uploadBody, uploadCt] = uploadAssetFile.mock.calls[0];
    expect(uploadKey).toBe('users/u/derived/a-1/transcript.json');
    expect(Buffer.isBuffer(uploadBody)).toBe(true);
    expect(uploadCt).toBe('application/json');
    // The body must be valid JSON containing our segments/words.
    const decoded = JSON.parse((uploadBody as Buffer).toString('utf8'));
    expect(decoded).toMatchObject({
      text: 'hello world',
      segments: [{ text: 'hello world', startMs: 0, endMs: 1000 }],
    });
    expect(decoded.words).toHaveLength(2);

    // Assert: derived asset row inserted with the right shape.
    expect(dbInsertValues).toHaveBeenCalledTimes(1);
    const insertArgs = dbInsertValues.mock.calls[0][0] as Record<string, unknown>;
    expect(insertArgs).toMatchObject({
      userId: 'u',
      source: 'derived',
      status: 'ready',
      storageKey: 'users/u/derived/a-1/transcript.json',
      filename: 'transcript.json',
      mimeType: 'application/json',
      label: 'Transcript',
      parentAssetIds: ['a-1'],
      thumbnailStatus: 'not_applicable',
      waveformStatus: 'not_applicable',
      transcriptStatus: 'not_applicable',
    });
    expect(typeof insertArgs.sha256).toBe('string');
    expect((insertArgs.sha256 as string).length).toBe(64);
    expect(typeof insertArgs.fileSize).toBe('number');
    expect(insertArgs.fileSize).toBeGreaterThan(0);

    // Assert: parent asset updated with transcriptAssetId + transcriptStatus.
    expect(dbUpdateSet).toHaveBeenCalledWith(expect.objectContaining({
      transcriptAssetId: 'derived-1',
      transcriptStatus: 'ready',
    }));

    // Assert: transcript_ready event emitted.
    expect(emitEvent).toHaveBeenCalledTimes(1);
    expect(emitEvent).toHaveBeenCalledWith(expect.objectContaining({
      assetId: 'a-1',
      userId: 'u',
      projectId: null,
      type: 'transcript_ready',
      payload: expect.objectContaining({
        transcriptAssetId: 'derived-1',
        wordCount: 2,
      }),
    }));

    // Negative assertion: we did NOT emit a failed event, and the cleanup ran.
    const eventTypes = emitEvent.mock.calls.map((c: unknown[]) => (c[0] as { type: string }).type);
    expect(eventTypes).not.toContain('failed');
    expect(cleanup).toHaveBeenCalled();
  });

  it('emits failed event and rethrows when STT fails; no asset row inserted', async () => {
    const cleanup = vi.fn().mockResolvedValue(undefined);
    downloadToTmp.mockResolvedValueOnce({ path: '/tmp/bad.mp3', cleanup });
    openaiCreate.mockRejectedValueOnce(new Error('stt-boom'));

    await expect(processTranscribeJob({
      data: { mode: 'asset', assetId: 'a-2', userId: 'u', storageKey: 'k' },
    } as never)).rejects.toThrow('stt-boom');

    // No partial writes.
    expect(dbInsertValues).not.toHaveBeenCalled();
    expect(uploadAssetFile).not.toHaveBeenCalled();

    // Failed event emitted with stage=transcribe.
    expect(emitEvent).toHaveBeenCalledTimes(1);
    expect(emitEvent).toHaveBeenCalledWith(expect.objectContaining({
      assetId: 'a-2',
      userId: 'u',
      type: 'failed',
      payload: expect.objectContaining({ stage: 'transcribe', message: 'stt-boom' }),
    }));

    // Cleanup still ran.
    expect(cleanup).toHaveBeenCalled();
  });

  it('cleans up download tmp directory on success', async () => {
    const cleanup = vi.fn().mockResolvedValue(undefined);
    downloadToTmp.mockResolvedValueOnce({ path: '/tmp/clean.mp3', cleanup });
    openaiCreate.mockResolvedValueOnce({ text: '', words: [], segments: [] });
    uploadAssetFile.mockResolvedValueOnce('k');
    (dbInsertReturning as unknown as { _result?: unknown[] })._result = [{ id: 'derived-2' }];

    await processTranscribeJob({
      data: { mode: 'asset', assetId: 'a-3', userId: 'u', storageKey: 'k' },
    } as never);

    expect(cleanup).toHaveBeenCalled();
  });
});
