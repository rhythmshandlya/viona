import type { SVGProps } from "react";

export function VionaMark({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 40 40"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={className}
      {...props}
    >
      <circle cx="12" cy="12" r="3.2" fill="currentColor" />
      <rect
        x="18.5"
        y="8"
        width="6.4"
        height="24"
        rx="3.2"
        fill="currentColor"
        transform="rotate(45 21.7 20)"
      />
    </svg>
  );
}

interface VionaLogoProps {
  size?: "sm" | "md" | "lg";
  showWordmark?: boolean;
  className?: string;
}

const SIZE_MAP = {
  sm: { mark: "h-5 w-5", text: "text-base" },
  md: { mark: "h-7 w-7", text: "text-lg" },
  lg: { mark: "h-20 w-20", text: "text-5xl md:text-6xl" },
} as const;

export function VionaLogo({ size = "md", showWordmark = true, className = "" }: VionaLogoProps) {
  const s = SIZE_MAP[size];
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <VionaMark className={`${s.mark} text-[#8B5CF6] shrink-0`} />
      {showWordmark && (
        <span className={`${s.text} font-normal lowercase text-foreground tracking-tight`}>
          viona
        </span>
      )}
    </span>
  );
}
