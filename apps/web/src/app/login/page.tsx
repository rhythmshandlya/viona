"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Products, OAuthProviders } from "@stytch/vanilla-js";
import { StytchLogin } from "@stytch/nextjs";
import { useStytchUser } from "@stytch/nextjs";
import Link from "next/link";
import { SmokeBackground } from "@/components/ui/spooky-smoke-animation";

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
    color: "rgba(255,255,255,0.9)",
  },
  colors: {
    primary: "#8B5CF6",
    secondary: "#7C3AED",
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
      router.push("/projects");
    }
  }, [isInitialized, user, router]);

  if (!isInitialized) {
    return (
      <div className="liquid-glass-page min-h-screen relative">
        <div className="fixed inset-0 z-0">
          <SmokeBackground smokeColor="#3B1578" />
        </div>
        <div className="relative z-10 min-h-screen flex items-center justify-center">
          <div className="animate-pulse text-white/40">Loading...</div>
        </div>
      </div>
    );
  }

  if (user) {
    return (
      <div className="liquid-glass-page min-h-screen relative">
        <div className="fixed inset-0 z-0">
          <SmokeBackground smokeColor="#3B1578" />
        </div>
        <div className="relative z-10 min-h-screen flex items-center justify-center">
          <div className="text-white/40">Redirecting...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="liquid-glass-page min-h-screen relative">
      <div className="fixed inset-0 z-0">
        <SmokeBackground smokeColor="#3B1578" />
      </div>
      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center p-8">
        <div className="max-w-md w-full space-y-8">
          {/* Header */}
          <div className="text-center space-y-2">
            <Link href="/" className="inline-block">
              <h1 className="text-4xl font-bold tracking-tight text-white/95">
                Viona <span className="text-[#8B5CF6]">Studio</span>
              </h1>
            </Link>
            <p className="text-white/45">
              Sign in to start creating amazing video content
            </p>
          </div>

          {/* Stytch Login UI */}
          <div className="glass-surface p-6">
            <StytchLogin config={stytchConfig} styles={stytchStyles} />
          </div>

          {/* Footer */}
          <p className="text-center text-sm text-white/30">
            By continuing, you agree to our Terms of Service and Privacy Policy
          </p>
        </div>
      </div>
    </div>
  );
}
