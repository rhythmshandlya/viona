/**
 * RightPanel Component
 * Collapsible right panel with tabbed content (Transcript / Properties)
 */

'use client';

import React from 'react';
import { X } from 'lucide-react';
import { TranscriptPanel } from '../panels/TranscriptPanel';
import { PropertiesContent } from './ContextPanel';

export type RightPanelTab = 'properties' | 'transcript';

interface RightPanelProps {
  isOpen: boolean;
  activeTab: RightPanelTab;
  onTabChange: (tab: RightPanelTab) => void;
  onClose: () => void;
}

export function RightPanel({ isOpen, activeTab, onTabChange, onClose }: RightPanelProps) {
  return (
    <div
      className="flex-shrink-0 border-l border-[var(--editor-border-subtle)] overflow-hidden bg-[var(--editor-bg-surface)]"
      style={{
        width: isOpen ? 320 : 0,
        transition: 'width 150ms ease-out',
      }}
    >
      {/* Inner wrapper with fixed width so content doesn't reflow during transition */}
      <div className="w-80 h-full flex flex-col">
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
          </div>
          <button
            onClick={onClose}
            className="p-1.5 mr-1.5 rounded hover:bg-[var(--editor-bg-hover)] transition-colors"
            aria-label="Close panel"
          >
            <X className="w-3.5 h-3.5 text-[var(--editor-text-secondary)]" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {activeTab === 'transcript' ? <TranscriptPanel /> : <PropertiesContent />}
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
      className={`px-4 h-full text-xs font-medium transition-colors relative ${
        isActive
          ? 'text-[var(--editor-text-primary)]'
          : 'text-[var(--editor-text-muted)] hover:text-[var(--editor-text-secondary)]'
      }`}
    >
      {label}
      {isActive && (
        <div className="absolute bottom-0 left-2 right-2 h-0.5 bg-[var(--editor-accent)] rounded-full" />
      )}
    </button>
  );
}
