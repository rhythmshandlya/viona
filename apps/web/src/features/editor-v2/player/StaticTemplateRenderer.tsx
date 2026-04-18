/**
 * StaticTemplateRenderer Component
 * Renders templates from the packages/templates registry with provided props.
 * Used for template-based visuals like youtube-clip, watercolor-map, etc.
 */

'use client';

import React, { useState, useEffect, useCallback, Component, ErrorInfo } from 'react';
import { AbsoluteFill } from 'remotion';
import { loadTemplate as loadTemplateRuntime } from '@viona/templates';
import * as RemotionRT from 'remotion';
import * as React_ForTemplates from 'react';
import * as ReactDOM_ForTemplates from 'react-dom';

interface StaticTemplateRendererProps {
  templateId: string;
  templateProps: Record<string, unknown>;
  className?: string;
}

// Component cache to avoid re-loading templates
const componentCache = new Map<string, React.ComponentType<any>>();

// Error boundary to catch runtime rendering errors in templates
interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class TemplateErrorBoundary extends Component<
  { templateId: string; children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { templateId: string; children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(`Template "${this.props.templateId}" render error:`, error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <AbsoluteFill>
          <div className="flex items-center justify-center h-full bg-red-900/20">
            <div className="flex flex-col items-center gap-2 text-center px-4">
              <svg
                className="w-8 h-8 text-red-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
              <span className="text-red-400 text-sm">
                Template error: {this.state.error?.message || 'Unknown error'}
              </span>
            </div>
          </div>
        </AbsoluteFill>
      );
    }

    return this.props.children;
  }
}

export function StaticTemplateRenderer({
  templateId,
  templateProps,
  className,
}: StaticTemplateRendererProps) {
  const [Component, setComponent] = useState<React.ComponentType<any> | null>(
    () => componentCache.get(templateId) || null
  );
  const [loading, setLoading] = useState(!componentCache.has(templateId));
  const [error, setError] = useState<string | null>(null);

  const loadTemplate = useCallback(async () => {
    // Check cache first
    if (componentCache.has(templateId)) {
      setComponent(() => componentCache.get(templateId)!);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { Component: Loaded } = await loadTemplateRuntime(templateId, {
        resolveExternal: (mod) => {
          switch (mod) {
            case 'react': return React_ForTemplates;
            case 'react-dom': return ReactDOM_ForTemplates;
            case 'remotion': return RemotionRT;
            default:
              throw new Error(
                `Template "${templateId}" needs external "${mod}" but web StaticTemplateRenderer doesn't provide it`
              );
          }
        },
      });

      // Cache the component
      componentCache.set(templateId, Loaded);
      setComponent(() => Loaded);
    } catch (err) {
      console.error('Failed to load template:', err);
      setError(err instanceof Error ? err.message : 'Failed to load template');
    } finally {
      setLoading(false);
    }
  }, [templateId]);

  useEffect(() => {
    loadTemplate();
  }, [loadTemplate]);

  if (loading) {
    return (
      <AbsoluteFill className={className}>
        <div className="flex items-center justify-center h-full bg-zinc-900/50">
          <div className="flex flex-col items-center gap-2">
            <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-zinc-400 text-sm">Loading template...</span>
          </div>
        </div>
      </AbsoluteFill>
    );
  }

  if (error) {
    return (
      <AbsoluteFill className={className}>
        <div className="flex items-center justify-center h-full bg-red-900/20">
          <div className="flex flex-col items-center gap-2 text-center px-4">
            <svg
              className="w-8 h-8 text-red-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <span className="text-red-400 text-sm">{error}</span>
          </div>
        </div>
      </AbsoluteFill>
    );
  }

  if (!Component) {
    return null;
  }

  // Render the template with the provided props, wrapped in error boundary
  return (
    <TemplateErrorBoundary templateId={templateId}>
      <Component {...templateProps} />
    </TemplateErrorBoundary>
  );
}
