"use client";

import { StytchProvider as StytchReactProvider } from "@stytch/nextjs";
import { createStytchUIClient } from "@stytch/nextjs/ui";
import { ReactNode, useMemo } from "react";

const stytchPublicToken = process.env.NEXT_PUBLIC_STYTCH_PUBLIC_TOKEN || "";

interface StytchProviderProps {
  children: ReactNode;
}

export function StytchProvider({ children }: StytchProviderProps) {
  const stytchClient = useMemo(() => {
    console.log("[StytchProvider] Token:", stytchPublicToken ? "present" : "missing");
    if (!stytchPublicToken) {
      console.warn("NEXT_PUBLIC_STYTCH_PUBLIC_TOKEN is not set");
      return null;
    }
    try {
      const client = createStytchUIClient(stytchPublicToken);
      console.log("[StytchProvider] Client created successfully");
      return client;
    } catch (error) {
      console.error("[StytchProvider] Failed to create client:", error);
      return null;
    }
  }, []);

  if (!stytchClient) {
    // If Stytch is not configured, render children without provider
    // This allows the app to work in development without Stytch setup
    return <>{children}</>;
  }

  return (
    <StytchReactProvider stytch={stytchClient}>
      {children}
    </StytchReactProvider>
  );
}
