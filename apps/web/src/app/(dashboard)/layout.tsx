"use client";

import { Sidebar } from "@/components/sidebar";
import { SmokeBackground } from "@/components/ui/spooky-smoke-animation";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="liquid-glass-page min-h-screen relative">
      {/* Animated smoke background */}
      <div className="fixed inset-0 z-0">
        <SmokeBackground smokeColor="#3B1578" />
      </div>
      {/* Sidebar */}
      <Sidebar />
      {/* Content layer — offset by sidebar width */}
      <div className="relative z-10 min-h-screen pl-16">
        <main className="min-h-screen">{children}</main>
      </div>
    </div>
  );
}
