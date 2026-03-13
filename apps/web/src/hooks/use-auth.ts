"use client";

import { useStytch, useStytchUser, useStytchSession } from "@stytch/nextjs";
import { useCallback } from "react";
import { getSessionToken } from "@/lib/auth";

export interface AuthUser {
  id: string;
  email: string;
  name?: string;
}

export function useAuth() {
  const stytch = useStytch();
  const { user, isInitialized: userInitialized } = useStytchUser();
  const { session, isInitialized: sessionInitialized } = useStytchSession();

  const isInitialized = userInitialized && sessionInitialized;
  const isAuthenticated = !!session && !!user;

  const logout = useCallback(async () => {
    if (session) {
      await stytch.session.revoke();
    }
  }, [stytch, session]);

  const authUser: AuthUser | null = user
    ? {
        id: user.user_id,
        email: user.emails?.[0]?.email || "",
        name: user.name?.first_name
          ? `${user.name.first_name} ${user.name.last_name || ""}`.trim()
          : undefined,
      }
    : null;

  return {
    user: authUser,
    session,
    isInitialized,
    isAuthenticated,
    logout,
    getSessionToken,
  };
}
