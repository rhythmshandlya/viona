'use client';
import { useCallback, useState, type DragEvent, type ReactNode, type ReactElement } from 'react';

export interface ChatDropZoneProps {
  children: ReactNode;
  onFilesDropped: (files: File[]) => void;
}

export function ChatDropZone({ children, onFilesDropped }: ChatDropZoneProps): ReactElement {
  const [active, setActive] = useState(false);

  const onDragEnter = useCallback((e: DragEvent) => {
    if (e.dataTransfer.types.includes('Files')) {
      e.preventDefault();
      setActive(true);
    }
  }, []);
  const onDragLeave = useCallback((e: DragEvent) => {
    // Deactivate only when leaving the container entirely.
    if (e.relatedTarget === null) setActive(false);
  }, []);
  const onDragOver = useCallback((e: DragEvent) => {
    if (e.dataTransfer.types.includes('Files')) e.preventDefault();
  }, []);
  const onDrop = useCallback((e: DragEvent) => {
    e.preventDefault();
    setActive(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) onFilesDropped(files);
  }, [onFilesDropped]);

  return (
    <div
      className="relative h-full w-full"
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      {children}
      {active && (
        <div
          data-testid="chat-drop-overlay"
          className="absolute inset-0 z-50 flex items-center justify-center rounded border-2 border-dashed border-primary bg-background/90 text-lg font-semibold pointer-events-none"
        >
          Drop to add to this chat
        </div>
      )}
    </div>
  );
}
