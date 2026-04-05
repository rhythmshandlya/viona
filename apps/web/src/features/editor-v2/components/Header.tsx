/**
 * Editor Header Component
 * Glassmorphism header with back, title, export
 */

'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Download,
  Terminal,
  ChevronDown,
  Loader2,
  CheckCircle,
} from 'lucide-react';
import { useProject, useProjectActions, useIsSaving, useExportState, useExportProgress } from '../store/use-editor-store';
import { ExportDropdown } from './ExportDropdown';
import { api } from '@/lib/api';

interface HeaderProps {
  onOpenCommandPalette?: () => void;
  onExport?: () => void;
  onToggleTranscript?: () => void;
  isTranscriptActive?: boolean;
  layout?: 'stacked' | 'side-by-side';
  onToggleLayout?: () => void;
  onToggleLogs?: () => void;
  isLogsActive?: boolean;
  hasActiveJob?: boolean;
}

const TOOLBAR_BTN = "w-9 h-9 flex items-center justify-center rounded-[10px] glass-btn text-[var(--editor-text-secondary)] hover:text-[var(--editor-text-primary)]";
const TOOLBAR_BTN_ACTIVE = "w-9 h-9 flex items-center justify-center rounded-[10px] glass-btn active text-[var(--editor-accent)]";

export function Header({
  onExport,
  onToggleLogs,
  isLogsActive,
  hasActiveJob,
}: HeaderProps) {
  const router = useRouter();
  const project = useProject();
  const { saveProject } = useProjectActions();
  const isSaving = useIsSaving();
  const exportState = useExportState();
  const { progress: exportProgress } = useExportProgress();

  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [title, setTitle] = useState('Untitled Project');
  const [showExportDropdown, setShowExportDropdown] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const exportBtnRef = useRef<HTMLButtonElement>(null);
  const savedRef = useRef(false);

  useEffect(() => {
    if (project?.title) {
      setTitle(project.title);
    }
  }, [project?.title]);

  useEffect(() => {
    if (isEditingTitle && inputRef.current) {
      savedRef.current = false;
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditingTitle]);

  const saveTitle = () => {
    if (savedRef.current) return;
    savedRef.current = true;
    if (project && title.trim()) {
      api.updateProject(project.id, { title: title.trim() }).catch(() => {});
    }
  };

  const handleTitleBlur = () => {
    setIsEditingTitle(false);
    saveTitle();
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); saveTitle(); setIsEditingTitle(false); }
    if (e.key === 'Escape') { setTitle(project?.title || ''); setIsEditingTitle(false); }
  };

  return (
    <header
      className="h-12 flex items-center px-3 mx-[var(--editor-panel-gap)] mt-[var(--editor-panel-gap)] editor-panel"
    >
      {/* Left: Back */}
      <div className="flex items-center gap-1">
        <button
          onClick={() => router.push('/')}
          className={TOOLBAR_BTN}
          title="Back to Projects"
        >
          <ArrowLeft className="w-[18px] h-[18px]" />
        </button>
      </div>

      {/* Center: Title with dropdown */}
      <div className="flex-1 flex items-center justify-center min-w-0">
        {isEditingTitle ? (
          <input
            ref={inputRef}
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={handleTitleBlur}
            onKeyDown={handleTitleKeyDown}
            className="bg-[var(--editor-bg-elevated)] text-[var(--editor-text-primary)] text-sm font-normal
                       border border-[var(--editor-border-default)] rounded-md px-3 py-1
                       focus:outline-none focus:border-[var(--editor-border-focus)] focus:ring-2 focus:ring-[var(--editor-accent-soft)]"
          />
        ) : (
          <button
            onClick={() => setIsEditingTitle(true)}
            className="flex items-center gap-1.5 text-[var(--editor-text-primary)] text-sm font-normal px-3 py-1
                       rounded-md hover:bg-[var(--editor-bg-hover)] transition-colors truncate max-w-[300px]"
          >
            <span className="truncate">{title}</span>
            <ChevronDown className="w-3.5 h-3.5 text-[var(--editor-text-muted)] flex-shrink-0" />
          </button>
        )}
        {isSaving && (
          <span className="text-xs text-[var(--editor-text-muted)] ml-2">Saving...</span>
        )}
      </div>

      {/* Right: Logs + Export */}
      <div className="flex items-center gap-1">
        {(hasActiveJob || isLogsActive) && (
          <button
            onClick={() => onToggleLogs?.()}
            title="Toggle Agent Logs"
            className={isLogsActive ? TOOLBAR_BTN_ACTIVE : TOOLBAR_BTN}
          >
            <Terminal className="w-[18px] h-[18px]" />
            {hasActiveJob && !isLogsActive && (
              <span className="absolute top-1 right-1 w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
            )}
          </button>
        )}

        <div className="relative">
          <button
            ref={exportBtnRef}
            onClick={() => setShowExportDropdown(!showExportDropdown)}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-sm font-normal
                       text-white active:scale-[0.97] transition-all
                       shadow-[0_2px_12px_rgba(139,92,246,0.3),inset_0_1px_0_rgba(255,255,255,0.15)]
                       ${exportState === 'complete'
                         ? 'bg-emerald-600 hover:bg-emerald-700'
                         : 'bg-[var(--editor-accent)] hover:bg-[var(--editor-accent-hover)]'
                       }`}
          >
            {exportState === 'rendering' ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>{exportProgress}%</span>
              </>
            ) : exportState === 'complete' ? (
              <>
                <CheckCircle className="w-4 h-4" />
                <span>Download</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                <span>Export</span>
              </>
            )}
            <ChevronDown className="w-3 h-3 opacity-60" />
          </button>

          <ExportDropdown
            open={showExportDropdown}
            onOpenChange={setShowExportDropdown}
            anchorRef={exportBtnRef}
          />
        </div>
      </div>
    </header>
  );
}
