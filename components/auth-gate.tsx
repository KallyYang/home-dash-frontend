"use client";

import { useState, useSyncExternalStore, type FormEvent } from "react";
import { Activity, Lock, AlertCircle, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "home-dash-auth";
const STORAGE_VALUE = "ok";
const AUTH_EVENT = "home-dash:auth-change";

function readAuth(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.sessionStorage.getItem(STORAGE_KEY) === STORAGE_VALUE;
  } catch {
    return false;
  }
}

function writeAuth(v: boolean) {
  if (typeof window === "undefined") return;
  try {
    if (v) {
      window.sessionStorage.setItem(STORAGE_KEY, STORAGE_VALUE);
    } else {
      window.sessionStorage.removeItem(STORAGE_KEY);
    }
    window.dispatchEvent(new Event(AUTH_EVENT));
  } catch {
    /* ignore */
  }
}

function subscribeAuth(callback: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(AUTH_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(AUTH_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

export function AuthGate({ children }: { children: React.ReactNode }) {
  const expected = process.env.NEXT_PUBLIC_ACCESS_PASSWORD ?? "";
  const enabled = expected.length > 0;

  const storedAuthed = useSyncExternalStore(
    subscribeAuth,
    readAuth,
    () => false
  );
  const authed = !enabled || storedAuthed;

  const hydrated = useSyncExternalStore(
    subscribeAuth,
    () => true,
    () => false
  );

  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!hydrated) {
    return null;
  }

  if (authed) {
    return <>{children}</>;
  }

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    if (password === expected) {
      writeAuth(true);
      setPassword("");
    } else {
      setError("密码错误,请重试");
    }
    setSubmitting(false);
  };

  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-background px-4">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,theme(colors.primary/15),transparent_60%)]"
      />
      <Card className="w-full max-w-sm border-border/70 bg-card/95 shadow-lg shadow-primary/10">
        <CardHeader className="items-center gap-3 text-center">
          <span className="flex size-11 items-center justify-center rounded-xl bg-gradient-brand shadow-md shadow-primary/30 ring-1 ring-white/20">
            <Activity className="size-5 text-white" strokeWidth={2.25} />
          </span>
          <div className="space-y-1">
            <CardTitle className="text-gradient-brand text-lg font-semibold tracking-tight">
              home-dash
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  id="access-password"
                  type="password"
                  autoFocus
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (error) setError(null);
                  }}
                  className={cn(
                    "h-10 w-full rounded-md border border-border/70 bg-background/60 pl-9 pr-12 text-sm shadow-sm transition-colors",
                    "placeholder:text-muted-foreground/70",
                    "focus:border-primary/60 focus:outline-none focus:ring-2 focus:ring-primary/30",
                    error && "border-destructive/70 focus:border-destructive focus:ring-destructive/30"
                  )}
                />
                <Button
                  type="submit"
                  size="icon"
                  aria-label="进入"
                  disabled={submitting || password.length === 0}
                  className="absolute right-1 top-1/2 size-8 -translate-y-1/2"
                >
                  <ArrowRight className="size-4" />
                </Button>
              </div>
              {error && (
                <p className="flex items-center gap-1.5 text-xs text-destructive">
                  <AlertCircle className="size-3.5" />
                  {error}
                </p>
              )}
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export function lockSession() {
  writeAuth(false);
}
