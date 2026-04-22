export const dynamic = "force-dynamic";

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="liquid-glass-page min-h-screen flex flex-col relative">
      {children}
    </div>
  );
}
