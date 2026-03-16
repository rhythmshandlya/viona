"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useStytchUser } from "@stytch/nextjs";
import Link from "next/link";
import {
  Sparkles,
  Captions,
  Wand2,
  Layers,
  Play,
  ArrowRight,
  Zap,
  Film,
  Music,
  MonitorPlay,
} from "lucide-react";
import { LiquidButton } from "@/components/ui/liquid-glass-button";
import { SmokeBackground } from "@/components/ui/spooky-smoke-animation";

export default function LandingPage() {
  const router = useRouter();
  const { user, isInitialized } = useStytchUser();

  // Redirect authenticated users straight to projects
  useEffect(() => {
    if (isInitialized && user) {
      router.push("/projects");
    }
  }, [isInitialized, user, router]);

  return (
    <div className="liquid-glass-page min-h-screen flex flex-col relative overflow-hidden">
      {/* Smoke background */}
      <div className="fixed inset-0 z-0">
        <SmokeBackground smokeColor="#3B1578" />
      </div>

      {/* Content */}
      <div className="relative z-10 min-h-screen flex flex-col">
        {/* Nav */}
        <nav className="sticky top-0 z-50 border-b border-white/[0.06] bg-[rgba(8,8,12,0.6)] backdrop-blur-2xl">
          <div className="max-w-7xl mx-auto px-6 md:px-8 lg:px-12 flex h-16 items-center justify-between">
            <Link href="/" className="flex items-center space-x-2">
              <span className="text-xl font-bold text-[#8B5CF6]">Viona</span>
              <span className="text-xs font-medium text-white/40 tracking-wide uppercase">Studio</span>
            </Link>
            <div className="flex items-center gap-4">
              <Link
                href="/login"
                className="text-sm font-medium text-white/50 hover:text-white/90 transition-colors"
              >
                Sign in
              </Link>
              <LiquidButton asChild size="sm">
                <Link href="/login">
                  Get Started
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </LiquidButton>
            </div>
          </div>
        </nav>

        {/* Hero */}
        <section className="flex-1 flex flex-col items-center justify-center text-center px-6 pt-20 pb-32">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-badge text-[#8B5CF6] text-sm font-medium mb-8 animate-fade-in-up">
            <Sparkles className="w-4 h-4" />
            AI-Powered Video Editor
          </div>

          <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-white/95 max-w-4xl leading-[1.1] animate-fade-in-up stagger-1">
            Transform videos with{" "}
            <span className="bg-gradient-to-r from-[#8B5CF6] via-[#A78BFA] to-[#7C3AED] bg-clip-text text-transparent">
              AI visuals
            </span>
          </h1>

          <p className="mt-6 text-lg md:text-xl text-white/45 max-w-2xl leading-relaxed animate-fade-in-up stagger-2">
            Upload your video or audio. AI generates animated visuals, transcribes speech,
            and adds beautiful subtitles — all in one editor.
          </p>

          <div className="mt-10 flex items-center gap-4 animate-fade-in-up stagger-3">
            <LiquidButton asChild size="xl">
              <Link href="/login">
                <Play className="w-5 h-5" fill="currentColor" />
                Start Creating
              </Link>
            </LiquidButton>
            <LiquidButton variant="outline" size="xl" asChild>
              <Link href="#features" className="border-white/[0.1] text-white/70">
                See Features
              </Link>
            </LiquidButton>
          </div>

          {/* Preview mockup */}
          <div className="mt-20 w-full max-w-5xl animate-fade-in-up stagger-4">
            <div className="glass-surface p-2 md:p-3">
              <div className="aspect-video rounded-xl bg-gradient-to-br from-[#0c0c12] via-[#12101f] to-[#0c0c12] border border-white/[0.04] flex items-center justify-center relative overflow-hidden">
                {/* Fake editor UI */}
                <div className="absolute inset-0 flex">
                  {/* Left sidebar hint */}
                  <div className="w-12 border-r border-white/[0.06] flex flex-col items-center gap-3 pt-4">
                    <div className="w-6 h-6 rounded-lg bg-[#8B5CF6]/15" />
                    <div className="w-6 h-6 rounded-lg bg-white/[0.04]" />
                    <div className="w-6 h-6 rounded-lg bg-white/[0.04]" />
                  </div>
                  {/* Center */}
                  <div className="flex-1 flex flex-col">
                    {/* Header bar */}
                    <div className="h-8 border-b border-white/[0.06] flex items-center px-3 gap-2">
                      <div className="w-16 h-3 rounded bg-white/[0.06]" />
                      <div className="ml-auto flex gap-1.5">
                        <div className="w-3 h-3 rounded-full bg-white/[0.06]" />
                        <div className="w-3 h-3 rounded-full bg-white/[0.06]" />
                      </div>
                    </div>
                    {/* Canvas area */}
                    <div className="flex-1 flex items-center justify-center">
                      <div className="w-32 md:w-48 aspect-[9/16] rounded-lg bg-gradient-to-b from-[#8B5CF6]/10 to-[#7C3AED]/5 border border-[#8B5CF6]/20 flex items-end justify-center pb-6">
                        <div className="flex flex-col items-center gap-1">
                          <div className="w-20 h-2.5 rounded bg-white/80" />
                          <div className="w-14 h-2.5 rounded bg-[#8B5CF6]/60" />
                        </div>
                      </div>
                    </div>
                    {/* Timeline bar */}
                    <div className="h-16 border-t border-white/[0.06] flex items-center px-3 gap-1">
                      <div className="w-2 h-8 rounded bg-[#8B5CF6]/30" />
                      {Array.from({ length: 12 }).map((_, i) => (
                        <div
                          key={i}
                          className="h-6 rounded"
                          style={{
                            width: `${8 + Math.random() * 12}%`,
                            backgroundColor: i < 3 ? 'rgba(139,92,246,0.15)' : 'rgba(255,255,255,0.04)',
                          }}
                        />
                      ))}
                    </div>
                  </div>
                  {/* Right sidebar hint */}
                  <div className="w-16 border-l border-white/[0.06] p-2">
                    <div className="w-full h-3 rounded bg-white/[0.06] mb-2" />
                    <div className="w-full h-3 rounded bg-white/[0.04] mb-1.5" />
                    <div className="w-3/4 h-3 rounded bg-white/[0.04]" />
                  </div>
                </div>
                {/* Play overlay */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-16 h-16 rounded-full bg-[#8B5CF6]/20 backdrop-blur-sm flex items-center justify-center border border-[#8B5CF6]/30">
                    <Play className="w-7 h-7 text-[#8B5CF6] ml-1" fill="currentColor" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="py-24 px-6">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-badge text-[#8B5CF6] text-sm font-medium mb-6">
                <Zap className="w-4 h-4" />
                Features
              </div>
              <h2 className="text-3xl md:text-5xl font-bold text-white/95 tracking-tight">
                Everything you need to create
              </h2>
              <p className="mt-4 text-lg text-white/40 max-w-xl mx-auto">
                A professional editor with AI superpowers, designed for content creators.
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              <FeatureCard
                icon={<Wand2 className="w-6 h-6" />}
                title="AI Visual Generation"
                description="Describe your vision and watch AI generate animated scenes, charts, and diagrams that match your content."
              />
              <FeatureCard
                icon={<Captions className="w-6 h-6" />}
                title="Auto Subtitles"
                description="Automatic transcription with word-level timing. Choose from viral, cinematic, and premium caption styles."
              />
              <FeatureCard
                icon={<Layers className="w-6 h-6" />}
                title="Multi-Track Timeline"
                description="Professional timeline with video, audio, caption, and overlay tracks. Split, trim, and arrange with precision."
              />
              <FeatureCard
                icon={<Film className="w-6 h-6" />}
                title="Animation Engine"
                description="40+ text animations from elastic pops to cinematic fades. Keyframe any property for custom motion."
              />
              <FeatureCard
                icon={<Music className="w-6 h-6" />}
                title="Audio Enhancement"
                description="AI-powered noise removal and voice enhancement. Separate audio tracks for fine control."
              />
              <FeatureCard
                icon={<MonitorPlay className="w-6 h-6" />}
                title="One-Click Export"
                description="Export in 1080x1920 for Reels, Shorts, and TikTok. Cloud rendering with progress tracking."
              />
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-24 px-6">
          <div className="max-w-3xl mx-auto text-center">
            <div className="glass-surface p-12 md:p-16">
              <h2 className="text-3xl md:text-4xl font-bold text-white/95 tracking-tight mb-4">
                Ready to create?
              </h2>
              <p className="text-lg text-white/40 mb-8 max-w-md mx-auto">
                Upload your first video and let AI transform it into something amazing.
              </p>
              <LiquidButton asChild size="xl">
                <Link href="/login">
                  <Sparkles className="w-5 h-5" />
                  Get Started Free
                </Link>
              </LiquidButton>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-white/[0.06] py-8 px-6">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-[#8B5CF6]">Viona</span>
              <span className="text-xs text-white/30">Studio</span>
            </div>
            <p className="text-xs text-white/25">
              &copy; {new Date().getFullYear()} Viona Studio
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="glass-card p-6 flex flex-col gap-4 rounded-2xl">
      <div className="w-12 h-12 rounded-xl bg-[#8B5CF6]/10 flex items-center justify-center text-[#8B5CF6]">
        {icon}
      </div>
      <h3 className="text-lg font-semibold text-white/90">{title}</h3>
      <p className="text-sm text-white/40 leading-relaxed">{description}</p>
    </div>
  );
}
