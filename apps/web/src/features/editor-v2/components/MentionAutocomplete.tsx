/**
 * MentionAutocomplete
 * Dropdown component for @-mentioning assets in chat input
 */

'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Image, Film, Music, Layers, Search } from 'lucide-react';
import { api, ProjectMediaAsset } from '@/lib/api';
import useUploadStore from '@/store/use-upload-store';

interface GlobalUpload {
  fileName: string;
  filePath: string;
  fileSize: number;
  contentType: string;
  metadata?: { uploadedUrl?: string; originalUrl?: string };
  type: string;
}

export interface MentionItem {
  id: string;
  type: 'project-asset' | 'global-upload';
  name: string;
  label?: string;
  description?: string;
  contentType: string;
  url?: string;
}

interface MentionAutocompleteProps {
  projectId: string;
  query: string;
  position: { top: number; left: number };
  onSelect: (item: MentionItem) => void;
  onClose: () => void;
  visible: boolean;
}

function getAssetIcon(contentType: string) {
  if (contentType.startsWith('video/')) return Film;
  if (contentType.startsWith('audio/')) return Music;
  if (contentType.startsWith('image/')) return Image;
  return Layers;
}

function getAssetColor(contentType: string) {
  if (contentType.startsWith('video/')) return 'text-indigo-400';
  if (contentType.startsWith('audio/')) return 'text-emerald-400';
  if (contentType.startsWith('image/')) return 'text-blue-400';
  return 'text-gray-400';
}

export function MentionAutocomplete({
  projectId,
  query,
  position,
  onSelect,
  onClose,
  visible,
}: MentionAutocompleteProps) {
  const [projectAssets, setProjectAssets] = useState<ProjectMediaAsset[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  // Global uploads from store
  const globalUploads = useUploadStore((state) => state.uploads) as GlobalUpload[];

  // Fetch project assets
  useEffect(() => {
    if (!projectId || !visible) return;

    let cancelled = false;
    setLoading(true);

    api.getProjectMedia(projectId)
      .then(({ assets }) => {
        if (!cancelled) {
          setProjectAssets(assets);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [projectId, visible]);

  // Combine and filter items
  const allItems: MentionItem[] = React.useMemo(() => {
    const items: MentionItem[] = [];

    // Add project assets
    for (const asset of projectAssets) {
      items.push({
        id: asset.id,
        type: 'project-asset',
        name: asset.filename,
        label: asset.label || undefined,
        description: asset.description || undefined,
        contentType: asset.mimeType,
        url: asset.url,
      });
    }

    // Add global uploads
    for (let i = 0; i < globalUploads.length; i++) {
      const upload = globalUploads[i];
      items.push({
        id: `global-${i}`,
        type: 'global-upload',
        name: upload.fileName,
        contentType: upload.contentType,
        url: upload.metadata?.uploadedUrl || upload.metadata?.originalUrl,
      });
    }

    return items;
  }, [projectAssets, globalUploads]);

  // Filter by query
  const filteredItems = React.useMemo(() => {
    if (!query) return allItems;
    const lowerQuery = query.toLowerCase();
    return allItems.filter(item => {
      const searchText = (item.label || item.name).toLowerCase();
      return searchText.includes(lowerQuery);
    });
  }, [allItems, query]);

  // Reset selection when items change
  useEffect(() => {
    setSelectedIndex(0);
  }, [filteredItems.length, query]);

  // Keyboard navigation
  useEffect(() => {
    if (!visible) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        e.stopPropagation();
        setSelectedIndex(prev => Math.min(prev + 1, filteredItems.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        e.stopPropagation();
        setSelectedIndex(prev => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter' && filteredItems.length > 0) {
        e.preventDefault();
        e.stopPropagation();
        onSelect(filteredItems[selectedIndex]);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [visible, filteredItems, selectedIndex, onSelect, onClose]);

  // Scroll selected item into view
  useEffect(() => {
    if (!listRef.current) return;
    const selectedEl = listRef.current.children[selectedIndex] as HTMLElement;
    if (selectedEl) {
      selectedEl.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  if (!visible) return null;

  return (
    <div
      className="absolute z-50 w-72 max-h-64 overflow-hidden rounded-lg border border-[var(--editor-border-default)]
                 bg-[var(--editor-bg-elevated)] shadow-xl"
      style={{ bottom: position.top, left: position.left }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--editor-border-subtle)]">
        <Search className="w-3.5 h-3.5 text-[var(--editor-text-muted)]" />
        <span className="text-xs text-[var(--editor-text-muted)]">
          {query ? `Searching "${query}"` : 'Type to search assets'}
        </span>
      </div>

      {/* Items list */}
      <div ref={listRef} className="overflow-y-auto max-h-48">
        {loading ? (
          <div className="px-3 py-4 text-center">
            <span className="text-xs text-[var(--editor-text-muted)]">Loading assets...</span>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="px-3 py-4 text-center">
            <span className="text-xs text-[var(--editor-text-muted)]">
              {allItems.length === 0 ? 'No assets uploaded' : 'No matching assets'}
            </span>
          </div>
        ) : (
          filteredItems.map((item, index) => {
            const Icon = getAssetIcon(item.contentType);
            const colorClass = getAssetColor(item.contentType);
            const isSelected = index === selectedIndex;
            const displayName = item.label || item.name;

            return (
              <button
                key={item.id}
                onClick={() => onSelect(item)}
                onMouseEnter={() => setSelectedIndex(index)}
                className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors
                           ${isSelected
                             ? 'bg-[var(--editor-accent-soft)]'
                             : 'hover:bg-[var(--editor-bg-hover)]'
                           }`}
              >
                {/* Thumbnail or icon */}
                <div className="w-8 h-8 rounded flex items-center justify-center bg-[var(--editor-bg-hover)] overflow-hidden flex-shrink-0">
                  {item.contentType.startsWith('image/') && item.url ? (
                    <img src={item.url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <Icon className={`w-4 h-4 ${colorClass}`} />
                  )}
                </div>

                {/* Name and type */}
                <div className="flex-1 min-w-0">
                  <div className={`text-sm truncate ${isSelected ? 'text-[var(--editor-accent)]' : 'text-[var(--editor-text-primary)]'}`}>
                    {displayName}
                  </div>
                  {item.description ? (
                    <div className="text-[10px] text-[var(--editor-text-muted)] truncate">
                      {item.description}
                    </div>
                  ) : (
                    <div className="text-[10px] text-[var(--editor-text-muted)] flex items-center gap-1">
                      <span className="capitalize">{item.contentType.split('/')[0]}</span>
                      {item.type === 'global-upload' && (
                        <span className="px-1 py-0.5 rounded bg-[var(--editor-bg-hover)] text-[9px]">Library</span>
                      )}
                    </div>
                  )}
                </div>
              </button>
            );
          })
        )}
      </div>

      {/* Footer hint */}
      {filteredItems.length > 0 && (
        <div className="px-3 py-1.5 border-t border-[var(--editor-border-subtle)] bg-[var(--editor-bg-surface)]">
          <span className="text-[10px] text-[var(--editor-text-muted)]">
            ↑↓ to navigate · Enter to select · Esc to close
          </span>
        </div>
      )}
    </div>
  );
}
