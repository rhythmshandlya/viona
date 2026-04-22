"use client";

import { useEffect, useRef, useCallback, useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import {
  Video,
  Music,
  ArrowUp,
  Paperclip,
  X,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// ============================================
// Auto-resize textarea hook
// ============================================

function useAutoResizeTextarea({
  minHeight,
  maxHeight,
}: {
  minHeight: number;
  maxHeight?: number;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const adjustHeight = useCallback(
    (reset?: boolean) => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      if (reset) {
        textarea.style.height = `${minHeight}px`;
        return;
      }

      textarea.style.height = `${minHeight}px`;
      const newHeight = Math.max(
        minHeight,
        Math.min(textarea.scrollHeight, maxHeight ?? Number.POSITIVE_INFINITY)
      );
      textarea.style.height = `${newHeight}px`;
    },
    [minHeight, maxHeight]
  );

  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) textarea.style.height = `${minHeight}px`;
  }, [minHeight]);

  return { textareaRef, adjustHeight };
}

// ============================================
// Helpers
// ============================================

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ============================================
// Types
// ============================================

export interface AnimatedAIChatProps {
  greeting?: React.ReactNode;
  onSend?: (message: string, files: File[]) => void;
  isProcessing?: boolean;
  processingMessage?: string;
  uploadProgress?: number;
  placeholder?: string;
  compact?: boolean;
  acceptFileTypes?: string;
}

// ============================================
// File Preview Card
// ============================================

/**
 * Compact square tile for an attached file. Renders in a grid so N files sit
 * in a tight block instead of N full-width strips. Thumbnail fills the tile;
 * filename is a truncated caption under it; hover reveals the remove button
 * and full name via tooltip. Upload state is a spinner / check overlay.
 */
function FilePreviewCard({
  file,
  onRemove,
  isProcessing,
  uploadProgress,
}: {
  file: File;
  onRemove: (index?: number) => void;
  isProcessing: boolean;
  uploadProgress: number;
}) {
  const previewUrl = useMemo(() => URL.createObjectURL(file), [file]);
  const isVideo = file.type.startsWith("video/");
  const isAudio = file.type.startsWith("audio/");
  const isUploading = isProcessing && uploadProgress < 100;
  const isDone = isProcessing && uploadProgress >= 100;

  useEffect(() => {
    return () => URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  return (
    <motion.div
      // `overflow-visible` so the remove (X) button — positioned with negative
      // offsets — can sit OUTSIDE the card on the top-right corner without
      // being clipped. Rounded corners + clipping move to the inner thumbnail.
      className="group relative rounded-md bg-white/[0.04] border border-white/[0.06] hover:border-white/[0.14] transition-colors w-[72px]"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.12 }}
      title={`${file.name} · ${formatFileSize(file.size)}`}
    >
      <div className="relative aspect-square w-full bg-black/40 rounded-t-md overflow-hidden">
        {isVideo ? (
          <video
            src={previewUrl}
            muted
            playsInline
            preload="metadata"
            className="w-full h-full object-cover"
            onLoadedData={(e) => {
              (e.target as HTMLVideoElement).currentTime = 0.5;
            }}
          />
        ) : isAudio ? (
          <div className="w-full h-full flex items-center justify-center bg-[#8B5CF6]/10">
            <Music className="w-4 h-4 text-[#8B5CF6]/70" />
          </div>
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-white/[0.03]">
            <Video className="w-4 h-4 text-white/40" />
          </div>
        )}

        {/* Upload state overlay */}
        {isUploading && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
            <Loader2 className="w-3.5 h-3.5 text-white animate-spin" />
          </div>
        )}
        {isDone && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          </div>
        )}
      </div>

      {/* Remove button — floats OUTSIDE the tile on the top-right corner.
          Placed at the card (outer) level so `overflow-visible` on the card
          lets it extend beyond the border. */}
      {!isProcessing && (
        <button
          onClick={onRemove}
          aria-label={`Remove ${file.name}`}
          className="absolute -top-1.5 -right-1.5 p-0.5 rounded-full bg-black/90 text-white/80 hover:text-white border border-white/20 shadow-md opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity z-10"
        >
          <X className="w-2.5 h-2.5" />
        </button>
      )}

      {/* Filename caption */}
      <div className="px-1 py-0.5">
        <p className="text-[9px] text-white/60 truncate leading-tight">
          {file.name}
        </p>
      </div>

      {/* Progress bar pinned to bottom edge during upload */}
      {isUploading && (
        <div className="absolute left-0 right-0 bottom-0 h-0.5 bg-white/[0.06]">
          <motion.div
            className="h-full bg-[#8B5CF6]"
            initial={{ width: 0 }}
            animate={{ width: `${uploadProgress}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
      )}
    </motion.div>
  );
}

// ============================================
// Main Component
// ============================================

export function AnimatedAIChat({
  greeting,
  onSend,
  isProcessing = false,
  processingMessage = "Processing...",
  uploadProgress = 0,
  placeholder = "Describe your creative vision...",
  compact = false,
  acceptFileTypes = "video/mp4,video/quicktime,video/webm,audio/mpeg,audio/mp4,audio/wav,audio/ogg,audio/flac",
}: AnimatedAIChatProps) {
  const [value, setValue] = useState("");
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { textareaRef, adjustHeight } = useAutoResizeTextarea({
    minHeight: 56,
    maxHeight: 200,
  });

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSend = () => {
    if (isProcessing) return;
    if (!value.trim() && attachedFiles.length === 0) return;
    onSend?.(value.trim(), [...attachedFiles]);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      setAttachedFiles((prev) => [...prev, ...files]);
    }
    e.target.value = "";
  };

  const removeFile = (index?: number) => {
    if (typeof index !== 'number') {
      setAttachedFiles([]);
      return;
    }
    setAttachedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  // Drag and drop handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    if (isProcessing) return;

    const files = Array.from(e.dataTransfer.files);
    const mediaFiles = files.filter(
      (f) =>
        f.type.startsWith("video/") ||
        f.type.startsWith("audio/") ||
        f.type.startsWith("image/"),
    );
    if (mediaFiles.length > 0) {
      setAttachedFiles((prev) => [...prev, ...mediaFiles]);
    }
  }, [isProcessing]);

  const canSend = (value.trim() || attachedFiles.length > 0) && !isProcessing;

  return (
    <div
      className={cn(
        "flex flex-col w-full items-center justify-center text-white relative",
        compact ? "py-6" : "py-12"
      )}
    >
      <div className="w-full max-w-2xl mx-auto relative px-4">
        <motion.div
          className="relative z-10 space-y-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          {/* Greeting */}
          {greeting && (
            <div className="text-center space-y-3">
              <motion.h1
                className={cn(
                  "font-[family-name:var(--font-sora)] font-light tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white/90 via-white/60 to-white/30",
                  compact ? "text-2xl" : "text-4xl"
                )}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15, duration: 0.5 }}
              >
                {greeting}
              </motion.h1>
              {!compact && (
                <motion.p
                  className="text-sm text-white/30"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.35, duration: 0.4 }}
                >
                  Upload a video and tell me your vision
                </motion.p>
              )}
            </div>
          )}

          {/* Chat Input Card */}
          <motion.div
            className={cn(
              "relative backdrop-blur-2xl rounded-2xl border shadow-[0_8px_32px_rgba(0,0,0,0.3)] transition-colors duration-200",
              isDragOver
                ? "bg-[#8B5CF6]/[0.06] border-[#8B5CF6]/30"
                : "bg-white/[0.03] border-white/[0.07]"
            )}
            initial={{ scale: 0.98 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.1 }}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            {/* Drag overlay */}
            <AnimatePresence>
              {isDragOver && (
                <motion.div
                  className="absolute inset-0 z-20 rounded-2xl flex items-center justify-center bg-[#8B5CF6]/[0.08] border-2 border-dashed border-[#8B5CF6]/40 pointer-events-none"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <div className="flex items-center gap-2 text-[#8B5CF6]">
                    <Video className="w-5 h-5" />
                    <span className="text-sm font-normal">Drop your media here</span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Textarea */}
            <div className="p-4">
              <textarea
                ref={textareaRef}
                value={value}
                onChange={(e) => {
                  setValue(e.target.value);
                  adjustHeight();
                }}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                disabled={isProcessing}
                className={cn(
                  "w-full px-2 py-2 resize-none bg-transparent border-none",
                  "text-white/90 text-sm focus:outline-none placeholder:text-white/25",
                  "min-h-[56px] disabled:opacity-50"
                )}
                style={{ overflow: "hidden" }}
              />
            </div>

            {/* File Preview — tiny chip-style tiles, flex-wrap so they stay
                small regardless of count. Individual upload/error state is
                surfaced on the asset-events stream once the project exists. */}
            <AnimatePresence>
              {attachedFiles.length > 0 && (
                <motion.div
                  className="px-4 pb-3"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                >
                  <div className="flex flex-wrap gap-1.5">
                    {attachedFiles.map((file, i) => (
                      <FilePreviewCard
                        key={`${file.name}-${i}-${file.size}`}
                        file={file}
                        onRemove={() => removeFile(i)}
                        isProcessing={isProcessing}
                        uploadProgress={uploadProgress}
                      />
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Bottom Bar */}
            <div className="px-4 py-3 border-t border-white/[0.05] flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                {/* The file <input> is nested INSIDE the label so clicking
                    anywhere on the label opens the picker with a guaranteed
                    user-activation token — this path never relies on JS
                    `.click()`, which some Chromium/Electron builds swallow
                    when the underlying input is display:none. */}
                <label
                  className={cn(
                    "inline-flex items-center gap-1.5 p-2 text-white/40 hover:text-white/90 rounded-lg transition-colors cursor-pointer active:scale-[0.96]",
                    isProcessing && "opacity-50 pointer-events-none",
                  )}
                >
                  <Paperclip className="w-4 h-4" />
                  {attachedFiles.length === 0 && !isProcessing && (
                    <span className="text-xs text-white/40">Attach video or audio</span>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept={acceptFileTypes}
                    className="sr-only"
                    onChange={handleFileChange}
                    disabled={isProcessing}
                  />
                </label>
                {isProcessing && processingMessage && (attachedFiles.length === 0 || uploadProgress >= 100) && (
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-3.5 h-3.5 text-[#8B5CF6] animate-spin" />
                    <span className="text-xs text-white/40">{processingMessage}</span>
                  </div>
                )}
              </div>

              <motion.button
                type="button"
                onClick={handleSend}
                whileHover={canSend ? { scale: 1.02 } : undefined}
                whileTap={canSend ? { scale: 0.98 } : undefined}
                disabled={!canSend}
                className={cn(
                  "p-2.5 rounded-xl text-sm font-normal transition-all flex items-center justify-center",
                  canSend
                    ? "bg-[#8B5CF6] text-white shadow-lg shadow-[#8B5CF6]/20 hover:bg-[#7C3AED]"
                    : "bg-white/[0.05] text-white/30 cursor-not-allowed"
                )}
              >
                <ArrowUp className="w-4 h-4" />
              </motion.button>
            </div>

            {/* File input lives nested inside the paperclip <label> above,
                so clicking the label opens the picker via native browser
                wiring. Nothing to render here. */}
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}
