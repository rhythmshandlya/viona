/**
 * RightPanel Component
 * Collapsible right panel with tabbed content (Transcript / Properties)
 */

'use client';

import React from 'react';
import { X } from 'lucide-react';
import { TranscriptPanel, PiPControlPanel } from '../panels';
import { PropertiesContent } from './ContextPanel';

export type RightPanelTab = 'properties' | 'transcript' | 'layout';

interface RightPanelProps {
  isOpen: boolean;
  activeTab: RightPanelTab;
  onTabChange: (tab: RightPanelTab) => void;
  onClose: () => void;
  layout?: 'stacked' | 'side-by-side';
}

export function RightPanel({ isOpen, activeTab, onTabChange, onClose, layout = 'stacked' }: RightPanelProps) {
  const isSideBySide = layout === 'side-by-side';

  return (
    <div
      className={isSideBySide
        ? "w-full h-full overflow-hidden bg-[var(--editor-bg-surface)]"
        : "flex-shrink-0 border-l border-[var(--editor-border-subtle)] overflow-hidden bg-[var(--editor-bg-surface)]"
      }
      style={isSideBySide ? undefined : {
        width: isOpen ? 320 : 0,
        transition: 'width 150ms ease-out',
      }}
    >
      {/* Inner wrapper */}
      <div className={isSideBySide ? "w-full h-full flex flex-col" : "w-80 h-full flex flex-col"}>
        {/* Tab header */}
        <div className="h-10 flex items-center border-b border-[var(--editor-border-subtle)] flex-shrink-0">
          <div className="flex-1 flex">
            <TabButton
              label="Transcript"
              isActive={activeTab === 'transcript'}
              onClick={() => onTabChange('transcript')}
            />
            <TabButton
              label="Properties"
              isActive={activeTab === 'properties'}
              onClick={() => onTabChange('properties')}
            />
            <TabButton
              label="Layout"
              isActive={activeTab === 'layout'}
              onClick={() => onTabChange('layout')}
            />
          </div>
          {!isSideBySide && (
            <button
              onClick={onClose}
              className="p-1.5 mr-1.5 rounded hover:bg-[var(--editor-bg-hover)] transition-colors"
              aria-label="Close panel"
            >
              <X className="w-3.5 h-3.5 text-[var(--editor-text-secondary)]" />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === 'transcript' && <TranscriptPanel />}
          {activeTab === 'properties' && <PropertiesContent />}
          {activeTab === 'layout' && <PiPControlPanel />}
        </div>
      </div>
    </div>
  );
}

function TabButton({
  label,
  isActive,
  onClick,
}: {
  label: string;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 h-full text-xs transition-colors ${
        isActive
          ? 'text-[var(--editor-text-primary)] font-semibold'
          : 'text-[var(--editor-text-muted)] font-medium hover:text-[var(--editor-text-secondary)]'
      }`}
    >
      {label}
    </button>
  );
}
