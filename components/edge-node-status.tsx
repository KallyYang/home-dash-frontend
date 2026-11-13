"use client";

import { usePathname } from "next/navigation";
import useSWR from "swr";
import { Cloud, Network } from "lucide-react";
import { MetricCard } from "@/components/metric-card";
import type { MonitorSnapshot } from "@/workers/monitor/src/snapshot";

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

export function EdgeNodeStatus({ source }: { source: Source }) {
  const pathname = usePathname();
  const { data, error } = useSWR<MonitorSnapshot>(
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
    const hasUnknown = nodes.some((node) => node.freshness !== "fresh" || node.status === "unknown");
    const status: "online" | "offline" | "warn" = hasUnknown ? "warn" : online === nodes.length ? "online" : online === 0 ? "offline" : "warn";
    return {
      status,
      value: `${online}/${nodes.length} 在线`,
      description: nodes.map((node) => node.name).join(" · "),
    };
  };

  const config = SOURCES.find((entry) => entry.key === source)!;
  const summary = summaryFor(source);
  return <MetricCard title={config.title} icon={config.icon} tone={config.tone} value={summary.value} description={summary.description} status={summary.status} />;
}
