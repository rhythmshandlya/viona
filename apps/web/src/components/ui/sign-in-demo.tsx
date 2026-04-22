"use client";

import { useState } from "react";
import { SignInPage, type Testimonial } from "@/components/ui/sign-in";

const sampleTestimonials: Testimonial[] = [
  {
    avatarSrc:
      "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&h=200&fit=crop&crop=face",
    name: "Sarah Chen",
    handle: "@sarahdigital",
    text: "Amazing platform! The user experience is seamless and the features are exactly what I needed.",
  },
  {
    avatarSrc:
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop&crop=face",
    name: "Marcus Johnson",
    handle: "@marcustech",
    text: "This service has transformed how I work. Clean design, powerful features, and excellent support.",
  },
  {
    avatarSrc:
      "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&h=200&fit=crop&crop=face",
    name: "David Martinez",
    handle: "@davidcreates",
    text: "I've tried many platforms, but this one stands out. Intuitive, reliable, and genuinely helpful for productivity.",
  },
];

const SignInPageDemo = () => {
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  const handleEmailSubmit = async (email: string) => {
    setLoading(true);
    setMsg(null);
    await new Promise((r) => setTimeout(r, 700));
    setMsg({ kind: "success", text: `Magic link sent to ${email}.` });
    setLoading(false);
  };

  const handleGoogleSignIn = () => {
    setMsg({ kind: "success", text: "Redirecting to Google..." });
  };

  return (
    <div className="bg-background text-foreground">
      <SignInPage
        heroImageSrc="https://images.unsplash.com/photo-1642615835477-d303d7dc9ee9?w=2160&q=80"
        testimonials={sampleTestimonials}
        onEmailSubmit={handleEmailSubmit}
        onGoogleSignIn={handleGoogleSignIn}
        isSubmittingEmail={loading}
        statusMessage={msg}
      />
    </div>
  );
};

export default SignInPageDemo;
