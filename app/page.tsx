"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import { Server, Boxes, Cloud, Globe, Sparkles, AlertCircle, type LucideIcon } from "lucide-react";
import { fetcher } from "@/lib/api";
import type { Overview } from "@/lib/types";
import { MetricCard } from "@/components/metric-card";
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { StaggerContainer } from "@/components/stagger-container";
import { PageHeader } from "@/components/page-header";

type Tone = "indigo" | "slate" | "teal" | "amber" | "rose";

function statusFromMeta(available: boolean, error?: string): "online" | "offline" | "warn" | "unknown" {
  if (error) return "warn";
  if (available) return "online";
  return "unknown";
}

function formatTokens(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "0";
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(2)}K`;
  return n.toLocaleString();
}

function formatCostShort(n: number): string {
  if (!Number.isFinite(n) || n === 0) return "$0";
  if (n < 0.01) return `$${n.toFixed(4)}`;
  if (n < 1) return `$${n.toFixed(3)}`;
  return `$${n.toFixed(2)}`;
}

function MetricCardSkeleton() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 pb-1.5">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-5 w-14" />
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-2">
        <Skeleton className="h-6 w-28" />
        <Skeleton className="h-3 w-full" />
      </CardContent>
    </Card>
  );
}

function formatTimeParts(date: Date) {
  return date
    .toLocaleTimeString("en-GB", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
    .split(":");
}

function TimeSegment({ current, previous }: { current: string; previous: string }) {
  const changed = current !== previous;

  return (
    <span className="time-flip" aria-hidden="true" data-changed={changed}>
      <span className="time-flip-static">{current}</span>
      {changed ? <span key={`prev-${previous}`} className="time-flip-leave">{previous}</span> : null}
      <span key={`next-${current}`} className="time-flip-enter">{current}</span>
    </span>
  );
}

function TimeTicker() {
  const [time, setTime] = useState(() => new Date());
  const [previousTime, setPreviousTime] = useState(() => new Date());
  const parts = formatTimeParts(time);
  const previousParts = formatTimeParts(previousTime);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setTime((current) => {
        setPreviousTime(current);
        return new Date();
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  return (
    <span className="inline-flex items-center gap-1 font-medium tabular-nums">
      <span className="text-muted-foreground">where the time is</span>
      <span className="inline-flex items-center">
        {parts.map((part, index) => (
          <span key={index} className="time-ticker-slot">
            <TimeSegment current={part} previous={previousParts[index] ?? part} />
            {index < parts.length - 1 ? <span className="text-muted-foreground">:</span> : null}
          </span>
        ))}
        <span className="sr-only">{time.toLocaleTimeString("en-GB", { hour12: false })}</span>
      </span>
    </span>
  );
}

export default function Page() {
  const { data, error, isLoading } = useSWR<Overview>("/api/overview", fetcher, {
    refreshInterval: 15_000,
  });

  const cards: Array<{
    key: string;
    title: string;
    icon: LucideIcon;
    tone: Tone;
    value?: string;
    description?: string;
    status: "online" | "offline" | "warn" | "unknown";
    error?: string;
    href: string;
  }> = data
    ? [
        {
          key: "pve",
          title: "Proxmox VE",
          icon: Server,
          tone: "indigo",
          value: data.pve ? `${data.pve.nodes.length} nodes` : undefined,
          description: data.pve?.fetched_at
            ? `Updated: ${new Date(data.pve.fetched_at).toLocaleTimeString()}`
            : "Not configured",
          status: statusFromMeta(data.pve_meta.available, data.pve_meta.error),
          error: data.pve_meta.error,
          href: "/pve",
        },
        {
          key: "k8s",
          title: "Kubernetes",
          icon: Boxes,
          tone: "slate",
          value: data.k8s
            ? `${data.k8s.node_count} nodes / ${data.k8s.pod_count} pods`
            : undefined,
          description: data.k8s?.version ? `Version: ${data.k8s.version}` : "Not configured",
          status: statusFromMeta(data.k8s_meta.available, data.k8s_meta.error),
          error: data.k8s_meta.error,
          href: "/k8s",
        },
        {
          key: "proxy",
          title: "Proxy",
          icon: Cloud,
          tone: "teal",
          value: data.proxy ? `${data.proxy.remaining_gb.toFixed(2)} GB left` : undefined,
          description: data.proxy ? `Resets in ${data.proxy.reset_in_days} days` : "Not configured",
          status: statusFromMeta(data.proxy_meta.available, data.proxy_meta.error),
          error: data.proxy_meta.error,
          href: "/proxy",
        },
        {
          key: "dns",
          title: "DNS",
          icon: Globe,
          tone: "amber",
          value: data.dns ? `${data.dns.num_dns_queries.toLocaleString()} queries` : undefined,
          description: data.dns
            ? `${data.dns.num_blocked_filtering.toLocaleString()} blocked · ${(data.dns.avg_processing_time * 1000).toFixed(2)} ms avg`
            : "Not configured",
          status: statusFromMeta(data.dns_meta.available, data.dns_meta.error),
          error: data.dns_meta.error,
          href: "/dns",
        },
        {
          key: "cfai",
          title: "AI",
          icon: Sparkles,
          tone: "rose",
          value: data.cfai
            ? `${data.cfai.total_requests.toLocaleString()} reqs`
            : undefined,
          description: data.cfai
            ? `${formatTokens(data.cfai.total_tokens)} tokens · ${formatCostShort(data.cfai.total_cost)} · ${data.cfai.window_days}d`
            : "Not configured",
          status: statusFromMeta(data.cfai_meta.available, data.cfai_meta.error),
          error: data.cfai_meta.error,
          href: "/cfai",
        },
      ]
    : [];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Overview"
        description={<TimeTicker />}
      />

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertTitle>Connection failed</AlertTitle>
          <AlertDescription>
            Failed to reach backend. Retrying automatically.
          </AlertDescription>
        </Alert>
      )}

      <StaggerContainer className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
        {isLoading || !data
          ? [0, 1, 2, 3, 4].map((i) => <MetricCardSkeleton key={i} />)
          : cards.map((c) => (
              <MetricCard
                key={c.key}
                title={c.title}
                icon={c.icon}
                tone={c.tone}
                value={c.value}
                description={c.description}
                status={c.status}
                error={c.error}
                href={c.href}
              />
            ))}
      </StaggerContainer>
    </div>
  );
}
