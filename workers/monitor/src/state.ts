import { isRecord, type CheckResult } from "./config";
import { sendBark } from "./notify";

export interface NodeState {
  status: "online" | "offline";
  failCount: number;
  notified: boolean;
  lastChecked: string;
  lastChange: string;
}

function parseState(value: unknown): NodeState | null {
  if (value === null) return null;
  if (!isRecord(value) || (value.status !== "online" && value.status !== "offline") ||
    typeof value.failCount !== "number" || !Number.isSafeInteger(value.failCount) || value.failCount < 0 ||
    typeof value.notified !== "boolean" || typeof value.lastChecked !== "string" ||
    !Number.isFinite(Date.parse(value.lastChecked)) ||
    (value.lastChange !== undefined && (typeof value.lastChange !== "string" || !Number.isFinite(Date.parse(value.lastChange))))) {
    throw new Error("Invalid stored state");
  }
  return {
    status: value.status,
    failCount: value.failCount,
    notified: value.notified,
    lastChecked: value.lastChecked,
    lastChange: typeof value.lastChange === "string" ? value.lastChange : value.lastChecked,
  };
}

export async function updateNodeState(env: CloudflareEnv, result: CheckResult, failThreshold: number, now: number): Promise<void> {
  const key = `${result.source}:${result.name}`;
  try {
    const previous = parseState(await env.MONITOR_STATE.get<unknown>(key, "json"));
    const checked = new Date(now).toISOString();
    const failCount = result.status === "offline" ? Math.min((previous?.failCount ?? 0) + 1, failThreshold) : 0;
    const notifyOffline = result.status === "offline" && failCount >= failThreshold && !previous?.notified;
    const notifyRecovery = result.status === "online" && previous?.notified === true;
    const state: NodeState = {
      status: result.status,
      failCount,
      notified: result.status === "offline" && (previous?.notified === true || notifyOffline),
      lastChecked: checked,
      lastChange: previous?.status === result.status ? previous.lastChange : checked,
    };
    await env.MONITOR_STATE.put(key, JSON.stringify(state));
    let delivered: boolean | null = null;
    if (notifyOffline || notifyRecovery) {
      const title = `[${notifyOffline ? "离线" : "恢复"}] ${result.source}: ${result.name}`;
      const body = `${result.reason}\n${notifyOffline ? `连续 ${failCount} 次检查离线` : "节点已恢复在线"}\n检查时间: ${checked}`;
      delivered = await sendBark(env, title, body);
    }
    console.log(JSON.stringify({ event: "node_checked", key, ...state, notification: notifyOffline ? "offline" : notifyRecovery ? "recovery" : null, delivered }));
  } catch {
    console.error(JSON.stringify({ event: "node_state_failed", key, reason: "kv_or_state_failure" }));
  }
}
