export const dynamic = "force-dynamic";

import { SmokeBackground } from "@/components/ui/spooky-smoke-animation";

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="liquid-glass-page min-h-screen flex flex-col relative">
      <div className="fixed inset-0 z-0">
        <SmokeBackground smokeColor="#3B1578" />
      </div>
      <div className="relative z-10 min-h-screen flex flex-col">
        {children}
      </div>
    </div>
  );
}
