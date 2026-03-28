'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

interface InspectorSectionProps {
  label: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

export function InspectorSection({ label, defaultOpen = true, children }: InspectorSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const contentRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | undefined>(undefined);

  useEffect(() => {
    if (contentRef.current) {
      setHeight(contentRef.current.scrollHeight);
    }
  }, [children]);

  return (
    <div className="border-b border-[var(--editor-border-subtle)]">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-2 hover:bg-white/[0.03] transition-colors"
      >
        <span className="text-[10px] font-normal uppercase tracking-wider text-[var(--editor-text-muted)]">
          {label}
        </span>
        <ChevronDown
          className="w-3.5 h-3.5 text-[var(--editor-text-muted)] transition-transform duration-200"
          style={{ transform: open ? 'rotate(0deg)' : 'rotate(-90deg)' }}
        />
      </button>
      <div
        style={{
          maxHeight: open ? (height ?? 1000) : 0,
          overflow: 'hidden',
          transition: 'max-height 200ms ease-out',
        }}
      >
        <div ref={contentRef} className="px-3 pb-3">
          {children}
        </div>
      </div>
    </div>
  );
}
