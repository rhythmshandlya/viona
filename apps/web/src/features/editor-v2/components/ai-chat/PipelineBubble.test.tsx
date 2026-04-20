import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PipelineBubble } from './PipelineBubble';

describe('PipelineBubble', () => {
  it('renders a progress indicator + label for transcribing', () => {
    render(<PipelineBubble content={[{
      type: 'pipeline_event',
      eventType: 'transcribing',
      details: { assetId: 'a-1', filename: 'hero.mp4' },
      ts: '2026-04-20T00:00:00Z',
    }]} />);
    expect(screen.getByText(/Transcribing/i)).toBeInTheDocument();
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('renders transcribed with word count', () => {
    render(<PipelineBubble content={[{
      type: 'pipeline_event',
      eventType: 'transcribed',
      details: { assetId: 'a-1', wordCount: 42 },
      ts: '2026-04-20T00:00:00Z',
    }]} />);
    expect(screen.getByText(/Transcribed/i)).toBeInTheDocument();
    expect(screen.getByText(/42 words/i)).toBeInTheDocument();
  });

  it('renders error variant when arranged ok:false', () => {
    render(<PipelineBubble content={[{
      type: 'pipeline_event',
      eventType: 'arranged',
      details: { ok: false, error: 'boom' },
      ts: '2026-04-20T00:00:00Z',
    }]} />);
    expect(screen.getByText(/Arrangement failed/i)).toBeInTheDocument();
    expect(screen.getByText(/boom/i)).toBeInTheDocument();
  });

  it('renders success with itemCount when arranged ok:true', () => {
    render(<PipelineBubble content={[{
      type: 'pipeline_event',
      eventType: 'arranged',
      details: { ok: true, itemCount: 7 },
      ts: '2026-04-20T00:00:00Z',
    }]} />);
    expect(screen.getByText(/Arranged 7 items/i)).toBeInTheDocument();
  });
});
