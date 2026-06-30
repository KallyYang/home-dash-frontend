"use client";

import useSWR from "swr";
import {
  Boxes,
  Crown,
  Server,
  Cpu,
  MemoryStick,
  HardDrive,
  Layers,
  Activity,
  CircleDot,
  CircleOff,
  AlertCircle,
} from "lucide-react";
import { fetcher } from "@/lib/api";
import type {
  K8SSnapshot,
  K8SNodeSummary,
  K8SDeploymentSummary,
} from "@/lib/types";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { StaggerContainer } from "@/components/stagger-container";
import { PageHeader } from "@/components/page-header";

interface Wrapped<T> { data: T | null; updated_at?: string; error?: string; }

export default function K8SPage() {
  const { data, isLoading } = useSWR<Wrapped<K8SSnapshot>>("/api/k8s", fetcher, {
    refreshInterval: 15_000,
  });

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Kubernetes" description="Loading cluster…" />
        <StaggerContainer className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
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
          K8S collector is not configured or unreachable. {data?.error}
        </AlertDescription>
      </Alert>
    );
  }

  const snap = data.data;

  const sortedNodes = [...snap.nodes].sort((a, b) => a.name.localeCompare(b.name));
  const controlNodes = sortedNodes.filter((n) => n.role === "control-plane");
  const workerNodes = sortedNodes.filter((n) => n.role !== "control-plane");

  const pods = snap.pods;
  const deployments = snap.deployments;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Kubernetes"
        description={`Cluster version ${snap.version} · ${snap.node_count} nodes · ${snap.pod_count} pods`}
      />

      <StaggerContainer className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <SummaryCard
          icon={Server}
          label="Nodes"
          primary={`${controlNodes.length} / ${workerNodes.length}`}
          secondary="control-plane / worker"
        />
        <SummaryCard
          icon={Activity}
          label="Pods"
          primary={`${pods.running} / ${pods.total}`}
          secondary={`running / total${pods.pending ? ` · ${pods.pending} pending` : ""}${pods.failed ? ` · ${pods.failed} failed` : ""}`}
        />
        <SummaryCard
          icon={Layers}
          label="Deployments"
          primary={`${deployments.ready} / ${deployments.total}`}
          secondary="ready / total"
        />
        <SummaryCard
          icon={Cpu}
          label="Capacity"
          primary={`${sumCPU(snap.nodes)} CPU`}
          secondary={`${formatBytesFromCount(sumMem(snap.nodes))} memory`}
        />
      </StaggerContainer>

      <NodeSection
        title="Control plane"
        icon={Crown}
        nodes={controlNodes}
        variant="warning"
      />

      <NodeSection
        title="Workers"
        icon={Server}
        nodes={workerNodes}
        variant="secondary"
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,20rem)]">
        <div className="min-w-0">
          <DeploymentsSection deployments={deployments.items} />
        </div>
        <div className="min-w-0">
          <PodsSection stats={pods} />
        </div>
      </div>
    </div>
  );
}

function SectionHeader({
  icon: Icon,
  title,
  count,
  countLabel,
  variant = "secondary",
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  count: number;
  countLabel: string;
  variant?: "warning" | "secondary";
}) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <Badge variant={variant} className="gap-1.5">
        <Icon className="size-3.5" />
        {title}
      </Badge>
      <span className="text-xs text-muted-foreground">
        {count} {countLabel}
      </span>
    </div>
  );
}

function NodeSection({
  title,
  icon,
  nodes,
  variant,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  nodes: K8SNodeSummary[];
  variant: "warning" | "secondary";
}) {
  if (nodes.length === 0) return null;
  return (
    <section>
      <SectionHeader
        icon={icon}
        title={title}
        count={nodes.length}
        countLabel={`node${nodes.length === 1 ? "" : "s"}`}
        variant={variant}
      />
      <StaggerContainer className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {nodes.map((n) => (
          <NodeCard key={n.name} node={n} />
        ))}
      </StaggerContainer>
    </section>
  );
}

function NodeCard({ node }: { node: K8SNodeSummary }) {
  const isControl = node.role === "control-plane";
  const Icon = isControl ? Crown : Boxes;
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0 p-3 pb-2">
        <div className="flex min-w-0 items-center gap-2">
          <div
            className={cn(
              "flex size-7 shrink-0 items-center justify-center rounded-md",
              isControl
                ? "bg-warning/10 text-warning"
                : "bg-muted text-muted-foreground"
            )}
          >
            <Icon className="size-3.5" />
          </div>
          <div className="min-w-0">
            <CardTitle className="truncate text-sm">{node.name}</CardTitle>
            {node.internal_ip && (
              <CardDescription className="text-[11px] leading-tight">
                {node.internal_ip}
              </CardDescription>
            )}
          </div>
        </div>
        {node.ready ? (
          <CircleDot
            className="size-4 shrink-0 text-success"
            strokeWidth={2.25}
            aria-label="Ready"
          />
        ) : (
          <CircleOff
            className="size-4 shrink-0 text-destructive"
            strokeWidth={2.25}
            aria-label="NotReady"
          />
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-2 p-3 pt-0 text-sm">
        <div className="grid grid-cols-3 gap-1.5">
          <ResourceTile
            icon={Cpu}
            label="CPU"
            primary={`${node.cpu_capacity}`}
            secondary={`alloc ${node.cpu_allocatable}`}
          />
          <ResourceTile
            icon={MemoryStick}
            label="MEM"
            primary={formatBytesFromCount(node.memory_capacity_bytes)}
            secondary={`alloc ${node.memory_allocatable}`}
          />
          <ResourceTile
            icon={HardDrive}
            label="DISK"
            primary={formatBytesFromCount(node.disk_capacity_bytes)}
            secondary={`${node.pod_count}/${node.pods_capacity} pods`}
          />
        </div>
        <Separator />
        <div className="flex flex-col gap-1">
          <InfoRow label="Role" value={node.role} />
          <InfoRow label="Kubelet" value={node.kubelet_version} />
          <InfoRow label="Runtime" value={node.container_runtime || "—"} />
          <InfoRow label="OS" value={node.os_image} />
          <InfoRow
            label="Kernel"
            value={`${node.kernel_version || "—"}${
              node.architecture ? ` · ${node.architecture}` : ""
            }`}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function DeploymentsSection({ deployments }: { deployments: K8SDeploymentSummary[] }) {
  if (!deployments || deployments.length === 0) return null;
  const sorted = [...deployments].sort((a, b) => {
    if (a.namespace !== b.namespace) return a.namespace.localeCompare(b.namespace);
    return a.name.localeCompare(b.name);
  });
  return (
    <section>
      <SectionHeader
        icon={Layers}
        title="Deployments"
        count={sorted.length}
        countLabel="total"
      />
      <Card>
        <CardContent className="p-0">
          <ul className="divide-y">
            {sorted.map((d) => {
              const healthy = d.desired > 0 ? d.ready >= d.desired : d.ready === 0;
              const pct = d.desired > 0 ? (d.ready / d.desired) * 100 : d.ready === 0 ? 100 : 0;
              const clamped = Math.max(0, Math.min(100, pct));
              const indicatorClass = healthy
                ? "bg-success"
                : clamped >= 50
                ? "bg-warning"
                : "bg-destructive";
              return (
                <li
                  key={`${d.namespace}/${d.name}`}
                  className="flex min-w-0 items-center gap-3 px-4 py-2.5 text-sm"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    {healthy ? (
                      <CircleDot className="size-3.5 shrink-0 text-success" />
                    ) : (
                      <CircleOff className="size-3.5 shrink-0 text-destructive" />
                    )}
                    <Badge variant="secondary" className="shrink-0 font-normal">
                      {d.namespace}
                    </Badge>
                    <span className="min-w-0 flex-1 truncate font-medium" title={d.name}>
                      {d.name}
                    </span>
                  </div>
                  <Progress
                    value={clamped}
                    indicatorClassName={indicatorClass}
                    className="hidden w-24 shrink-0 sm:block sm:w-32 lg:w-40"
                  />
                  <div className="w-14 shrink-0 text-right text-xs tabular-nums text-muted-foreground sm:w-16">
                    {d.ready}/{d.desired}
                  </div>
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>
    </section>
  );
}

function PodsSection({ stats }: { stats: K8SSnapshot["pods"] }) {
  return (
    <section>
      <SectionHeader
        icon={Activity}
        title="Pods"
        count={stats.total}
        countLabel="total"
      />
      <StaggerContainer className="grid grid-cols-2 gap-3">
        <PodStatTile label="Running" value={stats.running} tone="success" />
        <PodStatTile label="Pending" value={stats.pending} tone="warning" />
        <PodStatTile label="Succeeded" value={stats.succeeded} tone="secondary" />
        <PodStatTile label="Failed" value={stats.failed} tone="destructive" />
        <PodStatTile label="Unknown" value={stats.unknown} tone="secondary" />
      </StaggerContainer>
    </section>
  );
}

function PodStatTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "success" | "warning" | "destructive" | "secondary";
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-1 p-4">
        <Badge variant={tone} className="self-start">
          {label}
        </Badge>
        <div className="text-2xl font-semibold tracking-tight">{value}</div>
      </CardContent>
    </Card>
  );
}

function ResourceTile({
  icon: Icon,
  label,
  primary,
  secondary,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  primary: string;
  secondary: string;
}) {
  return (
    <div className="rounded-md border bg-muted/40 p-2">
      <div className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        <Icon className="size-3" />
        {label}
      </div>
      <div className="mt-0.5 truncate text-[13px] font-semibold leading-tight" title={primary}>
        {primary}
      </div>
      <div className="truncate text-[11px] text-muted-foreground" title={secondary}>
        {secondary}
      </div>
    </div>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  primary,
  secondary,
}: {
  icon: React.ComponentType<{ className?: string }>;
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
        <Icon className="size-4 text-muted-foreground" />
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

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="truncate" title={value}>
        {value}
      </span>
    </div>
  );
}

function sumCPU(nodes: K8SNodeSummary[]): number {
  const milli = nodes.reduce((acc, n) => acc + (n.cpu_capacity_milli || 0), 0);
  return Math.round(milli / 1000);
}

function sumMem(nodes: K8SNodeSummary[]): number {
  return nodes.reduce((acc, n) => acc + (n.memory_capacity_bytes || 0), 0);
}

function formatBytesFromCount(bytes: number): string {
  if (!bytes || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB", "PB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${units[i]}`;
}
