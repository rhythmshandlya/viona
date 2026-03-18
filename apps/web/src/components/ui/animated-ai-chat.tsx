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

function FilePreviewCard({
  file,
  onRemove,
  isProcessing,
  uploadProgress,
}: {
  file: File;
  onRemove: () => void;
  isProcessing: boolean;
  uploadProgress: number;
}) {
  const previewUrl = useMemo(() => URL.createObjectURL(file), [file]);
  const isVideo = file.type.startsWith("video/");
  const isUploading = isProcessing && uploadProgress < 100;
  const isDone = isProcessing && uploadProgress >= 100;

  useEffect(() => {
    return () => URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  return (
    <motion.div
      className="flex items-center gap-3 p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08]"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8, scale: 0.95 }}
      transition={{ duration: 0.2 }}
    >
      {/* Thumbnail */}
      <div className="relative w-20 h-14 rounded-lg overflow-hidden flex-shrink-0 bg-black/30">
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
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-[#8B5CF6]/10">
            <Music className="w-6 h-6 text-[#8B5CF6]/60" />
          </div>
        )}

        {/* Upload overlay on thumbnail */}
        {isUploading && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <Loader2 className="w-5 h-5 text-white animate-spin" />
          </div>
        )}
        {isDone && (
          <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white/80 truncate">{file.name}</p>
        <p className="text-xs text-white/35 mt-0.5">
          {formatFileSize(file.size)}
          {isUploading && ` \u00B7 Uploading ${uploadProgress}%`}
          {isDone && " \u00B7 Uploaded"}
        </p>

        {/* Progress bar */}
        {isUploading && (
          <div className="mt-1.5 h-1 rounded-full bg-white/[0.06] overflow-hidden">
            <motion.div
              className="h-full bg-[#8B5CF6] rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${uploadProgress}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        )}
      </div>

      {/* Remove button — only when not processing */}
      {!isProcessing && (
        <button
          onClick={onRemove}
          className="p-1.5 text-white/30 hover:text-white/70 rounded-lg transition-colors flex-shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
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

  const handleAttach = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      setAttachedFiles(files.slice(0, 1)); // Single file only
    }
    e.target.value = "";
  };

  const removeFile = () => {
    setAttachedFiles([]);
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
    const mediaFile = files.find(
      (f) => f.type.startsWith("video/") || f.type.startsWith("audio/")
    );
    if (mediaFile) {
      setAttachedFiles([mediaFile]);
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

            {/* File Preview */}
            <AnimatePresence>
              {attachedFiles.length > 0 && (
                <motion.div
                  className="px-4 pb-3"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                >
                  <FilePreviewCard
                    file={attachedFiles[0]}
                    onRemove={removeFile}
                    isProcessing={isProcessing}
                    uploadProgress={uploadProgress}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Bottom Bar */}
            <div className="px-4 py-3 border-t border-white/[0.05] flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <motion.button
                  type="button"
                  onClick={handleAttach}
                  whileTap={{ scale: 0.94 }}
                  disabled={isProcessing}
                  className="p-2 text-white/40 hover:text-white/90 rounded-lg transition-colors disabled:opacity-50"
                >
                  <Paperclip className="w-4 h-4" />
                </motion.button>
                {attachedFiles.length === 0 && !isProcessing && (
                  <span className="text-xs text-white/20 select-none">
                    Attach video or audio
                  </span>
                )}
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

            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept={acceptFileTypes}
              className="hidden"
              onChange={handleFileChange}
            />
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}
