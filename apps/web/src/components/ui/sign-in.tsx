import React, { useState } from "react";
import { Loader2 } from "lucide-react";
import { VionaLogo } from "@/components/viona-logo";

const GoogleIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 48 48">
    <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s12-5.373 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-2.641-.21-5.236-.611-7.743z" />
    <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" />
    <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" />
    <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571l6.19 5.238C42.022 35.026 44 30.038 44 24c0-2.641-.21-5.236-.611-7.743z" />
  </svg>
);

export interface Testimonial {
  avatarSrc: string;
  name: string;
  handle: string;
  text: string;
}

interface SignInPageProps {
  title?: React.ReactNode;
  description?: React.ReactNode;
  heroImageSrc?: string;
  testimonials?: Testimonial[];
  onEmailSubmit?: (email: string) => Promise<void> | void;
  onGoogleSignIn?: () => Promise<void> | void;
  isSubmittingEmail?: boolean;
  isSubmittingGoogle?: boolean;
  statusMessage?: { kind: "success" | "error"; text: string } | null;
}

const GlassInputWrapper = ({ children }: { children: React.ReactNode }) => (
  <div className="rounded-2xl border border-border bg-foreground/5 backdrop-blur-sm transition-colors focus-within:border-[#8B5CF6]/70 focus-within:bg-[#8B5CF6]/10">
    {children}
  </div>
);

const TestimonialCard = ({ testimonial, delay }: { testimonial: Testimonial; delay: string }) => (
  <div
    className={`animate-testimonial ${delay} flex items-start gap-3 rounded-2xl bg-card/50 backdrop-blur-xl border border-white/10 p-4 w-56 shrink-0`}
  >
    <img src={testimonial.avatarSrc} className="h-9 w-9 object-cover rounded-xl shrink-0" alt="avatar" />
    <div className="text-xs leading-snug min-w-0">
      <p className="font-medium truncate">{testimonial.name}</p>
      <p className="text-muted-foreground truncate">{testimonial.handle}</p>
      <p className="mt-1 text-foreground/80 line-clamp-3">{testimonial.text}</p>
    </div>
  </div>
);

export const SignInPage: React.FC<SignInPageProps> = ({
  title = <VionaLogo size="lg" />,
  description = "miss us? yeah, we missed you too.",
  heroImageSrc,
  testimonials = [],
  onEmailSubmit,
  onGoogleSignIn,
  isSubmittingEmail = false,
  isSubmittingGoogle = false,
  statusMessage,
}) => {
  const [email, setEmail] = useState("");

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!email.trim()) return;
    onEmailSubmit?.(email.trim());
  };

  const anyLoading = isSubmittingEmail || isSubmittingGoogle;

  return (
    <div className="h-[100dvh] flex flex-col md:flex-row w-[100dvw]">
      <section className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="flex flex-col gap-6">
            <h1 className="animate-element animate-delay-100 text-4xl md:text-5xl font-semibold leading-tight text-foreground">
              {title}
            </h1>
            <p className="animate-element animate-delay-200 text-muted-foreground">{description}</p>

            <form className="space-y-5" onSubmit={handleSubmit}>
              <div className="animate-element animate-delay-300">
                <label htmlFor="signin-email" className="text-sm font-medium text-muted-foreground">
                  Email Address
                </label>
                <GlassInputWrapper>
                  <input
                    id="signin-email"
                    name="email"
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full bg-transparent text-sm p-4 rounded-2xl focus:outline-none text-foreground placeholder:text-muted-foreground/60"
                    disabled={anyLoading}
                  />
                </GlassInputWrapper>
              </div>

              {statusMessage && (
                <div
                  className={`animate-element text-sm rounded-xl px-4 py-3 border ${
                    statusMessage.kind === "success"
                      ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
                      : "border-destructive/40 bg-destructive/10 text-destructive"
                  }`}
                  role="status"
                >
                  {statusMessage.text}
                </div>
              )}

              <button
                type="submit"
                disabled={anyLoading || !email.trim()}
                className="animate-element animate-delay-500 w-full rounded-2xl bg-primary py-4 font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isSubmittingEmail && <Loader2 className="w-4 h-4 animate-spin" />}
                {isSubmittingEmail ? "Sending magic link..." : "Send magic link"}
              </button>
            </form>

            <div className="animate-element animate-delay-600 relative flex items-center justify-center">
              <span className="w-full border-t border-border"></span>
              <span className="px-4 text-sm text-muted-foreground bg-background absolute">
                Or continue with
              </span>
            </div>

            <button
              type="button"
              onClick={onGoogleSignIn}
              disabled={anyLoading}
              className="animate-element animate-delay-700 w-full flex items-center justify-center gap-3 border border-border rounded-2xl py-4 hover:bg-secondary transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isSubmittingGoogle ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <GoogleIcon />
              )}
              Continue with Google
            </button>

            <p className="animate-element animate-delay-800 text-center text-xs text-muted-foreground leading-relaxed">
              By continuing, you agree to our Terms of Service and Privacy Policy.
              <br />
              New here? The magic link will create your account automatically.
            </p>
          </div>
        </div>
      </section>

      {heroImageSrc && (
        <section className="hidden md:block flex-1 relative p-4">
          <div
            className="animate-slide-right animate-delay-300 absolute inset-4 rounded-3xl bg-cover bg-center"
            style={{ backgroundImage: `url(${heroImageSrc})` }}
          />
          <div className="animate-slide-right animate-delay-300 absolute inset-4 rounded-3xl bg-gradient-to-tr from-[#3B1578]/40 via-transparent to-transparent pointer-events-none" />
          {testimonials.length > 0 && (
            <div className="absolute bottom-8 left-8 right-8 flex gap-3 justify-center">
              <TestimonialCard testimonial={testimonials[0]} delay="animate-delay-1000" />
              {testimonials[1] && (
                <div className="hidden 2xl:block">
                  <TestimonialCard testimonial={testimonials[1]} delay="animate-delay-1200" />
                </div>
              )}
              {testimonials[2] && (
                <div className="hidden min-[1920px]:block">
                  <TestimonialCard testimonial={testimonials[2]} delay="animate-delay-1400" />
                </div>
              )}
            </div>
          )}
        </section>
      )}
    </div>
  );
};
