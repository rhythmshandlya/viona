'use client';

import type { JSX } from 'react';

export interface PipelineEventBlock {
  type: 'pipeline_event';
  eventType:
    | 'transcribing' | 'transcribed'
    | 'analyzing' | 'analyzed'
    | 'arranging' | 'arranged'
    | 'ready';
  details: Record<string, unknown>;
  ts: string;
}

type Variant = 'progress' | 'done' | 'error';

function variantFor(evt: PipelineEventBlock): Variant {
  switch (evt.eventType) {
    case 'transcribing':
    case 'analyzing':
    case 'arranging':
      return 'progress';
    case 'arranged':
      return evt.details.ok === false ? 'error' : 'done';
    default:
      return 'done';
  }
}

function labelFor(evt: PipelineEventBlock): string {
  const filename = typeof evt.details.filename === 'string' ? evt.details.filename : null;
  switch (evt.eventType) {
    case 'transcribing':
      return filename ? `Transcribing ${filename}` : 'Transcribing';
    case 'transcribed': {
      const wc = typeof evt.details.wordCount === 'number' ? evt.details.wordCount : null;
      return wc != null ? `Transcribed (${wc} words)` : 'Transcribed';
    }
    case 'analyzing': return 'Analyzing content';
    case 'analyzed': return 'Analyzed';
    case 'arranging': return 'Arranging timeline';
    case 'arranged': {
      if (evt.details.ok === false) {
        const err = typeof evt.details.error === 'string' ? evt.details.error : 'unknown error';
        return `Arrangement failed: ${err}`;
      }
      const n = typeof evt.details.itemCount === 'number' ? evt.details.itemCount : null;
      return n != null ? `Arranged ${n} items` : 'Arranged';
    }
    case 'ready': return 'Ready to edit';
  }
}

function Icon({ variant }: { variant: Variant }): JSX.Element {
  if (variant === 'progress') {
    return <span className="inline-block h-3 w-3 animate-spin rounded-full border border-current border-t-transparent" aria-hidden />;
  }
  if (variant === 'done') return <span className="text-green-500" aria-hidden>✓</span>;
  return <span className="text-red-500" aria-hidden>!</span>;
}

export function PipelineBubble({ content }: { content: PipelineEventBlock[] }): JSX.Element {
  return (
    <div className="flex flex-col gap-1 text-xs text-muted-foreground">
      {content.map((evt, i) => {
        const v = variantFor(evt);
        return (
          <div
            key={i}
            role={v === 'progress' ? 'status' : undefined}
            className="flex items-center gap-2"
          >
            <Icon variant={v} />
            <span>{labelFor(evt)}</span>
          </div>
        );
      })}
    </div>
  );
}
