import type { Metadata } from "next";
import "./globals.css";
import { SiteHeader } from "@/components/site-header";
import { AuthGate } from "@/components/auth-gate";
import { BackendGate } from "@/components/backend-gate";

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
      <body className="min-h-dvh bg-background font-sans text-foreground antialiased">
        <AuthGate>
          <BackendGate>
            <div className="relative flex min-h-dvh flex-col">
              <SiteHeader />
              <main className="container max-w-screen-2xl flex-1 py-8">
                {children}
              </main>
            </div>
          </BackendGate>
        </AuthGate>
      </body>
    </html>
  );
}
