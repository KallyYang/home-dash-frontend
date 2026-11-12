import type { Metadata } from "next";
import "./globals.css";
import { SiteHeader } from "@/components/site-header";
import { AuthGate } from "@/components/auth-gate";
import { BackendGate } from "@/components/backend-gate";
import { EdgeNodeStatus } from "@/components/edge-node-status";

export const metadata: Metadata = {
  title: "HomeDash",
  description: "Monitor PVE and Kubernetes from a single pane.",
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    shortcut: [{ url: "/icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/icon.svg", type: "image/svg+xml" }],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-dvh overflow-x-hidden bg-background font-sans text-foreground antialiased">
        <AuthGate>
          <div className="relative flex min-h-dvh flex-col">
            <SiteHeader />
            <EdgeNodeStatus />
            <BackendGate>
              <main className="container max-w-screen-2xl flex-1 py-6 sm:py-8">
                {children}
              </main>
            </BackendGate>
          </div>
        </AuthGate>
      </body>
    </html>
  );
}
