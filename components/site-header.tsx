"use client";

import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";
import { Activity, LogOut } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { lockSession } from "@/components/auth-gate";

const nav: { href: Route; label: string }[] = [
  { href: "/" as Route, label: "Overview" },
  { href: "/pve" as Route, label: "Proxmox" },
  { href: "/k8s" as Route, label: "Kubernetes" },
  { href: "/proxy" as Route, label: "Proxy" },
  { href: "/dns" as Route, label: "DNS" },
  { href: "/cfai" as Route, label: "AI" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const authEnabled = (process.env.NEXT_PUBLIC_ACCESS_PASSWORD ?? "").length > 0;

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/70 backdrop-blur-md supports-[backdrop-filter]:bg-background/60">
      <div className="container max-w-screen-2xl py-2 sm:py-0">
        <div className="flex flex-col gap-2 sm:h-14 sm:flex-row sm:items-center sm:gap-0">
          <div className="flex items-center justify-between sm:mr-6 sm:justify-start">
            <Link href={"/" as Route} className="flex items-center gap-2">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-gradient-brand shadow-sm shadow-primary/30 ring-1 ring-white/20">
                <Activity className="size-4 text-white" strokeWidth={2.25} />
              </span>
              <span className="text-gradient-brand text-base font-semibold tracking-tight whitespace-nowrap">
                HomeDash
              </span>
            </Link>
            {authEnabled && (
              <button
                type="button"
                onClick={() => lockSession()}
                className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground sm:hidden"
                title="锁定面板"
              >
                <LogOut className="size-3.5" />
              </button>
            )}
          </div>
          <nav className="-mx-1 flex items-center gap-4 overflow-x-auto px-1 pb-1 text-sm [-ms-overflow-style:none] [scrollbar-width:none] sm:overflow-visible sm:pb-0 lg:gap-6 [&::-webkit-scrollbar]:hidden">
            {nav.map((n) => {
              const isActive =
                n.href === "/"
                  ? pathname === "/"
                  : pathname?.startsWith(n.href);
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  className={cn(
                    "relative shrink-0 py-1 transition-colors duration-200 hover:text-foreground",
                    isActive
                      ? "text-foreground font-medium"
                      : "text-muted-foreground"
                  )}
                >
                  {n.label}
                  {isActive && (
                    <motion.span
                      layoutId="nav-indicator"
                      className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-gradient-brand sm:-bottom-0.5"
                      transition={{
                        type: "spring",
                        stiffness: 380,
                        damping: 32,
                      }}
                    />
                  )}
                </Link>
              );
            })}
          </nav>
          {authEnabled && (
            <div className="ml-auto hidden items-center sm:flex">
              <button
                type="button"
                onClick={() => lockSession()}
                className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                title="锁定面板"
              >
                <LogOut className="size-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
