"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Activity, RefreshCw, ServerCrash, WifiOff } from "lucide-react";
import { getApiBase } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Status = "checking" | "online" | "offline";

const HEALTH_PATH = "/api/health";
const POLL_INTERVAL_MS = 15_000;
const REQUEST_TIMEOUT_MS = 5_000;

async function probeBackend(signal?: AbortSignal): Promise<boolean> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
  const onAbort = () => ctrl.abort();
  if (signal) {
    if (signal.aborted) ctrl.abort();
    else signal.addEventListener("abort", onAbort, { once: true });
  }
  try {
    const base = await getApiBase();
    const res = await fetch(`${base}${HEALTH_PATH}`, {
      method: "GET",
      cache: "no-store",
      signal: ctrl.signal,
    });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
    if (signal) signal.removeEventListener("abort", onAbort);
  }
}

export function BackendGate({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<Status>("checking");
  const [lastCheckedAt, setLastCheckedAt] = useState<Date | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [apiBase, setApiBase] = useState<string>("");
  const mountedRef = useRef(true);

  const runCheck = useCallback(async () => {
    const ok = await probeBackend();
    if (!mountedRef.current) return;
    setStatus(ok ? "online" : "offline");
    setLastCheckedAt(new Date());
    try {
      const base = await getApiBase();
      if (mountedRef.current) setApiBase(base);
    } catch {
      // ignore, keep previous value
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    runCheck();
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        runCheck();
      }
    }, POLL_INTERVAL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") runCheck();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      mountedRef.current = false;
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [runCheck]);

  const handleRetry = useCallback(async () => {
    setRetrying(true);
    await runCheck();
    if (mountedRef.current) setRetrying(false);
  }, [runCheck]);

  if (status === "checking") {
    return (
      <div className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-background px-4">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,theme(colors.primary/10),transparent_60%)]"
        />
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <span className="flex size-11 items-center justify-center rounded-xl bg-gradient-brand shadow-md shadow-primary/30 ring-1 ring-white/20">
            <Activity className="size-5 text-white" strokeWidth={2.25} />
          </span>
          <p className="flex items-center gap-2 text-sm">
            <RefreshCw className="size-3.5 animate-spin" />
            正在连接后端服务…
          </p>
        </div>
      </div>
    );
  }

  if (status === "offline") {
    return (
      <div className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-background px-4">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,theme(colors.destructive/15),transparent_60%)]"
        />
        <Card className="w-full max-w-md border-destructive/40 bg-card/95 shadow-xl shadow-destructive/10">
          <CardHeader className="items-center gap-3 pb-2 text-center">
            <span
              className={cn(
                "flex size-12 items-center justify-center rounded-xl",
                "bg-destructive/10 text-destructive ring-1 ring-destructive/30",
              )}
            >
              <ServerCrash className="size-6" strokeWidth={2.1} />
            </span>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="rounded-md border border-border/60 bg-muted/40 px-3 py-2.5 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5 font-medium text-foreground/80">
                <WifiOff className="size-3.5" />
                连接信息
              </div>
              <ul className="mt-1.5 space-y-0.5 font-mono">
                <li className="truncate">
                  <span className="text-muted-foreground/80">Endpoint · </span>
                  {apiBase}
                  {HEALTH_PATH}
                </li>
                {lastCheckedAt && (
                  <li>
                    <span className="text-muted-foreground/80">
                      Last try · {" "}
                    </span>
                    {lastCheckedAt.toLocaleTimeString()}
                  </li>
                )}
              </ul>
            </div>
            <Button
              type="button"
              onClick={handleRetry}
              disabled={retrying}
              className="w-full"
            >
              <RefreshCw
                className={cn("size-4", retrying && "animate-spin")}
              />
              {retrying ? "重新尝试中…" : "重新连接"}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}
