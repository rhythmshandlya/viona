/**
 * ExportModal Component
 * Provides export options and shows render progress
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Download, X, CheckCircle, AlertCircle, Loader2, Film, Settings } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { api } from '@/lib/api';
import { useJobWebSocket } from '../hooks/use-job-websocket';

interface ExportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  projectStatus: string;
  hasOutputKey: boolean;
}

type ExportState = 'idle' | 'rendering' | 'complete' | 'error';

export type LayoutMode = 'pip' | 'split-h' | 'split-v' | 'overlay';
export type PipPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

export interface ExportOptions {
  layoutMode: LayoutMode;
  pipPosition: PipPosition;
  pipSize: number;
}

export function ExportModal({
  open,
  onOpenChange,
  projectId,
  projectStatus,
  hasOutputKey,
}: ExportModalProps) {
  const [exportState, setExportState] = useState<ExportState>('idle');
  const [jobId, setJobId] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  // Export options
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('pip');
  const [pipPosition, setPipPosition] = useState<PipPosition>('bottom-right');
  const [pipSize, setPipSize] = useState(25);

  // WebSocket for real-time progress
  const { isConnected, subscribeToJob, unsubscribeFromJob } = useJobWebSocket(
    projectId,
    {
      onProgress: (data) => {
        if (data.jobId === jobId) {
          setProgress(data.progress || 0);
          if (data.message) {
            setStatusMessage(data.message);
          }
        }
      },
      onComplete: async (data) => {
        if (data.jobId === jobId) {
          setExportState('complete');
          setProgress(100);
          setStatusMessage('Export complete!');
          // Fetch download URL
          try {
            const { url } = await api.getDownloadUrl(projectId);
            setDownloadUrl(url);
          } catch (err) {
            console.error('Failed to get download URL:', err);
          }
        }
      },
      onError: (data) => {
        if (data.jobId === jobId) {
          setExportState('error');
          setError(data.error || 'Export failed');
        }
      },
    }
  );

  // Subscribe to job when it starts
  useEffect(() => {
    if (jobId && isConnected) {
      subscribeToJob(jobId);
      return () => unsubscribeFromJob(jobId);
    }
  }, [jobId, isConnected, subscribeToJob, unsubscribeFromJob]);

  // Fallback polling when WebSocket isn't connected
  useEffect(() => {
    if (!jobId || exportState !== 'rendering') return;
    if (isConnected) return;

    const interval = setInterval(async () => {
      try {
        const job = await api.getJob(jobId);
        setProgress(job.progress || 0);

        if (job.status === 'complete') {
          setExportState('complete');
          setStatusMessage('Export complete!');
          const { url } = await api.getDownloadUrl(projectId);
          setDownloadUrl(url);
        } else if (job.status === 'failed') {
          setExportState('error');
          setError(job.error || 'Export failed');
        }
      } catch (err) {
        console.error('Failed to poll job:', err);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [jobId, exportState, isConnected, projectId]);

  // Check if there's already an output available
  useEffect(() => {
    if (open && hasOutputKey && exportState === 'idle') {
      // Project already has a rendered output
      api.getDownloadUrl(projectId).then(({ url }) => {
        setDownloadUrl(url);
        setExportState('complete');
      }).catch(() => {
        // No output available
      });
    }
  }, [open, hasOutputKey, exportState, projectId]);

  // Reset state when modal closes
  useEffect(() => {
    if (!open) {
      // Keep download URL if export completed
      if (exportState !== 'complete') {
        setExportState('idle');
        setJobId(null);
        setProgress(0);
        setStatusMessage('');
        setError(null);
      }
    }
  }, [open, exportState]);

  const handleStartExport = async () => {
    if (projectStatus !== 'ready') {
      setError('Project is not ready for export. Please wait for processing to complete.');
      return;
    }

    setExportState('rendering');
    setProgress(0);
    setStatusMessage('Starting export...');
    setError(null);
    setDownloadUrl(null);

    try {
      const options: ExportOptions = {
        layoutMode,
        pipPosition,
        pipSize,
      };
      const { jobId: newJobId } = await api.renderProject(projectId, options);
      setJobId(newJobId);
    } catch (err) {
      setExportState('error');
      setError(err instanceof Error ? err.message : 'Failed to start export');
    }
  };

  const handleDownload = () => {
    if (downloadUrl) {
      window.open(downloadUrl, '_blank');
    }
  };

  const handleClose = () => {
    onOpenChange(false);
  };

  const handleExportAgain = () => {
    setExportState('idle');
    setJobId(null);
    setProgress(0);
    setStatusMessage('');
    setError(null);
    setDownloadUrl(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-[var(--editor-bg-elevated)] border-[var(--editor-border-default)]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[var(--editor-text-primary)]">
            <Film className="w-5 h-5 text-[var(--editor-accent)]" />
            Export Video
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Idle State - Show export options */}
          {exportState === 'idle' && (
            <>
              <div className="space-y-3">
                {/* Layout Mode */}
                <div className="p-3 rounded-lg bg-[var(--editor-bg-surface)] border border-[var(--editor-border-subtle)]">
                  <div className="text-sm font-medium text-[var(--editor-text-primary)] mb-2">
                    Layout Mode
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { value: 'pip', label: 'Picture in Picture' },
                      { value: 'split-h', label: 'Split Horizontal' },
                      { value: 'split-v', label: 'Split Vertical' },
                      { value: 'overlay', label: 'Overlay' },
                    ].map((option) => (
                      <button
                        key={option.value}
                        onClick={() => setLayoutMode(option.value as LayoutMode)}
                        className={`px-3 py-2 text-xs rounded-md transition-colors ${
                          layoutMode === option.value
                            ? 'bg-[var(--editor-accent)] text-[var(--editor-bg-base)]'
                            : 'bg-[var(--editor-bg-hover)] text-[var(--editor-text-secondary)] hover:bg-[var(--editor-bg-elevated)]'
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* PiP Options - only show when pip mode is selected */}
                {layoutMode === 'pip' && (
                  <div className="p-3 rounded-lg bg-[var(--editor-bg-surface)] border border-[var(--editor-border-subtle)]">
                    <div className="text-sm font-medium text-[var(--editor-text-primary)] mb-2">
                      Video Position
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { value: 'top-left', label: 'Top Left' },
                        { value: 'top-right', label: 'Top Right' },
                        { value: 'bottom-left', label: 'Bottom Left' },
                        { value: 'bottom-right', label: 'Bottom Right' },
                      ].map((option) => (
                        <button
                          key={option.value}
                          onClick={() => setPipPosition(option.value as PipPosition)}
                          className={`px-3 py-2 text-xs rounded-md transition-colors ${
                            pipPosition === option.value
                              ? 'bg-[var(--editor-accent)] text-[var(--editor-bg-base)]'
                              : 'bg-[var(--editor-bg-hover)] text-[var(--editor-text-secondary)] hover:bg-[var(--editor-bg-elevated)]'
                          }`}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                    <div className="mt-3">
                      <div className="flex justify-between text-xs text-[var(--editor-text-muted)] mb-1">
                        <span>Video Size</span>
                        <span>{pipSize}%</span>
                      </div>
                      <input
                        type="range"
                        min="15"
                        max="50"
                        value={pipSize}
                        onChange={(e) => setPipSize(Number(e.target.value))}
                        className="w-full accent-[var(--editor-accent)]"
                      />
                    </div>
                  </div>
                )}

                {/* Output info */}
                <div className="flex items-center justify-between p-3 rounded-lg bg-[var(--editor-bg-surface)] border border-[var(--editor-border-subtle)]">
                  <div className="flex items-center gap-3">
                    <Settings className="w-4 h-4 text-[var(--editor-text-muted)]" />
                    <div>
                      <div className="text-sm font-medium text-[var(--editor-text-primary)]">
                        Output
                      </div>
                      <div className="text-xs text-[var(--editor-text-muted)]">
                        MP4 (H.264) • High Quality
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <button
                  onClick={handleStartExport}
                  disabled={projectStatus !== 'ready'}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg
                             bg-[var(--editor-accent)] text-[var(--editor-bg-base)] font-medium
                             hover:bg-[var(--editor-accent-hover)] transition-colors
                             disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Download className="w-4 h-4" />
                  Start Export
                </button>
                {projectStatus !== 'ready' && (
                  <p className="mt-2 text-xs text-amber-500 text-center">
                    Project status: {projectStatus}. Export requires "ready" status.
                  </p>
                )}
              </div>
            </>
          )}

          {/* Rendering State - Show progress */}
          {exportState === 'rendering' && (
            <div className="space-y-4">
              <div className="flex flex-col items-center gap-4 py-4">
                <div className="relative">
                  <div className="w-16 h-16 rounded-full border-4 border-[var(--editor-border-default)]">
                    <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                      <circle
                        cx="50"
                        cy="50"
                        r="42"
                        fill="none"
                        stroke="var(--editor-accent)"
                        strokeWidth="8"
                        strokeLinecap="round"
                        strokeDasharray={`${progress * 2.64} 264`}
                        className="transition-all duration-300"
                      />
                    </svg>
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-lg font-semibold text-[var(--editor-text-primary)]">
                      {progress}%
                    </span>
                  </div>
                </div>

                <div className="text-center">
                  <div className="text-sm font-medium text-[var(--editor-text-primary)]">
                    Exporting...
                  </div>
                  <div className="text-xs text-[var(--editor-text-muted)] mt-1">
                    {statusMessage || 'Processing your video'}
                  </div>
                </div>
              </div>

              <div className="w-full bg-[var(--editor-bg-surface)] rounded-full h-2 overflow-hidden">
                <div
                  className="h-full bg-[var(--editor-accent)] transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Complete State - Show download */}
          {exportState === 'complete' && (
            <div className="space-y-4">
              <div className="flex flex-col items-center gap-3 py-4">
                <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center">
                  <CheckCircle className="w-8 h-8 text-emerald-500" />
                </div>
                <div className="text-center">
                  <div className="text-sm font-medium text-[var(--editor-text-primary)]">
                    Export Complete!
                  </div>
                  <div className="text-xs text-[var(--editor-text-muted)] mt-1">
                    Your video is ready to download
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleDownload}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg
                             bg-[var(--editor-accent)] text-[var(--editor-bg-base)] font-medium
                             hover:bg-[var(--editor-accent-hover)] transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Download Video
                </button>
                <button
                  onClick={handleExportAgain}
                  className="px-4 py-2.5 rounded-lg
                             bg-[var(--editor-bg-surface)] text-[var(--editor-text-secondary)] font-medium
                             hover:bg-[var(--editor-bg-hover)] transition-colors
                             border border-[var(--editor-border-default)]"
                >
                  Export Again
                </button>
              </div>
            </div>
          )}

          {/* Error State */}
          {exportState === 'error' && (
            <div className="space-y-4">
              <div className="flex flex-col items-center gap-3 py-4">
                <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center">
                  <AlertCircle className="w-8 h-8 text-red-500" />
                </div>
                <div className="text-center">
                  <div className="text-sm font-medium text-[var(--editor-text-primary)]">
                    Export Failed
                  </div>
                  <div className="text-xs text-red-400 mt-1">
                    {error || 'An error occurred during export'}
                  </div>
                </div>
              </div>

              <button
                onClick={handleExportAgain}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg
                           bg-[var(--editor-bg-surface)] text-[var(--editor-text-primary)] font-medium
                           hover:bg-[var(--editor-bg-hover)] transition-colors
                           border border-[var(--editor-border-default)]"
              >
                Try Again
              </button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
