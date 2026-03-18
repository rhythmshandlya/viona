"use client";

import { Card } from "@/components/ui/card";
import { Loader } from "@/components/ui/loader";
import { useEffect, useRef, useState } from "react";

interface AIThinkingBlockProps {
  /** Text to display in the scrolling window. If omitted, a placeholder is shown. */
  thinkingText?: string;
  /** Label next to the spinner. Defaults to "Viona is thinking" */
  label?: string;
}

export default function AIThinkingBlock({
  thinkingText,
  label = "Viona is thinking",
}: AIThinkingBlockProps) {
  const [scrollPosition, setScrollPosition] = useState(0);
  const contentRef = useRef<HTMLDivElement>(null);
  const scrollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const [timer, setTimer] = useState(0);

  useEffect(() => {
    const timerInterval = setInterval(() => {
      setTimer((prev) => prev + 1);
    }, 1000);

    return () => {
      clearInterval(timerInterval);
    };
  }, []);

  useEffect(() => {
    if (contentRef.current) {
      const scrollHeight = contentRef.current.scrollHeight;
      const clientHeight = contentRef.current.clientHeight;
      const maxScroll = scrollHeight - clientHeight;

      scrollIntervalRef.current = setInterval(() => {
        setScrollPosition((prev) => {
          const newPosition = prev + 1;
          if (newPosition >= maxScroll) {
            return 0;
          }
          return newPosition;
        });
      }, 5);

      return () => {
        if (scrollIntervalRef.current) {
          clearInterval(scrollIntervalRef.current);
        }
      };
    }
  }, [thinkingText]);

  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollTop = scrollPosition;
    }
  }, [scrollPosition]);

  if (!thinkingText) return null;

  return (
    <div className="flex flex-col p-1">
      <div className="flex items-center justify-start gap-2 mb-2">
        <Loader size="sm" className="text-[var(--editor-accent)]" />
        <p className="animate-shimmer-text bg-[linear-gradient(110deg,var(--editor-text-muted),35%,var(--editor-text-primary),50%,var(--editor-text-muted),75%,var(--editor-text-muted))] bg-[length:200%_100%] bg-clip-text text-sm text-transparent">
          {label}
        </p>
        <span className="text-xs text-[var(--editor-text-muted)]">
          {timer}s
        </span>
      </div>
      <Card className="relative h-[120px] overflow-hidden bg-[var(--chat-bubble-assistant-bg)] border-[var(--chat-bubble-assistant-border)] p-0 rounded-xl">
        {/* Top fade overlay */}
        <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-30% from-[var(--editor-bg-base)] to-transparent z-10 pointer-events-none h-[50px]" />

        {/* Bottom fade overlay */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-30% from-[var(--editor-bg-base)] to-transparent z-10 pointer-events-none h-[50px]" />

        {/* Scrolling content */}
        <div
          ref={contentRef}
          className="h-full overflow-hidden p-3 text-[var(--editor-text-muted)]"
          style={{ scrollBehavior: "auto" }}
        >
          <p className="text-xs leading-relaxed whitespace-pre-wrap">
            {thinkingText}
          </p>
        </div>
      </Card>
    </div>
  );
}
