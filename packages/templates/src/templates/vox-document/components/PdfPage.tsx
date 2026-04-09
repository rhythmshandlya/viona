import React, { useState, useCallback } from 'react';
import { delayRender, continueRender, cancelRender, staticFile } from 'remotion';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/TextLayer.css';
import 'react-pdf/dist/Page/AnnotationLayer.css';

// Configure PDF.js worker from CDN (avoids webpack bundling issues)
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PdfPageProps {
  src: string;
  pageNumber: number;
  width: number;
  renderScale?: number;
}

/**
 * Renders a single PDF page as a <canvas> element using react-pdf.
 * Uses Remotion's delayRender/continueRender to ensure the page is
 * fully painted before the frame is captured.
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
      cancelRender(error);
    },
    [],
  );

  return (
    <Document
      file={staticFile(src)}
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
