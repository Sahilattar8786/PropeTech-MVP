import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Google_Sans } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { getAppUrl, getDeploymentStage, siteConfig } from "@/lib/config/site";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
/** Wordmark + headings (the brand board's lettering). next/font has no fallback metrics for it; Geist is the CSS fallback. */
const googleSans = Google_Sans({ variable: "--font-google-sans", subsets: ["latin"], weight: ["500", "600", "700"], adjustFontFallback: false });

const isStaging = getDeploymentStage() === "staging";

export const metadata: Metadata = {
  metadataBase: new URL(getAppUrl()),
  title: { default: `${siteConfig.name} — ${siteConfig.tagline}`, template: `%s · ${siteConfig.name}` },
  description: siteConfig.description,
  applicationName: siteConfig.name,
  // Staging mirrors production content; keep it out of search results.
  ...(isStaging && { robots: { index: false, follow: false } }),
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} ${googleSans.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <TooltipProvider delayDuration={200}>{children}</TooltipProvider>
        <Toaster position="top-center" richColors closeButton />
        {isStaging && (
          <div className="pointer-events-none fixed bottom-20 left-3 z-50 rounded-full bg-amber-400 px-2.5 py-1 text-[11px] font-semibold tracking-wide text-amber-950 uppercase shadow-soft lg:bottom-3">
            Staging
          </div>
        )}
      </body>
    </html>
  );
}
