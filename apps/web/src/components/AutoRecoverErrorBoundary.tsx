'use client';

import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { toast } from 'sonner';

interface AutoRecoverErrorBoundaryProps {
  children: ReactNode;
  /** Max auto-recovery attempts before showing manual retry UI */
  maxRetries?: number;
  /** Delay (ms) before auto-recovery attempt */
  retryDelay?: number;
  /** Name for logging */
  name?: string;
}

interface AutoRecoverErrorBoundaryState {
  error: Error | null;
  retryCount: number;
  recovering: boolean;
}

/**
 * Error boundary that automatically recovers from crashes.
 * Shows a brief "Recovering..." state, then re-renders children.
 * After maxRetries, falls back to manual retry UI.
 */
export class AutoRecoverErrorBoundary extends Component<
  AutoRecoverErrorBoundaryProps,
  AutoRecoverErrorBoundaryState
> {
  static defaultProps = {
    maxRetries: 3,
    retryDelay: 800,
    name: 'Editor',
  };

  private recoveryTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(props: AutoRecoverErrorBoundaryProps) {
    super(props);
    this.state = { error: null, retryCount: 0, recovering: false };
  }

  static getDerivedStateFromError(error: Error): Partial<AutoRecoverErrorBoundaryState> {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const name = this.props.name ?? 'Editor';
    console.error(`[AutoRecover:${name}]`, error, errorInfo.componentStack);

    const maxRetries = this.props.maxRetries ?? 3;

    if (this.state.retryCount < maxRetries) {
      toast.error(`Something went wrong — recovering automatically...`, {
        duration: 2000,
      });
      this.scheduleRecovery();
    } else {
      toast.error(`${name} crashed. Click "Try again" to reload.`, {
        duration: 5000,
      });
    }
  }

  componentWillUnmount() {
    if (this.recoveryTimer) clearTimeout(this.recoveryTimer);
  }

  private scheduleRecovery() {
    const delay = this.props.retryDelay ?? 800;

    this.setState({ recovering: true });

    this.recoveryTimer = setTimeout(() => {
      this.setState((prev) => ({
        error: null,
        retryCount: prev.retryCount + 1,
        recovering: false,
      }));
    }, delay);
  }

  private manualReset = () => {
    this.setState({ error: null, retryCount: 0, recovering: false });
  };

  render() {
    const maxRetries = this.props.maxRetries ?? 3;

    // Recovering state — brief loading indicator
    if (this.state.recovering || (this.state.error && this.state.retryCount < maxRetries)) {
      return (
        <div className="flex flex-col items-center justify-center h-full w-full bg-[var(--editor-bg,#0a0a0a)]">
          <div className="flex flex-col items-center gap-3">
            <div className="w-5 h-5 border-2 border-zinc-600 border-t-zinc-300 rounded-full animate-spin" />
            <p className="text-sm text-zinc-400">Recovering...</p>
          </div>
        </div>
      );
    }

    // Exhausted retries — manual retry UI
    if (this.state.error) {
      return (
        <div className="flex flex-col items-center justify-center h-full w-full bg-[var(--editor-bg,#0a0a0a)]">
          <div className="flex flex-col items-center gap-4 max-w-sm text-center">
            <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center">
              <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-zinc-200 mb-1">
                {this.props.name ?? 'Editor'} ran into an issue
              </p>
              <p className="text-xs text-zinc-500">
                {this.state.error.message}
              </p>
            </div>
            <button
              onClick={this.manualReset}
              className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-sm text-zinc-200 transition-colors"
            >
              Try again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
