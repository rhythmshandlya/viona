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
    if (!stytchPublicToken) {
      return null;
    }
    try {
      return createStytchUIClient(stytchPublicToken);
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
