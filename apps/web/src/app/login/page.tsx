"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Products, OAuthProviders } from "@stytch/vanilla-js";
import { StytchLogin } from "@stytch/nextjs";
import { useStytchUser } from "@stytch/nextjs";

const REDIRECT_URL = process.env.NEXT_PUBLIC_URL || "http://localhost:3000";

const stytchConfig = {
  products: [Products.emailMagicLinks, Products.oauth],
  emailMagicLinksOptions: {
    loginRedirectURL: `${REDIRECT_URL}/authenticate`,
    signupRedirectURL: `${REDIRECT_URL}/authenticate`,
  },
  oauthOptions: {
    providers: [{ type: OAuthProviders.Google }],
    loginRedirectURL: `${REDIRECT_URL}/authenticate`,
    signupRedirectURL: `${REDIRECT_URL}/authenticate`,
  },
};

const stytchStyles = {
  container: {
    backgroundColor: "transparent",
    borderColor: "transparent",
    width: "100%",
  },
  colors: {
    primary: "#F97316",
    secondary: "#EA580C",
    success: "#22c55e",
    error: "#ef4444",
  },
  fontFamily: "inherit",
};

export default function LoginPage() {
  const router = useRouter();
  const { user, isInitialized } = useStytchUser();

  // Redirect if already authenticated
  useEffect(() => {
    if (isInitialized && user) {
      router.push("/upload");
    }
  }, [isInitialized, user, router]);

  if (!isInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground">Redirecting...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8 bg-background">
      <div className="max-w-md w-full space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold tracking-tight">
            <span className="text-primary">Cllipify</span>
          </h1>
          <p className="text-muted-foreground">
            Sign in to start creating amazing video content
          </p>
        </div>

        {/* Stytch Login UI */}
        <div className="bg-card border rounded-xl p-6">
          <StytchLogin config={stytchConfig} styles={stytchStyles} />
        </div>

        {/* Footer */}
        <p className="text-center text-sm text-muted-foreground">
          By continuing, you agree to our Terms of Service and Privacy Policy
        </p>
      </div>
    </div>
  );
}
