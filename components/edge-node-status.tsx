"use client";

import { usePathname } from "next/navigation";
import useSWR from "swr";
import { Activity, Cloud, Network, RefreshCw } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { MonitorNode, MonitorSnapshot } from "@/workers/monitor/src/snapshot";

async function fetchSnapshot(url: string): Promise<MonitorSnapshot> {
  const response = await fetch(url, { cache: "no-store", credentials: "same-origin", signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error(response.status === 401 || response.status === 403 ? "请先通过 Cloudflare Access 登录" : "节点状态读取失败，请检查监控配置与 KV 绑定");
  if (!response.headers.get("content-type")?.includes("application/json")) throw new Error("请刷新页面完成 Cloudflare Access 登录");
  return response.json();
}

function formatTime(value: string | null) {
  return value ? new Date(value).toLocaleString("zh-CN", { hour12: false }) : "—";
}

function NodeRow({ node }: { node: MonitorNode }) {
  const label = node.freshness === "error" ? "读取失败" : node.freshness === "pending" ? "尚未检查" : node.freshness === "stale" ? "数据过期" : node.status === "online" ? "在线" : "离线";
  const variant = node.freshness !== "fresh" ? "secondary" : node.status === "online" ? "success" : "destructive";
  return (
    <li className="rounded-lg border border-border/60 bg-muted/20 p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="min-w-0 break-all text-sm font-medium">{node.name}</span>
        <Badge variant={variant} className="shrink-0">{label}</Badge>
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
  const { data, error, isLoading, isValidating, mutate } = useSWR<MonitorSnapshot>(pathname === "/" ? "/api/monitor" : null, fetchSnapshot, { refreshInterval: 60000, revalidateOnFocus: true, shouldRetryOnError: false });
  if (pathname !== "/") return null;
  return (
    <section className="container max-w-screen-2xl pb-2 pt-6 sm:pt-8" aria-label="边缘节点状态">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2"><Activity className="size-5 text-primary" />边缘节点状态</CardTitle>
            <Button variant="outline" size="sm" disabled={isValidating} onClick={() => void mutate()}><RefreshCw className={isValidating ? "animate-spin" : ""} />刷新状态</Button>
          </div>
          <CardDescription>每 5 分钟检查 · 页面每分钟读取 KV · 刷新不会触发检查或通知</CardDescription>
        </CardHeader>
        <CardContent>
          {error && <p role="alert" className="mb-4 text-sm text-destructive">{error instanceof Error ? error.message : "节点状态读取失败"}{data ? "；以下为上次读取结果，当前状态无法确认。" : ""}</p>}
          {isLoading ? <div className="grid gap-4 md:grid-cols-2"><Skeleton className="h-32" /><Skeleton className="h-32" /></div> : data ? (
            <div className="grid gap-6 md:grid-cols-2">
              {(["tailscale", "cloudflared"] as const).map((source) => {
                const nodes = data.nodes.filter((node) => node.source === source);
                const Icon = source === "tailscale" ? Network : Cloud;
                return <div key={source}><h3 className="mb-3 flex items-center gap-2 text-sm font-semibold"><Icon className="size-4 text-muted-foreground" />{source === "tailscale" ? "Tailscale" : "Cloudflare Tunnel"}<Badge variant="outline">{nodes.length}</Badge></h3>{nodes.length ? <ul className="space-y-3">{nodes.map((node) => <NodeRow key={node.name} node={error ? { ...node, freshness: "stale" } : node} />)}</ul> : <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">未配置节点，请在 wrangler.jsonc 中填写白名单</p>}</div>;
              })}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </section>
  );
}
