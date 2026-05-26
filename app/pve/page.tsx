"use client";

import useSWR from "swr";
import {
  AlertCircle,
  Boxes,
  CircleDot,
  CircleOff,
  Container,
  Cpu,
  HardDrive,
  MemoryStick,
  Server,
} from "lucide-react";
import { fetcher } from "@/lib/api";
import type { PVESnapshot, PVEGuest } from "@/lib/types";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { formatBytes, formatUptime, cn } from "@/lib/utils";
import { StaggerContainer } from "@/components/stagger-container";
import { PageHeader } from "@/components/page-header";

interface Wrapped<T> { data: T | null; updated_at?: string; error?: string; }

export default function PVEPage() {
  const { data, isLoading } = useSWR<Wrapped<PVESnapshot>>("/api/pve", fetcher, {
    refreshInterval: 15_000,
  });

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Proxmox VE" description="Loading nodes…" />
        <StaggerContainer className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </StaggerContainer>
        <StaggerContainer className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </StaggerContainer>
      </div>
    );
  }

  if (!data?.data) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="size-4" />
        <AlertTitle>Collector unavailable</AlertTitle>
        <AlertDescription>
          PVE collector is not configured or unreachable. {data?.error}
        </AlertDescription>
      </Alert>
    );
  }

  const { nodes, totals } = data.data;
  const cpuPct = totals.cpu_usage * 100;
  const memPct = totals.maxmem ? (totals.mem / totals.maxmem) * 100 : 0;
  const diskPct = totals.maxdisk ? (totals.disk / totals.maxdisk) * 100 : 0;

  const allVms: Array<PVEGuest & { node: string }> = [];
  const allCts: Array<PVEGuest & { node: string }> = [];
  for (const n of nodes) {
    for (const g of n.vms ?? []) allVms.push({ ...g, node: n.node });
    for (const g of n.cts ?? []) allCts.push({ ...g, node: n.node });
  }
  allVms.sort((a, b) => a.node.localeCompare(b.node) || a.vmid - b.vmid);
  allCts.sort((a, b) => a.node.localeCompare(b.node) || a.vmid - b.vmid);
  const offlineNodeSet = new Set(
    nodes.filter((n) => n.status !== "online").map((n) => n.node),
  );
  const vmRunningTotal = allVms.filter(
    (g) => g.status === "running" && !offlineNodeSet.has(g.node),
  ).length;
  const ctRunningTotal = allCts.filter(
    (g) => g.status === "running" && !offlineNodeSet.has(g.node),
  ).length;
  const hasVmSection = allVms.length > 0;
  const hasCtSection = allCts.length > 0;
  // 计算分区内 #vmid / 节点名的最大字符宽度，用于让各卡片中 VM 名称的起点对齐。
  // 使用 ch 单位，让不同长度的 vmid/node 占用相同的视觉宽度。
  const maxChars = (arr: Array<{ vmid: number; node: string }>, pick: "id" | "node") =>
    arr.reduce(
      (m, g) =>
        Math.max(m, pick === "id" ? `#${g.vmid}`.length : g.node.length),
      0,
    );
  const vmVmidWidth = maxChars(allVms, "id");
  const vmNodeWidth = maxChars(allVms, "node");
  const ctVmidWidth = maxChars(allCts, "id");
  const ctNodeWidth = maxChars(allCts, "node");

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Proxmox VE"
        description={`${totals.online_nodes}/${totals.node_count} node${totals.node_count === 1 ? "" : "s"} online`}
      />

      <StaggerContainer className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <SummaryCard
          icon={<Server className="h-4 w-4" />}
          label="Nodes"
          primary={`${totals.online_nodes} / ${totals.node_count}`}
          secondary="online / total"
        />
        <SummaryCard
          icon={<Cpu className="h-4 w-4" />}
          label="CPU"
          primary={`${cpuPct.toFixed(1)}%`}
          secondary={`${totals.maxcpu} cores`}
          pct={cpuPct}
        />
        <SummaryCard
          icon={<MemoryStick className="h-4 w-4" />}
          label="Memory"
          primary={`${memPct.toFixed(1)}%`}
          secondary={`${formatBytes(totals.mem)} / ${formatBytes(totals.maxmem)}`}
          pct={memPct}
        />
        <SummaryCard
          icon={<HardDrive className="h-4 w-4" />}
          label="Disk"
          primary={`${diskPct.toFixed(1)}%`}
          secondary={`${formatBytes(totals.disk)} / ${formatBytes(totals.maxdisk)}`}
          pct={diskPct}
        />
      </StaggerContainer>

      <section>
        <div className="mb-3 flex items-center gap-2">
          <Badge variant="secondary" className="gap-1.5">
            <Server className="size-3.5" />
            Nodes
          </Badge>
          <span className="text-xs text-muted-foreground">{nodes.length} total</span>
        </div>
        <StaggerContainer className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {[...nodes].sort((a, b) => a.node.localeCompare(b.node)).map((n) => {
            const nCpu = n.cpu * 100;
            const nMem = n.maxmem ? (n.mem / n.maxmem) * 100 : 0;
            const nDisk = n.maxdisk ? (n.disk / n.maxdisk) * 100 : 0;
            const online = n.status === "online";
            return (
              <Card key={n.node} className="h-full">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 gap-2 p-4 pb-2">
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <Server className="size-3.5 shrink-0 text-muted-foreground" />
                    <CardTitle
                      className="truncate text-sm font-semibold"
                      title={n.node}
                    >
                      {n.node}
                    </CardTitle>
                    {online && n.uptime ? (
                      <span className="shrink-0 text-[11px] text-muted-foreground">
                        {formatUptime(n.uptime)}
                      </span>
                    ) : null}
                  </div>
                  {online ? (
                    <CircleDot
                      className="size-4 shrink-0 text-success"
                      strokeWidth={2.25}
                      aria-label={n.status}
                    />
                  ) : (
                    <CircleOff
                      className="size-4 shrink-0 text-destructive"
                      strokeWidth={2.25}
                      aria-label={n.status}
                    />
                  )}
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <div className="grid grid-cols-3 gap-2">
                    <MiniMetric
                      label="CPU"
                      value={`${nCpu.toFixed(1)}%`}
                      pct={nCpu}
                      muted={!online}
                      hideBar={!online}
                    />
                    <MiniMetric
                      label="MEM"
                      value={`${formatBytes(n.mem)} / ${formatBytes(n.maxmem)}`}
                      pct={nMem}
                      muted={!online}
                      hideBar={!online}
                    />
                    <MiniMetric
                      label="DISK"
                      value={`${formatBytes(n.disk)} / ${formatBytes(n.maxdisk)}`}
                      pct={nDisk}
                      muted={!online}
                      hideBar={!online}
                    />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </StaggerContainer>
      </section>

      {hasVmSection && (
        <section>
          <div className="mb-3 flex items-center gap-2">
            <Badge variant="secondary" className="gap-1.5">
              <Boxes className="size-3.5" />
              VM
            </Badge>
            <span className="text-xs text-muted-foreground">
              {vmRunningTotal} / {allVms.length} running
            </span>
          </div>
          <StaggerContainer className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {allVms.map((g) => (
              <GuestCard
                key={`vm-${g.node}-${g.vmid}`}
                guest={g}
                node={g.node}
                nodeOffline={offlineNodeSet.has(g.node)}
                vmidWidth={vmVmidWidth}
                nodeWidth={vmNodeWidth}
              />
            ))}
          </StaggerContainer>
        </section>
      )}

      {hasCtSection && (
        <section>
          <div className="mb-3 flex items-center gap-2">
            <Badge variant="secondary" className="gap-1.5">
              <Container className="size-3.5" />
              CT
            </Badge>
            <span className="text-xs text-muted-foreground">
              {ctRunningTotal} / {allCts.length} running
            </span>
          </div>
          <StaggerContainer className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {allCts.map((g) => (
              <GuestCard
                key={`ct-${g.node}-${g.vmid}`}
                guest={g}
                node={g.node}
                nodeOffline={offlineNodeSet.has(g.node)}
                vmidWidth={ctVmidWidth}
                nodeWidth={ctNodeWidth}
              />
            ))}
          </StaggerContainer>
        </section>
      )}
    </div>
  );
}

function GuestCard({
  guest,
  node,
  nodeOffline,
  vmidWidth,
  nodeWidth,
}: {
  guest: PVEGuest;
  node: string;
  nodeOffline?: boolean;
  vmidWidth?: number;
  nodeWidth?: number;
}) {
  const running = guest.status === "running" && !nodeOffline;
  const cpuPct = running ? guest.cpu * 100 : 0;
  const memPct = running && guest.maxmem ? (guest.mem / guest.maxmem) * 100 : 0;
  const diskPct = guest.maxdisk ? (guest.disk / guest.maxdisk) * 100 : 0;
  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 gap-2 p-3 pb-1.5">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span
            className="shrink-0 text-right font-mono text-[11px] tabular-nums text-muted-foreground"
            style={
              vmidWidth ? { minWidth: `${vmidWidth}ch` } : undefined
            }
          >
            #{guest.vmid}
          </span>
          <span
            className="flex shrink-0 items-center gap-1 text-[11px] text-muted-foreground"
            style={
              nodeWidth
                ? { minWidth: `calc(${nodeWidth}ch + 1rem)` }
                : undefined
            }
            title={node}
          >
            <Server className="size-3 shrink-0" />
            <span className="truncate">{node}</span>
          </span>
          <CardTitle
            className="truncate text-sm font-semibold"
            title={guest.name}
          >
            {guest.name}
          </CardTitle>
          {nodeOffline ? (
            <span className="shrink-0 text-[11px] text-muted-foreground/70">
              · node offline
            </span>
          ) : null}
        </div>
        {running ? (
          <CircleDot
            className="size-4 shrink-0 text-success"
            strokeWidth={2.25}
            aria-label={guest.status}
          />
        ) : (
          <CircleOff
            className={cn(
              "size-4 shrink-0",
              nodeOffline ? "text-destructive" : "text-muted-foreground",
            )}
            strokeWidth={2.25}
            aria-label={nodeOffline ? "node-offline" : guest.status}
          />
        )}
      </CardHeader>
      <CardContent className="px-3 pb-3">
        <div className="grid grid-cols-3 gap-2">
          <MiniMetric
            label="CPU"
            value={
              running
                ? `${cpuPct.toFixed(1)}%${guest.cpus ? ` · ${guest.cpus}c` : ""}`
                : guest.cpus
                ? `${guest.cpus}c`
                : "—"
            }
            pct={cpuPct}
            muted={!running}
            hideBar={!running}
          />
          <MiniMetric
            label="MEM"
            value={
              guest.maxmem
                ? running
                  ? `${formatBytes(guest.mem)} / ${formatBytes(guest.maxmem)}`
                  : formatBytes(guest.maxmem)
                : "—"
            }
            pct={memPct}
            muted={!running}
            hideBar={!running}
          />
          <MiniMetric
            label="DISK"
            value={
              guest.maxdisk
                ? running
                  ? `${formatBytes(guest.disk)} / ${formatBytes(guest.maxdisk)}`
                  : formatBytes(guest.maxdisk)
                : "—"
            }
            pct={diskPct}
            hideBar={!running}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function MiniMetric({
  label,
  value,
  pct,
  muted,
  hideBar,
}: {
  label: string;
  value: string;
  pct: number;
  muted?: boolean;
  hideBar?: boolean;
}) {
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between gap-1">
        <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
      </div>
      <div className="truncate text-[11px]" title={value}>
        {value}
      </div>
      {hideBar ? null : (
        <Progress
          value={clamped}
          indicatorClassName={muted ? "bg-secondary-foreground/30" : progressTone(clamped)}
          className="h-1"
        />
      )}
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

function progressTone(value: number) {
  if (value >= 85) return "bg-destructive";
  if (value >= 65) return "bg-warning";
  return "bg-primary/80";
}
