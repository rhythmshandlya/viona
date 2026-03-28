"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useStytch } from "@stytch/nextjs";
import { Loader2, CheckCircle, AlertCircle } from "lucide-react";

type AuthState = "authenticating" | "success" | "error";

function AuthenticateContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const stytchClient = useStytch();
  const [state, setState] = useState<AuthState>("authenticating");
  const [error, setError] = useState<string | null>(null);

  // Authenticate when component mounts
  useEffect(() => {
    if (!stytchClient) {
      setState("error");
      setError("Authentication is not configured");
      return;
    }

    const authenticate = async () => {
      const token = searchParams.get("token");
      const tokenType = searchParams.get("stytch_token_type");

      if (!token) {
        setState("error");
        setError("No authentication token found");
        return;
      }

      try {
        let response;
        if (tokenType === "magic_links") {
          response = await stytchClient.magicLinks.authenticate(token, {
            session_duration_minutes: 60 * 24 * 7, // 1 week
          });
        } else if (tokenType === "oauth") {
          response = await stytchClient.oauth.authenticate(token, {
            session_duration_minutes: 60 * 24 * 7, // 1 week
          });
        } else {
          // Try magic links as default
          response = await stytchClient.magicLinks.authenticate(token, {
            session_duration_minutes: 60 * 24 * 7, // 1 week
          });
        }

        // Set cookies manually to ensure middleware can read them
        if (response.session_token) {
          document.cookie = `stytch_session=${response.session_token}; path=/; max-age=${60 * 60 * 24 * 7}; samesite=lax`;
        }
        if (response.session_jwt) {
          document.cookie = `stytch_session_jwt=${response.session_jwt}; path=/; max-age=${60 * 60 * 24 * 7}; samesite=lax`;
        }

        setState("success");

        // Redirect to projects dashboard after short delay
        setTimeout(() => {
          router.push("/projects");
        }, 1500);
      } catch (err) {
        console.error("Authentication error:", err);
        setState("error");
        setError(
          err instanceof Error
            ? err.message
            : "Authentication failed. Please try again."
        );
      }
    };

    authenticate();
  }, [stytchClient, searchParams, router]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8 bg-background">
      <div className="max-w-md w-full space-y-8 text-center">
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-4xl font-normal tracking-tight">
            <span className="text-primary">Viona</span> <span className="text-muted-foreground font-normal text-2xl">Studio</span>
          </h1>
        </div>

        {/* Status */}
        <div className="bg-card border rounded-xl p-8 space-y-4">
          {state === "authenticating" && (
            <>
              <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto" />
              <p className="text-lg font-normal">Signing you in...</p>
              <p className="text-sm text-muted-foreground">
                Please wait while we verify your credentials
              </p>
            </>
          )}

          {state === "success" && (
            <>
              <CheckCircle className="w-12 h-12 text-green-500 mx-auto" />
              <p className="text-lg font-normal">Welcome!</p>
              <p className="text-sm text-muted-foreground">
                Redirecting you to your dashboard...
              </p>
            </>
          )}

          {state === "error" && (
            <>
              <AlertCircle className="w-12 h-12 text-destructive mx-auto" />
              <p className="text-lg font-normal">Authentication Failed</p>
              <p className="text-sm text-muted-foreground">{error}</p>
              <button
                onClick={() => router.push("/login")}
                className="mt-4 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
              >
                Try Again
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AuthenticatePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-background">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      }
    >
      <AuthenticateContent />
    </Suspense>
  );
}
