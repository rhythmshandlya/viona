import React, { useState, useCallback } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';

// Configure PDF.js worker from CDN
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

// Remotion's delayRender/continueRender — import safely for non-Remotion envs
let delayRender: (label: string) => number = () => 0;
let continueRender: (handle: number) => void = () => {};
let cancelRender: (err: Error) => void = () => {};
try {
  const remotion = require('remotion');
  delayRender = remotion.delayRender;
  continueRender = remotion.continueRender;
  cancelRender = remotion.cancelRender;
} catch {}

interface PdfPageProps {
  src: string;
  pageNumber: number;
  width: number;
  renderScale?: number;
}

/**
 * Renders a single PDF page as a <canvas> element using react-pdf.
 * In Remotion: uses delayRender/continueRender to sync frame capture.
 * In playground: renders directly, no delay management needed.
 */
export const PdfPage: React.FC<PdfPageProps> = ({
  src,
  pageNumber,
  width,
  renderScale = 3,
}) => {
  const [handle] = useState(() => delayRender('Loading PDF page'));

  const onRenderSuccess = useCallback(() => {
    continueRender(handle);
  }, [handle]);

  const onError = useCallback(
    (error: Error) => {
      console.error('PDF render error:', error);
      try { cancelRender(error); } catch {}
    },
    [],
  );

  // URLs load directly; local paths resolve via /public/ or staticFile
  const filePath = src.startsWith('http') ? src : `/${src.replace(/^\//, '')}`;

  return (
    <Document
      file={filePath}
      onLoadError={onError}
      loading={null}
    >
      <Page
        pageNumber={pageNumber}
        width={width}
        devicePixelRatio={renderScale}
        renderTextLayer={false}
        renderAnnotationLayer={false}
        onRenderSuccess={onRenderSuccess}
        onRenderError={onError}
        loading={null}
      />
    </Document>
  );
};
