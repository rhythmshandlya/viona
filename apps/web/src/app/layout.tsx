import { Geist_Mono, Geist, DM_Sans, Outfit } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { baseUrl, createMetadata } from "@/utils/metadata";
import {
  StoreInitializer,
  BackgroundUploadRunner
} from "@/components/store-initializer";
import { QueryProvider } from "@/components/query-provider";
import { StytchProvider } from "@/components/stytch-provider";
import { Analytics } from "@vercel/analytics/react";

import "./globals.css";

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"]
});

const geist = Geist({
  variable: "--font-geist",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"]
});

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"]
});

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"]
});

export const metadata = createMetadata({
  title: {
    template: "%s | Cllipify",
    default: "Cllipify"
  },
  description: "Transform your explainer videos with AI-generated visuals, auto-transcription, and animated subtitles.",
  metadataBase: baseUrl
});

export default async function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistMono.variable} ${geist.variable} ${outfit.variable} ${dmSans.variable} antialiased font-sans bg-background`}
        suppressHydrationWarning
      >
        <StytchProvider>
          <QueryProvider>
            {children}
            <StoreInitializer />
            <BackgroundUploadRunner />
            <Toaster />
          </QueryProvider>
        </StytchProvider>
        <Analytics />
      </body>
    </html>
  );
}
