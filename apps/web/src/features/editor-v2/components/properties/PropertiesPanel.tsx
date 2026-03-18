'use client';

import React, { useState } from 'react';
import { TransformTab } from './TransformTab';
import { FiltersTab } from './FiltersTab';
import { DataTab } from './DataTab';
import { useSingleSelectedItem } from '../../store/use-editor-store';

type PropertyTab = 'transform' | 'filters' | 'data';

export function PropertiesPanel() {
  const item = useSingleSelectedItem();
  const [activeTab, setActiveTab] = useState<PropertyTab>('transform');

  if (!item) return null;

  const typeLabel = item.type.charAt(0).toUpperCase() + item.type.slice(1);
  const truncatedId = item.id.length > 8 ? item.id.slice(0, 8) + '…' : item.id;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-2 border-b border-[var(--editor-border-subtle)]">
        <span className="text-xs font-normal text-[var(--editor-text-primary)]">
          {typeLabel}
        </span>
        <span className="text-xs text-[var(--editor-text-muted)] ml-1.5">
          {truncatedId}
        </span>
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-[var(--editor-border-subtle)]">
        {(['transform', 'filters', 'data'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 px-3 py-1.5 text-xs font-normal transition-colors ${
              activeTab === tab
                ? 'text-[var(--editor-text-primary)] border-b-2 border-purple-500'
                : 'text-[var(--editor-text-muted)] hover:text-[var(--editor-text-secondary)]'
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'transform' && <TransformTab item={item} />}
        {activeTab === 'filters' && <FiltersTab item={item} />}
        {activeTab === 'data' && <DataTab item={item} />}
      </div>
    </div>
  );
}
