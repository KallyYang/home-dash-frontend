"use client";

import { usePathname } from "next/navigation";
import useSWR from "swr";
import { ChevronDown, Cloud, Network, RefreshCw } from "lucide-react";
import { MetricCard } from "@/components/metric-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { MonitorNode, MonitorSnapshot } from "@/workers/monitor/src/snapshot";

type Source = "tailscale" | "cloudflared";

const SOURCES: Array<{
  key: Source;
  title: string;
  icon: typeof Network;
  tone: "slate" | "teal";
}> = [
  { key: "tailscale", title: "Tailscale", icon: Network, tone: "slate" },
  { key: "cloudflared", title: "Cloudflare Tunnel", icon: Cloud, tone: "teal" },
];

async function fetchSnapshot(url: string): Promise<MonitorSnapshot> {
  const response = await fetch(url, { cache: "no-store", credentials: "same-origin", signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error(response.status === 401 || response.status === 403 ? "请先通过 Cloudflare Access 登录" : "节点状态读取失败，请检查监控配置与 KV 绑定");
  if (!response.headers.get("content-type")?.includes("application/json")) throw new Error("请刷新页面完成 Cloudflare Access 登录");
  return response.json();
}

function formatTime(value: string | null) {
  return value ? new Date(value).toLocaleString("zh-CN", { hour12: false }) : "—";
}

function freshnessLabel(node: MonitorNode) {
  if (node.freshness === "error") return "读取失败";
  if (node.freshness === "pending") return "尚未检查";
  if (node.freshness === "stale") return "数据过期";
  return node.status === "online" ? "在线" : "离线";
}

function NodeRow({ node }: { node: MonitorNode }) {
  const variant = node.freshness !== "fresh" ? "secondary" : node.status === "online" ? "success" : "destructive";
  return (
    <li className="rounded-lg border border-border/60 bg-muted/20 p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="min-w-0 break-all text-sm font-medium">{node.name}</span>
        <Badge variant={variant} className="shrink-0">{freshnessLabel(node)}</Badge>
      </div>
      <div className="mt-3 space-y-1 text-xs text-muted-foreground">
        <p>最后检查：{formatTime(node.lastChecked)}</p>
        <p>状态变化：{formatTime(node.lastChange)}</p>
        {node.freshness === "stale" && <p>最后观测：{node.status === "online" ? "在线" : "离线"}，不代表当前状态</p>}
        {node.freshness === "pending" && <p>等待 Cron 首次检查，每 5 分钟运行一次</p>}
        {node.freshness === "fresh" && node.status === "offline" && <p>连续离线 {node.failCount} 次 · {node.notified ? "离线通知已尝试" : "等待防抖确认"}</p>}
      </div>
    </li>
  );
}

export function EdgeNodeStatus() {
  const pathname = usePathname();
  const { data, error, isLoading, isValidating, mutate } = useSWR<MonitorSnapshot>(
    pathname === "/" ? "/api/monitor" : null,
    fetchSnapshot,
    { refreshInterval: 60000, revalidateOnFocus: true, shouldRetryOnError: false },
  );
  if (pathname !== "/") return null;

  const summaryFor = (source: Source) => {
    if (error) return { status: "warn" as const, value: "读取失败", description: error instanceof Error ? error.message : "节点状态读取失败" };
    const nodes = (data?.nodes ?? []).filter((node) => node.source === source);
    if (nodes.length === 0) return { status: "unknown" as const, value: undefined, description: "未配置节点" };
    const online = nodes.filter((node) => node.freshness === "fresh" && node.status === "online").length;
    const status: "online" | "offline" | "warn" = online === nodes.length ? "online" : online === 0 ? "offline" : "warn";
    return {
      status,
      value: `${online}/${nodes.length} 在线`,
      description: `共 ${nodes.length} 个节点 · 每 5 分钟检查`,
    };
  };

  return (
    <>
      {isLoading
        ? SOURCES.map((s) => <Skeleton key={s.key} className="h-[104px] rounded-xl" />)
        : SOURCES.map((s) => {
            const summary = summaryFor(s.key);
            return <MetricCard key={s.key} title={s.title} icon={s.icon} tone={s.tone} value={summary.value} description={summary.description} status={summary.status} />;
          })}

      <details className="group col-span-full rounded-xl border bg-card text-card-foreground shadow-sm">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 text-sm font-medium [&::-webkit-details-marker]:hidden">
          <span className="flex items-center gap-2">
            <ChevronDown className="size-4 transition-transform group-open:rotate-180" />
            边缘节点详情
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={isValidating}
            onClick={(e) => {
              e.preventDefault();
              void mutate();
            }}
          >
            <RefreshCw className={cn(isValidating && "animate-spin")} />刷新状态
          </Button>
        </summary>
        <div className="border-t p-4">
          <p className="mb-4 text-xs text-muted-foreground">每 5 分钟检查 · 页面每分钟读取 KV · 刷新不会触发检查或通知</p>
          {error && <p role="alert" className="mb-4 text-sm text-destructive">{error instanceof Error ? error.message : "节点状态读取失败"}{data ? "；以下为上次读取结果，当前状态无法确认。" : ""}</p>}
          {data ? (
            <div className="grid gap-6 md:grid-cols-2">
              {SOURCES.map((s) => {
                const nodes = data.nodes.filter((node) => node.source === s.key);
                const Icon = s.icon;
                return (
                  <div key={s.key}>
                    <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold"><Icon className="size-4 text-muted-foreground" />{s.title}<Badge variant="outline">{nodes.length}</Badge></h3>
                    {nodes.length ? <ul className="space-y-3">{nodes.map((node) => <NodeRow key={node.name} node={error ? { ...node, freshness: "stale" } : node} />)}</ul> : <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">未配置节点，请在 wrangler.jsonc 中填写白名单</p>}
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>
      </details>
    </>
  );
}
