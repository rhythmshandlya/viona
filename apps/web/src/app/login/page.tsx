"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useStytch, useStytchUser } from "@stytch/nextjs";
import { SignInPage } from "@/components/ui/sign-in";

const REDIRECT_URL = process.env.NEXT_PUBLIC_URL || "http://localhost:3000";

export default function LoginPage() {
  const router = useRouter();
  const stytch = useStytch();
  const { user, isInitialized } = useStytchUser();

  const [isSubmittingEmail, setIsSubmittingEmail] = useState(false);
  const [isSubmittingGoogle, setIsSubmittingGoogle] = useState(false);
  const [statusMessage, setStatusMessage] = useState<
    { kind: "success" | "error"; text: string } | null
  >(null);

  useEffect(() => {
    if (isInitialized && user) {
      router.push("/projects");
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

  const handleEmailSubmit = async (email: string) => {
    if (!stytch) {
      setStatusMessage({ kind: "error", text: "Authentication is not configured." });
      return;
    }
    setStatusMessage(null);
    setIsSubmittingEmail(true);
    try {
      await stytch.magicLinks.email.loginOrCreate(email, {
        login_magic_link_url: `${REDIRECT_URL}/authenticate`,
        signup_magic_link_url: `${REDIRECT_URL}/authenticate`,
        login_expiration_minutes: 60,
        signup_expiration_minutes: 60,
      });
      setStatusMessage({
        kind: "success",
        text: `Magic link sent to ${email}. Check your inbox.`,
      });
    } catch (err) {
      console.error("Magic link error:", err);
      setStatusMessage({
        kind: "error",
        text:
          err instanceof Error
            ? err.message
            : "Couldn't send the magic link. Please try again.",
      });
    } finally {
      setIsSubmittingEmail(false);
    }
  };

  const handleGoogleSignIn = async () => {
    if (!stytch) {
      setStatusMessage({ kind: "error", text: "Authentication is not configured." });
      return;
    }
    setStatusMessage(null);
    setIsSubmittingGoogle(true);
    try {
      await stytch.oauth.google.start({
        login_redirect_url: `${REDIRECT_URL}/authenticate`,
        signup_redirect_url: `${REDIRECT_URL}/authenticate`,
      });
    } catch (err) {
      console.error("Google sign-in error:", err);
      setStatusMessage({
        kind: "error",
        text:
          err instanceof Error
            ? err.message
            : "Couldn't start Google sign-in. Please try again.",
      });
      setIsSubmittingGoogle(false);
    }
  };

  return (
    <SignInPage
      heroImageSrc="https://images.unsplash.com/photo-1642615835477-d303d7dc9ee9?w=2160&q=80"
      onEmailSubmit={handleEmailSubmit}
      onGoogleSignIn={handleGoogleSignIn}
      isSubmittingEmail={isSubmittingEmail}
      isSubmittingGoogle={isSubmittingGoogle}
      statusMessage={statusMessage}
    />
  );
}
