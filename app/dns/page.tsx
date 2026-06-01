"use client";

import useSWR from "swr";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertCircle,
  Globe,
  ShieldCheck,
  Timer,
  Users,
  Server,
  ListOrdered,
} from "lucide-react";
import { fetcher } from "@/lib/api";
import type { DNSSnapshot } from "@/lib/types";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { StaggerContainer } from "@/components/stagger-container";
import { PageHeader } from "@/components/page-header";

interface Wrapped<T> {
  data: T | null;
  updated_at?: string;
  error?: string;
}

export default function DNSPage() {
  const { data, isLoading } = useSWR<Wrapped<DNSSnapshot>>(
    "/api/dns",
    fetcher,
    { refreshInterval: 30_000 },
  );

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="DNS" description="Loading…" />
        <StaggerContainer className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </StaggerContainer>
        <Skeleton className="h-72" />
      </div>
    );
  }

  if (!data?.data) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="size-4" />
        <AlertTitle>DNS collector unavailable</AlertTitle>
        <AlertDescription>
          {data?.error ??
            "DNS collector is not enabled or unreachable. Set DNS_ENABLED=true on the backend and provide DNS_URL / DNS_COOKIE (or DNS_USERNAME/DNS_PASSWORD)."}
        </AlertDescription>
      </Alert>
    );
  }

  const snap = data.data;

  const blockedPct =
    snap.num_dns_queries > 0
      ? (snap.num_blocked_filtering / snap.num_dns_queries) * 100
      : 0;

  const queriesSeries = buildSeries(
    snap.dns_queries,
    snap.blocked_filtering,
    snap.time_units,
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="DNS"
        description={snap.source_url || "AdGuard Home"}
      />

      <StaggerContainer className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <SummaryCard
          icon={<Globe className="h-4 w-4" />}
          label="Total DNS Queries"
          primary={snap.num_dns_queries.toLocaleString()}
          secondary={`Window ${unitLabel(snap.time_units)}`}
        />
        <SummaryCard
          icon={<ShieldCheck className="h-4 w-4" />}
          label="Blocked"
          primary={snap.num_blocked_filtering.toLocaleString()}
          secondary={`Rate ${blockedPct.toFixed(2)}%`}
        />
        <SummaryCard
          icon={<Timer className="h-4 w-4" />}
          label="Avg Processing Time"
          primary={`${(snap.avg_processing_time * 1000).toFixed(2)} ms`}
          secondary="avg_processing_time"
        />
        <SummaryCard
          icon={<Users className="h-4 w-4" />}
          label="Active Clients"
          primary={`${snap.top_clients.length}`}
          secondary={
            snap.top_clients[0]
              ? `Top: ${snap.top_clients[0].name}`
              : "No data"
          }
        />
      </StaggerContainer>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between space-y-0">
          <div>
            <CardTitle className="text-base">DNS Query Trend</CardTitle>
            <CardDescription>
              {queriesSeries.length
                ? `Last ${queriesSeries.length} ${unitLabel(snap.time_units)}`
                : "No data"}
            </CardDescription>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <LegendDot className="bg-primary" label="Queries" />
            <LegendDot className="bg-destructive" label="Blocked" />
          </div>
        </CardHeader>
        <CardContent>
          {queriesSeries.length === 0 ? (
            <p className="text-sm text-muted-foreground">No query data.</p>
          ) : (
            <div className="h-48 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={queriesSeries}
                  margin={{ top: 10, right: 16, left: 0, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="hsl(var(--border))"
                  />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                    stroke="hsl(var(--border))"
                  />
                  <YAxis
                    width={40}
                    tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                    stroke="hsl(var(--border))"
                  />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--popover))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                      fontSize: 12,
                      color: "hsl(var(--popover-foreground))",
                    }}
                    labelStyle={{ color: "hsl(var(--muted-foreground))" }}
                  />
                  <Bar
                    dataKey="queries"
                    name="Queries"
                    fill="hsl(220 40% 30%)"
                    radius={[6, 6, 0, 0]}
                  />
                  <Bar
                    dataKey="blocked"
                    name="Blocked"
                    fill="hsl(2 62% 50%)"
                    radius={[6, 6, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <TopList
          icon={<ListOrdered className="h-4 w-4" />}
          title="Top Queried Domains"
          description="Domains with the most lookups"
          rows={snap.top_queried_domains.slice(0, 15).map((e) => ({
            name: e.name,
            value: e.count.toLocaleString(),
          }))}
        />
        <TopList
          icon={<Users className="h-4 w-4" />}
          title="Top Clients"
          description="Clients with the most requests"
          rows={snap.top_clients.slice(0, 15).map((e) => ({
            name: e.name,
            value: e.count.toLocaleString(),
          }))}
        />
        <TopList
          icon={<ShieldCheck className="h-4 w-4" />}
          title="Top Blocked Domains"
          description="Domains blocked by filter rules"
          rows={snap.top_blocked_domains.slice(0, 15).map((e) => ({
            name: e.name,
            value: e.count.toLocaleString(),
          }))}
          emptyLabel="No blocked records"
        />
        <TopList
          icon={<Server className="h-4 w-4" />}
          title="Upstream DNS Responses"
          description="Response count and avg latency per upstream server"
          rows={snap.top_upstreams_responses.map((e) => {
            const avg = snap.top_upstreams_avg_time.find(
              (x) => x.name === e.name,
            );
            return {
              name: e.name,
              value: `${e.count.toLocaleString()}${
                avg ? ` · ${(avg.avg_time * 1000).toFixed(2)} ms` : ""
              }`,
            };
          })}
        />
      </div>
    </div>
  );
}

function SummaryCard({
  icon,
  label,
  primary,
  secondary,
}: {
  icon: React.ReactNode;
  label: string;
  primary: string;
  secondary: string;
}) {
  return (
    <Card className="h-full overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 pb-1.5">
        <CardTitle className="text-xs font-medium text-foreground/90">
          {label}
        </CardTitle>
        <span className="text-muted-foreground">{icon}</span>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <div className="text-xl font-semibold tracking-tight text-foreground">
          {primary}
        </div>
        <CardDescription className="mt-0.5 line-clamp-2 text-xs">
          {secondary}
        </CardDescription>
      </CardContent>
    </Card>
  );
}

function TopList({
  icon,
  title,
  description,
  rows,
  emptyLabel,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  rows: { name: string; value: string }[];
  emptyLabel?: string;
}) {
  const max =
    rows.reduce((acc, r) => {
      const n = Number(r.value.replace(/[^\d.]/g, "")) || 0;
      return n > acc ? n : acc;
    }, 0) || 1;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div>
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
        <span className="text-muted-foreground">{icon}</span>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {emptyLabel ?? "No data"}
          </p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {rows.map((r, i) => {
              const n = Number(r.value.replace(/[^\d.]/g, "")) || 0;
              const pct = Math.max(2, Math.round((n / max) * 100));
              return (
                <li key={`${r.name}-${i}`} className="flex flex-col gap-1">
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="truncate font-mono text-xs text-foreground/80">
                      {r.name}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {r.value}
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted/70">
                    <div
                      className="h-full rounded-full bg-primary/80"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function LegendDot({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`inline-block h-2 w-3 rounded ${className}`} />
      {label}
    </span>
  );
}

function buildSeries(
  queries: number[] | undefined,
  blocked: number[] | undefined,
  unit: string,
) {
  const q = queries ?? [];
  const b = blocked ?? [];
  const len = Math.max(q.length, b.length);
  const out: { label: string; queries: number; blocked: number }[] = [];
  for (let i = 0; i < len; i++) {
    out.push({
      label: buildLabel(i, len, unit),
      queries: q[i] ?? 0,
      blocked: b[i] ?? 0,
    });
  }
  return out;
}

function buildLabel(index: number, total: number, unit: string) {
  const offset = total - 1 - index;
  if (unit === "hours") {
    return offset === 0 ? "now" : `-${offset}h`;
  }
  if (unit === "days") {
    return offset === 0 ? "Today" : `-${offset}d`;
  }
  return `${index}`;
}

function unitLabel(unit: string) {
  switch (unit) {
    case "hours":
      return "hours";
    case "days":
      return "days";
    case "minutes":
      return "minutes";
    default:
      return unit || "";
  }
}
