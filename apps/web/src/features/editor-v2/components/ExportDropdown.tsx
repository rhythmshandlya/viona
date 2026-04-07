'use client';

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Download, CheckCircle, AlertCircle, Film, Settings, X } from 'lucide-react';
import { api } from '@/lib/api';
import {
  useExportState,
  useExportProgress,
  useExportActions,
  useProjectId,
  useEditorStore,
} from '../store/use-editor-store';
import { useJobWebSocket } from '../hooks/use-job-websocket';

interface ExportDropdownProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  anchorRef: React.RefObject<HTMLElement | null>;
}

export function ExportDropdown({ open, onOpenChange, anchorRef }: ExportDropdownProps) {
  const projectId = useProjectId();
  const exportState = useExportState();
  const { progress, message, error, downloadUrl, jobId } = useExportProgress();
  const { startExport, resetExport, setExportProgress, setExportComplete, setExportError } = useExportActions();
  const dropdownRef = useRef<HTMLDivElement>(null);

  // WebSocket progress tracking
  const { isConnected, subscribeToJob, unsubscribeFromJob } = useJobWebSocket(
    projectId || '',
    {
      onProgress: (data) => {
        const currentJobId = useEditorStore.getState().exportJobId;
        if (data.jobId === currentJobId) {
          setExportProgress(data.progress ?? data.percent ?? 0, data.message);
        }
      },
      onComplete: async (data) => {
        const currentJobId = useEditorStore.getState().exportJobId;
        if (data.jobId === currentJobId && projectId) {
          try {
            const { url } = await api.getDownloadUrl(projectId);
            setExportComplete(url);
          } catch {
            setExportComplete('');
          }
        }
      },
      onError: (data) => {
        const currentJobId = useEditorStore.getState().exportJobId;
        if (data.jobId === currentJobId) {
          setExportError(data.error || 'Export failed');
        }
      },
    }
  );

  // Restore completed render state when project has an outputKey
  const outputKey = useEditorStore((s) => s.outputKey ?? (s as any).project?.outputKey ?? null);
  useEffect(() => {
    if (!projectId || !outputKey || exportState !== 'idle') return;
    api.getDownloadUrl(projectId).then(({ url }) => {
      setExportComplete(url);
    }).catch(() => {
      setExportComplete('');
    });
  }, [projectId, outputKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Subscribe to job when it starts
  useEffect(() => {
    if (jobId && isConnected) {
      subscribeToJob(jobId);
      return () => unsubscribeFromJob(jobId);
    }
  }, [jobId, isConnected, subscribeToJob, unsubscribeFromJob]);

  // Polling fallback
  useEffect(() => {
    if (!jobId || exportState !== 'rendering') return;

    const interval = setInterval(async () => {
      try {
        const job = await api.getJob(jobId);
        if (job.progress) setExportProgress(job.progress, job.progressMessage);
        if (job.status === 'complete' && projectId) {
          const { url } = await api.getDownloadUrl(projectId);
          setExportComplete(url);
        } else if (job.status === 'failed') {
          setExportError(job.error || 'Export failed');
        }
      } catch { /* ignore */ }
    }, 3000);
    return () => clearInterval(interval);
  }, [jobId, exportState, projectId, setExportProgress, setExportComplete, setExportError]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
        anchorRef.current && !anchorRef.current.contains(e.target as Node)
      ) {
        onOpenChange(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, onOpenChange, anchorRef]);

  // Position below anchor
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);
  useEffect(() => {
    if (!open || !anchorRef.current) return;
    const updatePos = () => {
      const rect = anchorRef.current!.getBoundingClientRect();
      setPos({ top: rect.bottom + 8, right: window.innerWidth - rect.right });
    };
    updatePos();
    window.addEventListener('resize', updatePos);
    return () => window.removeEventListener('resize', updatePos);
  }, [open, anchorRef]);

  // Find the .editor-theme root to portal into (preserves CSS variables)
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setPortalTarget(document.querySelector('.editor-theme') as HTMLElement || document.body);
  }, []);

  if (!open || !pos || !portalTarget) return null;

  const handleDownload = () => {
    if (downloadUrl) window.open(downloadUrl, '_blank');
  };

  return createPortal(
    <div
      ref={dropdownRef}
      className="editor-panel fixed w-80 overflow-hidden"
      style={{ zIndex: 99999, top: pos.top, right: pos.right }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
        <div className="flex items-center gap-2">
          <Film className="w-4 h-4 text-[var(--editor-accent)]" />
          <span className="text-sm font-medium text-[var(--editor-text-primary)]">Export Video</span>
        </div>
        <button
          onClick={() => onOpenChange(false)}
          className="glass-btn w-6 h-6 flex items-center justify-center rounded-md text-[var(--editor-text-muted)]"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="p-4">
        {/* Idle */}
        {exportState === 'idle' && (
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.04] border border-white/[0.06]">
              <Settings className="w-4 h-4 text-[var(--editor-text-muted)]" />
              <div>
                <div className="text-sm text-[var(--editor-text-primary)]">MP4 (H.264)</div>
                <div className="text-xs text-[var(--editor-text-muted)]">Original Resolution</div>
              </div>
            </div>

            <button
              onClick={startExport}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl
                         bg-[var(--editor-accent)] text-white text-sm font-medium
                         hover:bg-[var(--editor-accent-hover)] active:scale-[0.97] transition-all
                         shadow-[0_2px_12px_rgba(139,92,246,0.3),inset_0_1px_0_rgba(255,255,255,0.15)]"
            >
              <Download className="w-4 h-4" />
              Start Export
            </button>
          </div>
        )}

        {/* Rendering */}
        {exportState === 'rendering' && (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="relative w-10 h-10 flex-shrink-0">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 40 40">
                  <circle cx="20" cy="20" r="16" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="3" />
                  <circle
                    cx="20" cy="20" r="16" fill="none"
                    stroke="var(--editor-accent)"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeDasharray={`${progress * 1.005} 100.5`}
                    className="transition-all duration-300"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-[10px] font-medium text-[var(--editor-text-primary)]">{progress}%</span>
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm text-[var(--editor-text-primary)]">Exporting...</div>
                <div className="text-xs text-[var(--editor-text-muted)] truncate">{message || 'Processing'}</div>
              </div>
            </div>

            <div className="w-full bg-white/[0.06] rounded-full h-1.5 overflow-hidden">
              <div
                className="h-full bg-[var(--editor-accent)] transition-all duration-300 rounded-full"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Complete */}
        {exportState === 'complete' && (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                <CheckCircle className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <div className="text-sm text-[var(--editor-text-primary)]">Export Complete</div>
                <div className="text-xs text-[var(--editor-text-muted)]">Ready to download</div>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleDownload}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-xl
                           bg-emerald-600 text-white text-sm font-medium
                           hover:bg-emerald-700 active:scale-[0.97] transition-all
                           shadow-[0_2px_12px_rgba(16,185,129,0.3),inset_0_1px_0_rgba(255,255,255,0.15)]"
              >
                <Download className="w-4 h-4" />
                Download
              </button>
              <button
                onClick={resetExport}
                className="glass-btn px-3 py-2 rounded-xl text-sm text-[var(--editor-text-secondary)]
                           border border-white/[0.08]"
              >
                New
              </button>
            </div>
          </div>
        )}

        {/* Error */}
        {exportState === 'error' && (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center flex-shrink-0">
                <AlertCircle className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <div className="text-sm text-[var(--editor-text-primary)]">Export Failed</div>
                <div className="text-xs text-red-400 truncate">{error || 'An error occurred'}</div>
              </div>
            </div>

            <button
              onClick={resetExport}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl
                         bg-[var(--editor-accent)] text-white text-sm font-medium
                         hover:bg-[var(--editor-accent-hover)] active:scale-[0.97] transition-all
                         shadow-[0_2px_12px_rgba(139,92,246,0.3),inset_0_1px_0_rgba(255,255,255,0.15)]"
            >
              Try Again
            </button>
          </div>
        )}
      </div>
    </div>,
    portalTarget
  );
}
