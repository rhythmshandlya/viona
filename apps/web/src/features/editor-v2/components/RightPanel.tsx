/**
 * RightPanel Component
 * Single scrollable inspector when an item is selected
 */

'use client';

import React from 'react';
import { X } from 'lucide-react';
import { TranscriptPanel } from '../panels';
import { ItemInspector } from './inspector/ItemInspector';
import { KeyframeEditor } from './keyframe-editor/KeyframeEditor';

export type RightPanelTab = 'properties' | 'transcript' | 'item-properties';

interface RightPanelProps {
  isOpen: boolean;
  activeTab: RightPanelTab;
  onTabChange: (tab: RightPanelTab) => void;
  onClose: () => void;
  layout?: 'stacked' | 'side-by-side';
  embedded?: boolean;
  view?: 'inspector' | 'transcript';
}

export function RightPanel({ isOpen, activeTab, onTabChange, onClose, layout = 'stacked', embedded = false, view = 'inspector' }: RightPanelProps) {
  const isSideBySide = layout === 'side-by-side';

  // Embedded mode — used when RightPanel is hosted inside the left sidebar (Captions tab)
  if (embedded) {
    return (
      <div className="flex-1 overflow-y-auto -mx-4 -mt-3">
        <TranscriptPanel />
      </div>
    );
  }

  return (
    <div
      className={isSideBySide
        ? "w-full h-full overflow-hidden bg-[var(--editor-bg-surface)]"
        : "flex-shrink-0 overflow-hidden editor-panel"
      }
      style={isSideBySide ? undefined : {
        width: isOpen ? (view === 'transcript' ? 420 : 320) : 0,
        transition: 'width 150ms ease-out',
      }}
    >
      {/* Inner wrapper */}
      <div className="w-full h-full flex flex-col">
        {/* Close button header */}
        {!isSideBySide && (
          <div className="h-10 flex items-center justify-end border-b border-white/[0.06] flex-shrink-0 px-2">
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-white/[0.06] transition-colors"
              aria-label="Close panel"
            >
              <X className="w-3.5 h-3.5 text-[var(--editor-text-secondary)]" />
            </button>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto scrollbar-hide">
          {view === 'transcript' ? (
            <TranscriptPanel />
          ) : (
            <>
              <ItemInspector />
              <KeyframeEditor />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
