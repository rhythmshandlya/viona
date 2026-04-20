import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ChatDropZone } from './ChatDropZone';

describe('ChatDropZone', () => {
  it('shows overlay on dragenter with Files', () => {
    const onFiles = vi.fn();
    const { container } = render(<ChatDropZone onFilesDropped={onFiles}>inner</ChatDropZone>);
    const drop = container.firstChild as HTMLElement;

    fireEvent.dragEnter(drop, { dataTransfer: { types: ['Files'], files: [] } });
    expect(screen.getByTestId('chat-drop-overlay')).toBeInTheDocument();
  });

  it('calls onFilesDropped with files', () => {
    const onFiles = vi.fn();
    const { container } = render(<ChatDropZone onFilesDropped={onFiles}>inner</ChatDropZone>);
    const drop = container.firstChild as HTMLElement;
    const file = new File(['x'], 'x.png', { type: 'image/png' });

    fireEvent.drop(drop, { dataTransfer: { types: ['Files'], files: [file] } });
    expect(onFiles).toHaveBeenCalledWith([file]);
  });

  it('does not activate for non-file drags', () => {
    const { container } = render(<ChatDropZone onFilesDropped={vi.fn()}>inner</ChatDropZone>);
    const drop = container.firstChild as HTMLElement;
    fireEvent.dragEnter(drop, { dataTransfer: { types: ['text/plain'], files: [] } });
    expect(screen.queryByTestId('chat-drop-overlay')).not.toBeInTheDocument();
  });
});
