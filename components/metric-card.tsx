import Link from "next/link";
import type { Route } from "next";
import { CircleDot, CircleOff, CircleAlert, CircleHelp, type LucideIcon } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Tone = "indigo" | "slate" | "teal" | "amber" | "rose";

interface MetricCardProps {
  title: string;
  icon: LucideIcon;
  value?: string;
  description?: string;
  status: "online" | "offline" | "warn" | "unknown";
  href?: string;
  error?: string;
  tone?: Tone;
}

const statusIconMap: Record<
  MetricCardProps["status"],
  { Icon: LucideIcon; className: string; label: string }
> = {
  online: { Icon: CircleDot, className: "text-success", label: "Online" },
  offline: { Icon: CircleOff, className: "text-destructive", label: "Offline" },
  warn: { Icon: CircleAlert, className: "text-warning", label: "Warn" },
  unknown: { Icon: CircleHelp, className: "text-muted-foreground", label: "Unknown" },
};

const toneMap: Record<Tone, { bg: string; text: string; ring: string; glow: string }> = {
  indigo: {
    bg: "bg-indigo-900/5 dark:bg-indigo-300/10",
    text: "text-indigo-900/80 dark:text-indigo-200",
    ring: "ring-indigo-900/10 dark:ring-indigo-300/20",
    glow: "from-indigo-900/5 dark:from-indigo-300/10",
  },
  slate: {
    bg: "bg-slate-700/5 dark:bg-slate-300/10",
    text: "text-slate-700 dark:text-slate-200",
    ring: "ring-slate-700/10 dark:ring-slate-300/20",
    glow: "from-slate-700/5 dark:from-slate-300/10",
  },
  teal: {
    bg: "bg-teal-800/5 dark:bg-teal-300/10",
    text: "text-teal-800 dark:text-teal-200",
    ring: "ring-teal-800/10 dark:ring-teal-300/20",
    glow: "from-teal-800/5 dark:from-teal-300/10",
  },
  amber: {
    bg: "bg-amber-700/5 dark:bg-amber-300/10",
    text: "text-amber-800 dark:text-amber-200",
    ring: "ring-amber-700/15 dark:ring-amber-300/20",
    glow: "from-amber-700/5 dark:from-amber-300/10",
  },
  rose: {
    bg: "bg-rose-800/5 dark:bg-rose-300/10",
    text: "text-rose-800 dark:text-rose-200",
    ring: "ring-rose-800/10 dark:ring-rose-300/20",
    glow: "from-rose-800/5 dark:from-rose-300/10",
  },
};

export function MetricCard({
  title,
  icon: Icon,
  value,
  description,
  status,
  href,
  error,
  tone = "indigo",
}: MetricCardProps) {
  const s = statusIconMap[status];
  const StatusIcon = s.Icon;
  const t = toneMap[tone];

  const content = (
    <Card
      className={cn(
        "group relative h-full overflow-hidden",
        href && "transition-all hover:-translate-y-0.5"
      )}
    >
      <div
        className={cn(
          "pointer-events-none absolute -right-10 -top-10 size-32 rounded-full bg-gradient-to-br to-transparent opacity-70 blur-2xl",
          t.glow
        )}
        aria-hidden
      />
      <CardHeader className="flex flex-row items-center justify-between space-y-0 gap-2 p-4 pb-1.5">
        <CardTitle className="flex min-w-0 items-center gap-2 text-xs font-medium">
          <span
            className={cn(
              "flex size-7 shrink-0 items-center justify-center rounded-md ring-1",
              t.bg,
              t.text,
              t.ring
            )}
          >
            <Icon className="size-3.5" strokeWidth={2.25} />
          </span>
          <span className="truncate text-foreground/90">{title}</span>
        </CardTitle>
        <StatusIcon
          className={cn("size-4 shrink-0", s.className)}
          strokeWidth={2.25}
          aria-label={s.label}
        />
      </CardHeader>
      <CardContent className="px-4 pb-2">
        <div className="text-xl font-semibold tracking-tight text-foreground">
          {value ?? "—"}
        </div>
        <CardDescription className="mt-0.5 line-clamp-2 text-xs">
          {description ?? ""}
        </CardDescription>
      </CardContent>
    </Card>
  );

  if (href) {
    return (
      <Link
        href={href as Route}
        className="block rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        {content}
      </Link>
    );
  }

  return content;
}
