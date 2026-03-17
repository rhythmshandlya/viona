"use client";

import { useEffect } from "react";
import { AlertCircle } from "lucide-react";
import { LiquidButton } from "@/components/ui/liquid-glass-button";
import { SmokeBackground } from "@/components/ui/spooky-smoke-animation";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="liquid-glass-page min-h-screen relative">
      <div className="fixed inset-0 z-0">
        <SmokeBackground smokeColor="#3B1578" />
      </div>
      <div className="relative z-10 min-h-screen flex items-center justify-center p-8">
        <div className="text-center space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-red-500/15 flex items-center justify-center mx-auto">
            <AlertCircle className="w-8 h-8 text-red-400" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-white/90 mb-2">Something went wrong</h2>
            <p className="text-sm text-white/40 max-w-md">
              An unexpected error occurred. Please try again.
            </p>
          </div>
          <LiquidButton onClick={() => reset()}>
            Try again
          </LiquidButton>
        </div>
      </div>
    </div>
  );
}
