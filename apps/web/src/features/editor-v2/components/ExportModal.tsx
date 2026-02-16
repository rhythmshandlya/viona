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
import { useLayoutSettings, useEditorActions } from '../store/use-editor-store';

interface ExportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  projectStatus: string;
  hasOutputKey: boolean;
}

type ExportState = 'idle' | 'rendering' | 'complete' | 'error';

export function ExportModal({
  open,
  onOpenChange,
  projectId,
  projectStatus,
  hasOutputKey,
}: ExportModalProps) {
  const layoutSettings = useLayoutSettings();
  const { saveProject } = useEditorActions();
  const [exportState, setExportState] = useState<ExportState>('idle');
  const [jobId, setJobId] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [wantsNewExport, setWantsNewExport] = useState(false);

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
    if (open && hasOutputKey && exportState === 'idle' && !wantsNewExport) {
      // Project already has a rendered output
      api.getDownloadUrl(projectId).then(({ url }) => {
        setDownloadUrl(url);
        setExportState('complete');
      }).catch(() => {
        // No output available
      });
    }
  }, [open, hasOutputKey, exportState, projectId, wantsNewExport]);

  // Reset state when modal closes
  useEffect(() => {
    if (!open) {
      // Reset wantsNewExport so next open will check for existing output
      setWantsNewExport(false);
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
    setExportState('rendering');
    setProgress(0);
    setStatusMessage('Saving project...');
    setError(null);
    setDownloadUrl(null);

    try {
      // Save project first to ensure caption styles are persisted to database
      await saveProject();

      setStatusMessage('Starting export...');
      // Pass layoutSettings to render API for exact preview match
      const { jobId: newJobId } = await api.renderProject(projectId, { layoutSettings });
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
    setWantsNewExport(true);
    setExportState('idle');
    setJobId(null);
    setProgress(0);
    setStatusMessage('');
    setError(null);
    setDownloadUrl(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-white border-gray-200">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-gray-900">
            <Film className="w-5 h-5 text-violet-500" />
            Export Video
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Idle State - Show export options */}
          {exportState === 'idle' && (
            <>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50 border border-gray-200">
                  <div className="flex items-center gap-3">
                    <Settings className="w-4 h-4 text-gray-400" />
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        Output Format
                      </div>
                      <div className="text-xs text-gray-500">
                        MP4 (H.264)
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50 border border-gray-200">
                  <div className="flex items-center gap-3">
                    <Settings className="w-4 h-4 text-gray-400" />
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        Quality
                      </div>
                      <div className="text-xs text-gray-500">
                        High (Original Resolution)
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <button
                  onClick={handleStartExport}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg
                             bg-violet-500 text-white font-medium
                             hover:bg-violet-600 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Start Export
                </button>
              </div>
            </>
          )}

          {/* Rendering State - Show progress */}
          {exportState === 'rendering' && (
            <div className="space-y-4">
              <div className="flex flex-col items-center gap-4 py-4">
                <div className="relative">
                  <div className="w-16 h-16 rounded-full border-4 border-gray-200">
                    <svg className="w-full h-full -rotate-90 text-primary" viewBox="0 0 100 100">
                      <circle
                        cx="50"
                        cy="50"
                        r="42"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="8"
                        strokeLinecap="round"
                        strokeDasharray={`${progress * 2.64} 264`}
                        className="transition-all duration-300"
                      />
                    </svg>
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-lg font-semibold text-gray-900">
                      {progress}%
                    </span>
                  </div>
                </div>

                <div className="text-center">
                  <div className="text-sm font-medium text-gray-900">
                    Exporting...
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {statusMessage || 'Processing your video'}
                  </div>
                </div>
              </div>

              <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                <div
                  className="h-full bg-violet-500 transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Complete State - Show download */}
          {exportState === 'complete' && (
            <div className="space-y-4">
              <div className="flex flex-col items-center gap-3 py-4">
                <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center">
                  <CheckCircle className="w-8 h-8 text-green-600" />
                </div>
                <div className="text-center">
                  <div className="text-sm font-medium text-gray-900">
                    Export Complete!
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    Your video is ready to download
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleDownload}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg
                             bg-green-600 text-white font-medium
                             hover:bg-green-700 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Download Video
                </button>
                <button
                  onClick={handleExportAgain}
                  className="px-4 py-2.5 rounded-lg
                             bg-white text-gray-700 font-medium
                             hover:bg-gray-100 transition-colors
                             border border-gray-300"
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
                <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center">
                  <AlertCircle className="w-8 h-8 text-red-500" />
                </div>
                <div className="text-center">
                  <div className="text-sm font-medium text-gray-900">
                    Export Failed
                  </div>
                  <div className="text-xs text-red-600 mt-1">
                    {error || 'An error occurred during export'}
                  </div>
                </div>
              </div>

              <button
                onClick={handleExportAgain}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg
                           bg-violet-500 text-white font-medium
                           hover:bg-violet-600 transition-colors"
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
