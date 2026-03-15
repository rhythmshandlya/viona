"use client";

import { Navbar } from "@/components/navbar";
import { SmokeBackground } from "@/components/ui/spooky-smoke-animation";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="liquid-glass-page min-h-screen flex flex-col relative">
      {/* Animated smoke background */}
      <div className="fixed inset-0 z-0">
        <SmokeBackground smokeColor="#7C3AED" />
      </div>
      {/* Content layer above smoke */}
      <div className="relative z-10 min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
