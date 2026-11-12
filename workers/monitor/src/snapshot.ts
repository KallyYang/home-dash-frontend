import { isRecord, parseWhitelist } from "./config";

export interface MonitorNode {
  source: "tailscale" | "cloudflared";
  name: string;
  status: "online" | "offline" | "unknown";
  freshness: "fresh" | "stale" | "pending" | "error";
  failCount: number;
  notified: boolean;
  lastChecked: string | null;
  lastChange: string | null;
}

export interface MonitorSnapshot {
  nodes: MonitorNode[];
  fetchedAt: string;
}

export async function readMonitorSnapshot(env: CloudflareEnv, now = Date.now()): Promise<MonitorSnapshot> {
  const targets = [
    ...parseWhitelist(env.MONITOR_TAILSCALE_NODES).map((name) => ({ source: "tailscale" as const, name })),
    ...parseWhitelist(env.MONITOR_CLOUDFLARED_TUNNELS).map((name) => ({ source: "cloudflared" as const, name })),
  ];
  const nodes = await Promise.all(targets.map(async (target): Promise<MonitorNode> => {
    const empty: MonitorNode = { ...target, status: "unknown", freshness: "pending", failCount: 0, notified: false, lastChecked: null, lastChange: null };
    try {
      const value = await env.MONITOR_STATE.get<unknown>(`${target.source}:${target.name}`, "json");
      if (value === null) return empty;
      if (!isRecord(value) || (value.status !== "online" && value.status !== "offline") ||
        typeof value.lastChecked !== "string" || !Number.isFinite(Date.parse(value.lastChecked)) ||
        typeof value.failCount !== "number" || !Number.isSafeInteger(value.failCount) || value.failCount < 0 ||
        typeof value.notified !== "boolean" ||
        (value.lastChange !== undefined && (typeof value.lastChange !== "string" || !Number.isFinite(Date.parse(value.lastChange))))) {
        throw new Error("Invalid monitor state");
      }
      const age = now - Date.parse(value.lastChecked);
      return { ...target, status: value.status, freshness: age > 15 * 60 * 1000 || age < -60 * 1000 ? "stale" : "fresh", failCount: value.failCount, notified: value.notified, lastChecked: value.lastChecked, lastChange: typeof value.lastChange === "string" ? value.lastChange : value.lastChecked };
    } catch {
      console.error(JSON.stringify({ event: "monitor_read_failed", source: target.source, name: target.name }));
      return { ...empty, freshness: "error" };
    }
  }));
  return { nodes, fetchedAt: new Date(now).toISOString() };
}
