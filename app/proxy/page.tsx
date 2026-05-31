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
  Calendar,
  Cloud,
  Gauge,
  RotateCw,
} from "lucide-react";
import { fetcher } from "@/lib/api";
import type { ProxySnapshot } from "@/lib/types";
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

export default function ProxyPage() {
  const { data, isLoading } = useSWR<Wrapped<ProxySnapshot>>(
    "/api/proxy",
    fetcher,
    { refreshInterval: 30_000 },
  );

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Proxy" description="Loading…" />
        <StaggerContainer className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </StaggerContainer>
        <Skeleton className="h-48" />
      </div>
    );
  }

  if (!data?.data) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="size-4" />
        <AlertTitle>Proxy collector unavailable</AlertTitle>
        <AlertDescription>
          {data?.error ??
            "The proxy collector is disabled or the source page is unreachable. Set PROXY_ENABLED=true and provide PROXY_URL / PROXY_COOKIE in the backend env."}
        </AlertDescription>
      </Alert>
    );
  }

  const snap = data.data;
  const usedPct = clamp(snap.used_percent, 0, 100);
  const sortedUsage = [...snap.daily_usage].sort((a, b) =>
    a.date.localeCompare(b.date),
  );
  const chartData = sortedUsage.map((p) => ({
    date: p.date.slice(5),
    download: Number(p.download.toFixed(3)),
    upload: Number(p.upload.toFixed(3)),
    total: Number((p.download + p.upload).toFixed(3)),
  }));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Proxy"
        description={snap.service_name || "Proxy Service"}
      />

      <StaggerContainer className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <SummaryCard
          icon={<Gauge className="h-4 w-4" />}
          label="Used"
          primary={`${usedPct.toFixed(0)}%`}
          secondary={`${snap.used_gb.toFixed(2)} / ${snap.total_gb.toFixed(2)} GB`}
          pct={usedPct}
        />
        <SummaryCard
          icon={<Cloud className="h-4 w-4" />}
          label="Remaining"
          primary={`${snap.remaining_gb.toFixed(2)} GB`}
          secondary={`Total ${snap.total_gb.toFixed(2)} GB`}
        />
        <SummaryCard
          icon={<RotateCw className="h-4 w-4" />}
          label="Reset"
          primary={`${snap.reset_in_days} days`}
          secondary="Until next reset"
        />
        <SummaryCard
          icon={<Calendar className="h-4 w-4" />}
          label="Expiry"
          primary={`${snap.expire_in_days} days`}
          secondary="Until service expiry"
        />
      </StaggerContainer>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between space-y-0">
          <div>
            <CardTitle className="text-base">Recent Traffic</CardTitle>
            <CardDescription>
              {chartData.length
                ? `${chartData.length} days · Unit GB`
                : "No data"}
            </CardDescription>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <LegendDot color="hsl(215 55% 72%)" label="Download" />
            <LegendDot color="hsl(28 75% 78%)" label="Upload" />
          </div>
        </CardHeader>
        <CardContent>
          {chartData.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Unable to parse daily traffic details from the page.
            </p>
          ) : (
            <div className="h-48 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartData}
                  margin={{ top: 10, right: 16, left: 0, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="hsl(var(--border))"
                  />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                    stroke="hsl(var(--border))"
                  />
                  <YAxis
                    width={40}
                    tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                    stroke="hsl(var(--border))"
                    tickFormatter={(v) => `${v}`}
                  />
                  <Tooltip
                    cursor={{ fill: "hsl(var(--muted) / 0.3)" }}
                    contentStyle={{
                      background: "hsl(var(--popover))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                      fontSize: 12,
                      color: "hsl(var(--popover-foreground))",
                    }}
                    labelStyle={{ color: "hsl(var(--muted-foreground))" }}
                    formatter={(value: number, name) => [
                      `${value} GB`,
                      labelOf(name),
                    ]}
                  />
                  <Bar
                    dataKey="download"
                    name="download"
                    stackId="traffic"
                    fill="hsl(215 55% 72%)"
                    fillOpacity={0.85}
                    radius={[0, 0, 0, 0]}
                  />
                  <Bar
                    dataKey="upload"
                    name="upload"
                    stackId="traffic"
                    fill="hsl(28 75% 78%)"
                    fillOpacity={0.85}
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>
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
  pct?: number;
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

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

function LegendDot({
  color,
  label,
}: {
  color: string;
  label: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="inline-block h-2 w-2 rounded-full"
        style={{ backgroundColor: color }}
      />
      {label}
    </span>
  );
}

function labelOf(name: string | number | undefined) {
  switch (name) {
    case "download":
      return "Download";
    case "upload":
      return "Upload";
    case "total":
      return "Total";
    default:
      return String(name ?? "");
  }
}
