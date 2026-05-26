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
  Activity,
  AlertCircle,
  Coins,
  Cpu,
  Database,
  ListOrdered,
  Sparkles,
} from "lucide-react";
import { fetcher } from "@/lib/api";
import type {
  CFAIDimensionEntry,
  CFAISnapshot,
  CFAITimePoint,
} from "@/lib/types";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { StaggerContainer } from "@/components/stagger-container";
import { PageHeader } from "@/components/page-header";

interface Wrapped<T> {
  data: T | null;
  updated_at?: string;
  error?: string;
}

export default function CFAIPage() {
  const { data, isLoading } = useSWR<Wrapped<CFAISnapshot>>(
    "/api/cfai",
    fetcher,
    { refreshInterval: 60_000 },
  );

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="AI" description="加载中…" />
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
        <AlertTitle>AI Gateway collector unavailable</AlertTitle>
        <AlertDescription>
          {data?.error ??
            "Cloudflare AI Gateway collector 未启用或无法访问。请在后端设置 CFAI_ENABLED=true，并提供 CFAI_ACCOUNT_ID 与具有 AI Gateway / Account Analytics Read 权限的 CFAI_API_TOKEN。"}
        </AlertDescription>
      </Alert>
    );
  }

  const snap = data.data;
  const description = snap.gateway_id
    ? `Gateway · ${snap.gateway_id}`
    : "Cloudflare AI Gateway";

  const dailySeries = fillDailyWindow(snap.daily_series, snap.window_days).map(
    (p) => ({
      label: formatDateLabel(p.ts),
      requests: p.requests,
      tokens: p.tokens,
      cost: round(p.cost, 4),
      cached: p.cached,
      errors: p.errors,
    }),
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="AI"
        description={`${description} · 最近 ${snap.window_days} 天`}
      />

      <StaggerContainer className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <SummaryCard
          icon={<Activity className="h-4 w-4" />}
          label="请求总数"
          primary={snap.total_requests.toLocaleString()}
          secondary={`错误率 ${snap.error_pct.toFixed(2)}%`}
        />
        <SummaryCard
          icon={<Sparkles className="h-4 w-4" />}
          label="Token 总量"
          primary={
            snap.total_tokens > 0 ? formatNumber(snap.total_tokens) : "—"
          }
          secondary={
            snap.total_tokens > 0 && snap.total_requests > 0
              ? `≈ ${formatNumber(Math.round(snap.total_tokens / snap.total_requests))} tok / req`
              : "暂无数据"
          }
        />
        <SummaryCard
          icon={<Coins className="h-4 w-4" />}
          label="成本估算"
          primary={formatCost(snap.total_cost)}
          secondary={
            snap.total_requests > 0
              ? `≈ ${formatCost(snap.total_cost / snap.total_requests)} / req`
              : "暂无请求"
          }
        />
        <SummaryCard
          icon={<Database className="h-4 w-4" />}
          label="缓存命中"
          primary={`${snap.cache_hit_pct.toFixed(2)}%`}
          secondary={`命中 ${snap.total_cached.toLocaleString()} 次`}
        />
      </StaggerContainer>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-start justify-between space-y-0">
            <div>
              <CardTitle className="text-base">每日请求与缓存</CardTitle>
              <CardDescription>
                {dailySeries.length
                  ? `最近 ${dailySeries.length} 天`
                  : "暂无数据"}
              </CardDescription>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <LegendDot className="bg-primary" label="请求" />
              <LegendDot className="bg-emerald-500" label="缓存" />
              <LegendDot className="bg-destructive" label="错误" />
            </div>
          </CardHeader>
          <CardContent>
            {dailySeries.length === 0 ? (
              <p className="text-sm text-muted-foreground">暂无请求数据。</p>
            ) : (
              <div className="h-48 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={dailySeries}
                    margin={{ top: 10, right: 16, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="hsl(var(--border))"
                    />
                    <XAxis
                      dataKey="label"
                      tick={{
                        fontSize: 12,
                        fill: "hsl(var(--muted-foreground))",
                      }}
                      stroke="hsl(var(--border))"
                    />
                    <YAxis
                      width={50}
                      tick={{
                        fontSize: 12,
                        fill: "hsl(var(--muted-foreground))",
                      }}
                      stroke="hsl(var(--border))"
                    />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      labelStyle={{ color: "hsl(var(--muted-foreground))" }}
                      cursor={{ fill: "hsl(var(--muted) / 0.3)" }}
                    />
                    <Bar
                      dataKey="requests"
                      name="请求"
                      fill="hsl(220 40% 30%)"
                      radius={[6, 6, 0, 0]}
                      maxBarSize={24}
                    />
                    <Bar
                      dataKey="cached"
                      name="缓存"
                      fill="hsl(152 60% 40%)"
                      radius={[6, 6, 0, 0]}
                      maxBarSize={24}
                    />
                    <Bar
                      dataKey="errors"
                      name="错误"
                      fill="hsl(2 62% 50%)"
                      radius={[6, 6, 0, 0]}
                      maxBarSize={24}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-start justify-between space-y-0">
            <div>
              <CardTitle className="text-base">每日 Token 与成本</CardTitle>
              <CardDescription>
                {dailySeries.length
                  ? `最近 ${dailySeries.length} 天`
                  : "暂无数据"}
              </CardDescription>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <LegendDot className="bg-primary" label="Token" />
              <LegendDot className="bg-amber-500" label="Cost" />
            </div>
          </CardHeader>
          <CardContent>
            {dailySeries.length === 0 ? (
              <p className="text-sm text-muted-foreground">暂无成本数据。</p>
            ) : (
              <div className="h-48 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={dailySeries}
                    margin={{ top: 10, right: 16, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="hsl(var(--border))"
                    />
                    <XAxis
                      dataKey="label"
                      tick={{
                        fontSize: 12,
                        fill: "hsl(var(--muted-foreground))",
                      }}
                      stroke="hsl(var(--border))"
                    />
                    <YAxis
                      yAxisId="left"
                      width={50}
                      tick={{
                        fontSize: 12,
                        fill: "hsl(var(--muted-foreground))",
                      }}
                      stroke="hsl(var(--border))"
                    />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      width={50}
                      tick={{
                        fontSize: 12,
                        fill: "hsl(var(--muted-foreground))",
                      }}
                      stroke="hsl(var(--border))"
                    />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      labelStyle={{ color: "hsl(var(--muted-foreground))" }}
                      cursor={{ fill: "hsl(var(--muted) / 0.3)" }}
                    />
                    <Bar
                      yAxisId="left"
                      dataKey="tokens"
                      name="Token"
                      fill="hsl(220 40% 30%)"
                      radius={[6, 6, 0, 0]}
                      maxBarSize={24}
                    />
                    <Bar
                      yAxisId="right"
                      dataKey="cost"
                      name="Cost"
                      fill="hsl(38 90% 50%)"
                      radius={[6, 6, 0, 0]}
                      maxBarSize={24}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div
        className={
          snap.by_provider.length > 0
            ? "grid gap-4 lg:grid-cols-2"
            : "grid gap-4"
        }
      >
        <DimensionList
          icon={<Cpu className="h-4 w-4" />}
          title="按模型用量"
          description="请求 · Token · 成本"
          rows={snap.by_model.slice(0, 15)}
          totalRequests={snap.total_requests}
          totalCost={snap.total_cost}
          showErrors={false}
        />
        {snap.by_provider.length > 0 && (
          <DimensionList
            icon={<ListOrdered className="h-4 w-4" />}
            title="按 Provider"
            description="不同服务商的用量分布"
            rows={snap.by_provider.slice(0, 15)}
            totalRequests={snap.total_requests}
            totalCost={snap.total_cost}
          />
        )}
      </div>

      {!snap.gateway_id && snap.by_gateway.length > 1 && (
        <DimensionList
          icon={<Activity className="h-4 w-4" />}
          title="按 Gateway"
          description="账号下所有 AI Gateway 的用量分布"
          rows={snap.by_gateway.slice(0, 15)}
          totalRequests={snap.total_requests}
          totalCost={snap.total_cost}
        />
      )}
    </div>
  );
}

const tooltipStyle = {
  background: "hsl(var(--popover))",
  border: "1px solid hsl(var(--border))",
  borderRadius: 8,
  fontSize: 12,
  color: "hsl(var(--popover-foreground))",
} as const;

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

function DimensionList({
  icon,
  title,
  description,
  rows,
  totalRequests,
  totalCost,
  showErrors = true,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  rows: CFAIDimensionEntry[];
  totalRequests: number;
  totalCost: number;
  showErrors?: boolean;
}) {
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
          <p className="text-sm text-muted-foreground">暂无数据</p>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {rows.map((r, i) => {
              const reqPct =
                totalRequests > 0
                  ? Math.max(2, Math.round((r.requests / totalRequests) * 100))
                  : 2;
              const costPct =
                totalCost > 0
                  ? Math.max(2, Math.round((r.cost / totalCost) * 100))
                  : 0;
              return (
                <li
                  key={`${r.name}-${i}`}
                  className="flex flex-col gap-1.5 rounded-md border border-border/50 p-2"
                >
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="truncate font-mono text-xs text-foreground/80">
                      {r.name}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {r.requests.toLocaleString()} req ·{" "}
                      {r.total_tokens > 0
                        ? `${formatNumber(r.total_tokens)} tok · `
                        : ""}
                      {formatCost(r.cost)}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <div className="mb-0.5 flex items-center justify-between text-[10px] text-muted-foreground">
                        <span>请求占比</span>
                        <span>{reqPct}%</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-muted/70">
                        <div
                          className="h-full rounded-full bg-primary/80"
                          style={{ width: `${reqPct}%` }}
                        />
                      </div>
                    </div>
                    <div>
                      <div className="mb-0.5 flex items-center justify-between text-[10px] text-muted-foreground">
                        <span>成本占比</span>
                        <span>{costPct}%</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-muted/70">
                        <div
                          className="h-full rounded-full bg-amber-500/80"
                          style={{ width: `${costPct}%` }}
                        />
                      </div>
                    </div>
                  </div>
                  {(r.cached_requests > 0 ||
                    (showErrors && r.errored_requests > 0)) && (
                    <div className="flex flex-wrap gap-1.5 text-[10px] text-muted-foreground">
                      {r.cached_requests > 0 && (
                        <Badge variant="secondary" className="font-normal">
                          缓存 {r.cached_requests.toLocaleString()}
                        </Badge>
                      )}
                      {showErrors && r.errored_requests > 0 && (
                        <Badge variant="destructive" className="font-normal">
                          错误 {r.errored_requests.toLocaleString()}
                        </Badge>
                      )}
                    </div>
                  )}
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

function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return "0";
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(2)}K`;
  return n.toLocaleString();
}

function formatCost(n: number): string {
  if (!Number.isFinite(n) || n === 0) return "$0";
  if (n < 0.01) return `$${n.toFixed(5)}`;
  if (n < 1) return `$${n.toFixed(4)}`;
  return `$${n.toFixed(2)}`;
}

function round(n: number, digits: number): number {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}

function formatDateLabel(ts: string): string {
  if (!ts) return "";
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return ts;
  const hour = d.getHours();
  const minute = d.getMinutes();
  // If the timestamp carries an hour component (i.e. it's not a pure date),
  // include it so multiple buckets in the same day stay distinguishable.
  if (hour !== 0 || minute !== 0 || /T\d{2}:/.test(ts)) {
    return `${d.getMonth() + 1}/${d.getDate()} ${String(hour).padStart(2, "0")}:00`;
  }
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

// dayKey returns yyyy-mm-dd in UTC for any ISO-ish timestamp. We use UTC to
// stay consistent with Cloudflare's `date` dimension which is also UTC.
function dayKey(ts: string): string {
  if (!ts) return "";
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return ts.slice(0, 10);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

// fillDailyWindow expands the (possibly sparse) daily_series returned by
// Cloudflare into a dense array of `windowDays` consecutive days ending
// today. Days without traffic are emitted as zero-valued points so the
// charts always span the full requested window.
function fillDailyWindow(
  series: CFAITimePoint[],
  windowDays: number,
): CFAITimePoint[] {
  const days = Math.max(1, windowDays || 30);
  const indexed = new Map<string, CFAITimePoint>();
  for (const p of series) {
    indexed.set(dayKey(p.ts), p);
  }
  const today = new Date();
  // Anchor at UTC midnight to avoid local-tz off-by-one when comparing keys.
  const anchor = Date.UTC(
    today.getUTCFullYear(),
    today.getUTCMonth(),
    today.getUTCDate(),
  );
  const result: CFAITimePoint[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const t = new Date(anchor - i * 86_400_000);
    const key = `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, "0")}-${String(t.getUTCDate()).padStart(2, "0")}`;
    const hit = indexed.get(key);
    if (hit) {
      result.push(hit);
    } else {
      result.push({
        ts: `${key}T00:00:00Z`,
        requests: 0,
        tokens: 0,
        cost: 0,
        cached: 0,
        errors: 0,
      });
    }
  }
  return result;
}
