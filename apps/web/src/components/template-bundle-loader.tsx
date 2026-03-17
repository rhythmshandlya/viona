"use client";

import { useState, useEffect, useRef } from 'react';
import type { ComponentType } from 'react';
import '@/lib/template-globals';

const bundleCache = new Map<string, ComponentType<any>>();

export function useTemplateBundle(bundleUrl: string | null): {
  Component: ComponentType<any> | null;
  loading: boolean;
  error: string | null;
} {
  const [Component, setComponent] = useState<ComponentType<any> | null>(
    bundleUrl && bundleCache.has(bundleUrl) ? bundleCache.get(bundleUrl)! : null,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const blobUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (!bundleUrl) {
      setComponent(null);
      setLoading(false);
      setError(null);
      return;
    }

    if (typeof window === 'undefined') return;

    // Use cached component if available
    if (bundleCache.has(bundleUrl)) {
      setComponent(bundleCache.get(bundleUrl)!);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;

    async function loadBundle() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(bundleUrl!);
        if (!response.ok) {
          throw new Error(`Failed to fetch bundle: ${response.status}`);
        }

        if (cancelled) return;

        const text = await response.text();
        if (cancelled) return;

        const blob = new Blob([text], { type: 'application/javascript' });
        const blobUrl = URL.createObjectURL(blob);
        blobUrlRef.current = blobUrl;

        if (cancelled) {
          URL.revokeObjectURL(blobUrl);
          return;
        }

        const module = await import(/* webpackIgnore: true */ blobUrl);
        if (cancelled) return;

        const LoadedComponent = module.default as ComponentType<any>;
        bundleCache.set(bundleUrl!, LoadedComponent);
        setComponent(LoadedComponent);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load template bundle');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadBundle();

    return () => {
      cancelled = true;
      // Revoke blob URL on unmount, but only if it wasn't cached
      if (blobUrlRef.current && !bundleCache.has(bundleUrl)) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, [bundleUrl]);

  return { Component, loading, error };
}
