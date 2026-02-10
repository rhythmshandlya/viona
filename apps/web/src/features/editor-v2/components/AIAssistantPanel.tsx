/**
 * AI Assistant Panel
 * Right sidebar chat interface for AI interactions
 * Connected to edit-visuals API for making changes to existing compositions
 * Supports image upload for SVG animation creation
 */

'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, Send, MoreHorizontal, Loader2, CheckCircle, XCircle, ImagePlus, X } from 'lucide-react';
import { api, AnimationType, AnimationStyle } from '@/lib/api';
import { clearVisualCache } from '../player/DynamicVisualLoader';
import { AnimationPlacementModal } from './AnimationPlacementModal';
import { useVideoSettings, useEditorActions, useSelectedSceneId } from '../store/use-editor-store';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  status?: 'pending' | 'processing' | 'complete' | 'error';
  jobId?: string;
  progress?: number;
  imagePreviewUrl?: string;
}

interface AIAssistantPanelProps {
  projectId: string;
  onEditComplete?: () => void;
  className?: string;
}

export function AIAssistantPanel({ projectId, onEditComplete, className = '' }: AIAssistantPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Image upload state
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [showPlacementModal, setShowPlacementModal] = useState(false);
  const [isSubmittingAnimation, setIsSubmittingAnimation] = useState(false);

  // Get video settings and scene selection from editor store
  const videoSettings = useVideoSettings();
  const selectedSceneId = useSelectedSceneId();
  const { reloadVisuals, setSelectedScene } = useEditorActions();

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Poll for job status when there's a pending job
  useEffect(() => {
    const pendingMessage = messages.find(m => m.status === 'pending' || m.status === 'processing');
    if (!pendingMessage?.jobId) return;

    const pollInterval = setInterval(async () => {
      try {
        const job = await api.getJob(pendingMessage.jobId!);

        // Update message with progress
        setMessages(prev => prev.map(m => {
          if (m.id !== pendingMessage.id) return m;

          if (job.status === 'complete') {
            return {
              ...m,
              status: 'complete',
              progress: 100,
              content: job.type === 'svg-animation'
                ? '✅ Animation created! Check the timeline.'
                : '✅ Done! Your changes have been applied. The preview will update shortly.',
            };
          } else if (job.status === 'failed') {
            return {
              ...m,
              status: 'error',
              content: `❌ ${job.type === 'svg-animation' ? 'Animation creation' : 'Edit'} failed: ${job.error || 'Unknown error'}. Please try again.`,
            };
          } else {
            return {
              ...m,
              status: 'processing',
              progress: job.progress,
              content: job.type === 'svg-animation'
                ? getAnimationProgressMessage(job.progress)
                : getProgressMessage(job.progress),
            };
          }
        }));

        // Stop polling if job is done
        if (job.status === 'complete' || job.status === 'failed') {
          clearInterval(pollInterval);
          setIsLoading(false);
          if (job.status === 'complete') {
            // Clear the visual cache so the updated bundle is loaded
            clearVisualCache();
            // Reload visuals in the editor
            if (reloadVisuals) {
              reloadVisuals(projectId);
            }
            if (onEditComplete) {
              onEditComplete();
            }
          }
        }
      } catch (error) {
        console.error('Failed to poll job status:', error);
      }
    }, 1500);

    return () => clearInterval(pollInterval);
  }, [messages, onEditComplete, projectId, reloadVisuals]);

  const getProgressMessage = (progress: number): string => {
    if (progress < 20) return '🔄 Restoring your composition files...';
    if (progress < 50) return '🤖 AI is analyzing and making changes...';
    if (progress < 80) return '📦 Building the updated composition...';
    if (progress < 95) return '☁️ Uploading changes...';
    return '✨ Almost done...';
  };

  const getAnimationProgressMessage = (progress: number): string => {
    if (progress < 15) return '📥 Downloading image...';
    if (progress < 40) return '🎨 Converting image to SVG...';
    if (progress < 60) return '✨ Generating animation...';
    if (progress < 80) return '📦 Bundling composition...';
    if (progress < 95) return '☁️ Uploading to storage...';
    return '✨ Almost done...';
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
    if (!validTypes.includes(file.type)) {
      const errorMessage: Message = {
        id: Date.now().toString(),
        role: 'assistant',
        content: '❌ Invalid file type. Please select a PNG, JPEG, WebP, or GIF image.',
        timestamp: new Date(),
        status: 'error',
      };
      setMessages(prev => [...prev, errorMessage]);
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      const errorMessage: Message = {
        id: Date.now().toString(),
        role: 'assistant',
        content: '❌ Image too large. Please select an image under 10MB.',
        timestamp: new Date(),
        status: 'error',
      };
      setMessages(prev => [...prev, errorMessage]);
      return;
    }

    // Create preview URL
    const previewUrl = URL.createObjectURL(file);
    setSelectedImage(file);
    setImagePreviewUrl(previewUrl);
    setShowPlacementModal(true);

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleCancelImage = () => {
    if (imagePreviewUrl) {
      URL.revokeObjectURL(imagePreviewUrl);
    }
    setSelectedImage(null);
    setImagePreviewUrl(null);
    setShowPlacementModal(false);
  };

  const handleAnimationSubmit = async (options: {
    animationType: AnimationType;
    animationStyle: AnimationStyle;
    durationSeconds: number;
  }) => {
    if (!selectedImage) return;

    setIsSubmittingAnimation(true);

    // Add user message with image preview
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: `Create ${options.animationType} animation (${options.animationStyle} style, ${options.durationSeconds}s)`,
      timestamp: new Date(),
      imagePreviewUrl: imagePreviewUrl || undefined,
    };
    setMessages(prev => [...prev, userMessage]);

    try {
      // Upload image
      const uploadResponse = await api.uploadImageForAnimation(projectId, selectedImage);

      // Create SVG animation job - let system decide track and timing
      const canvasWidth = videoSettings?.canvasWidth || 1080;
      const canvasHeight = videoSettings?.canvasHeight || 1920;

      const animationResponse = await api.createSvgAnimation(projectId, {
        imageKey: uploadResponse.imageKey,
        animationType: options.animationType,
        animationStyle: options.animationStyle,
        durationSeconds: options.durationSeconds,
        trackId: null, // System will create/pick track
        startMs: 0, // Start at beginning, user can drag on timeline
        width: canvasWidth,
        height: canvasHeight,
      });

      // Add assistant message with job tracking
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: '🎨 Creating your animation...',
        timestamp: new Date(),
        status: 'pending',
        jobId: animationResponse.jobId,
        progress: 0,
      };
      setMessages(prev => [...prev, assistantMessage]);
      setIsLoading(true);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `❌ Failed to create animation: ${errorMessage}`,
        timestamp: new Date(),
        status: 'error',
      };
      setMessages(prev => [...prev, assistantMessage]);
    } finally {
      setIsSubmittingAnimation(false);
      handleCancelImage();
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    const prompt = input.trim();
    setInput('');
    setIsLoading(true);

    try {
      // Call the edit-visuals API with optional scene ID
      const response = await api.editVisuals(projectId, prompt, selectedSceneId);

      // Add assistant message that will be updated with progress
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: '🔄 Starting to apply your changes...',
        timestamp: new Date(),
        status: 'pending',
        jobId: response.jobId,
        progress: 0,
      };
      setMessages(prev => [...prev, assistantMessage]);

    } catch (error) {
      setIsLoading(false);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Check for specific errors
      let content = `❌ ${errorMessage}`;
      if (errorMessage.includes('No visuals to edit')) {
        content = "❌ No visuals found to edit. Please generate visuals first using the Generate panel.";
      } else if (errorMessage.includes('No source files') || errorMessage.includes('source file saving was enabled')) {
        content = "❌ Source files not available for this project. This project was created before AI editing was enabled. Please delete visuals and regenerate them to enable editing.";
      }

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content,
        timestamp: new Date(),
        status: 'error',
      };
      setMessages(prev => [...prev, assistantMessage]);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className={`flex flex-col h-full bg-[var(--editor-bg-surface)] border-l border-[var(--editor-border-subtle)] ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 h-14 border-b border-[var(--editor-border-subtle)]">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-[var(--editor-accent)]" />
          <span className="text-sm font-semibold text-[var(--editor-text-primary)]">AI Assistant</span>
          {selectedSceneId && (
            <span className="px-2 py-0.5 text-[10px] font-medium bg-[var(--editor-accent)]/10 text-[var(--editor-accent)] rounded-full">
              Scene {selectedSceneId}
            </span>
          )}
        </div>
        {selectedSceneId ? (
          <button
            onClick={() => setSelectedScene(null)}
            className="px-2 py-1 text-[10px] text-[var(--editor-text-muted)] hover:text-[var(--editor-text-primary)] hover:bg-[var(--editor-bg-hover)] rounded transition-colors"
          >
            Clear
          </button>
        ) : (
          <button
            className="p-1.5 rounded-md hover:bg-[var(--editor-bg-hover)] transition-colors"
            aria-label="Options"
          >
            <MoreHorizontal className="w-4 h-4 text-[var(--editor-text-secondary)]" />
          </button>
        )}
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div className="w-12 h-12 rounded-full bg-[var(--editor-accent-muted)] flex items-center justify-center mb-4">
              <Sparkles className="w-6 h-6 text-[var(--editor-accent)] opacity-60" />
            </div>
            {selectedSceneId ? (
              <>
                <p className="text-sm text-[var(--editor-text-secondary)] mb-2">
                  Editing Scene {selectedSceneId}
                </p>
                <p className="text-xs text-[var(--editor-text-muted)]">
                  Changes will apply to this scene only
                </p>
              </>
            ) : (
              <>
                <p className="text-sm text-[var(--editor-text-secondary)] mb-2">
                  Ask AI to edit your visuals
                </p>
                <p className="text-xs text-[var(--editor-text-muted)] mb-2">
                  Click a scene in Transcript to target it
                </p>
                <p className="text-xs text-[var(--editor-text-muted)]">
                  Or type to edit the whole composition
                </p>
              </>
            )}
          </div>
        ) : (
          /* Messages */
          messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] px-4 py-2.5 text-sm ${
                  message.role === 'user'
                    ? 'bg-[var(--editor-accent)] text-white rounded-2xl rounded-br-md'
                    : 'bg-[var(--editor-bg-hover)] text-[var(--editor-text-primary)] rounded-2xl rounded-bl-md'
                }`}
              >
                {/* Image preview in message */}
                {message.imagePreviewUrl && (
                  <div className="mb-2">
                    <img
                      src={message.imagePreviewUrl}
                      alt="Uploaded"
                      className="max-w-full h-auto rounded-lg max-h-32 object-contain"
                    />
                  </div>
                )}
                <div className="flex items-start gap-2">
                  {message.status === 'processing' && (
                    <Loader2 className="w-4 h-4 animate-spin flex-shrink-0 mt-0.5" />
                  )}
                  {message.status === 'complete' && (
                    <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                  )}
                  {message.status === 'error' && (
                    <XCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                  )}
                  <span>{message.content}</span>
                </div>
                {message.progress !== undefined && message.status === 'processing' && (
                  <div className="mt-2">
                    <div className="w-full bg-[var(--editor-bg-surface)] rounded-full h-1.5">
                      <div
                        className="bg-[var(--editor-accent)] h-1.5 rounded-full transition-all duration-300"
                        style={{ width: `${message.progress}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))
        )}

        {/* Loading indicator for initial request */}
        {isLoading && !messages.some(m => m.status === 'pending' || m.status === 'processing') && (
          <div className="flex justify-start">
            <div className="bg-[var(--editor-bg-hover)] text-[var(--editor-text-primary)] rounded-2xl rounded-bl-md px-4 py-2.5">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-[var(--editor-text-muted)] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-[var(--editor-text-muted)] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-[var(--editor-text-muted)] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 border-t border-[var(--editor-border-subtle)]">
        <div className="relative flex items-center gap-2">
          {/* Image upload button */}
          <label className="cursor-pointer p-2 rounded-full hover:bg-[var(--editor-bg-hover)] transition-colors flex-shrink-0">
            <ImagePlus className="w-5 h-5 text-[var(--editor-text-secondary)]" />
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="hidden"
              onChange={handleImageSelect}
              disabled={isLoading}
            />
          </label>

          {/* Text input */}
          <div className="relative flex-1">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Describe what you want to change..."
              disabled={isLoading}
              className="w-full bg-[var(--editor-bg-hover)] text-[var(--editor-text-primary)] text-sm
                         placeholder:text-[var(--editor-text-muted)]
                         rounded-xl px-4 py-3 pr-12
                         border border-transparent
                         focus:outline-none focus:border-[var(--editor-accent)] focus:ring-2 focus:ring-[var(--editor-accent-soft)]
                         disabled:opacity-50 disabled:cursor-not-allowed
                         transition-all"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center
                         rounded-full bg-[var(--editor-accent)] text-white
                         hover:bg-[var(--editor-accent-hover)] transition-colors
                         disabled:bg-[var(--editor-bg-hover)] disabled:text-[var(--editor-text-muted)]"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Animation Placement Modal */}
      <AnimationPlacementModal
        open={showPlacementModal}
        onOpenChange={(open) => {
          if (!open) handleCancelImage();
        }}
        imageFile={selectedImage}
        imagePreviewUrl={imagePreviewUrl}
        isSubmitting={isSubmittingAnimation}
        onSubmit={handleAnimationSubmit}
      />
    </div>
  );
}
