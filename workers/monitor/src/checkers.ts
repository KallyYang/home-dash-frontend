import { isRecord, type CheckResult } from "./config";
import { fetchJson } from "./http";

export async function checkTailscale(env: CloudflareEnv, names: string[], thresholdMinutes: number, now: number): Promise<CheckResult[] | null> {
  if (names.length === 0) return [];
  try {
    if (!env.TAILSCALE_API_KEY) throw new Error("Missing Tailscale secret");
    const payload = await fetchJson("https://api.tailscale.com/api/v2/tailnet/-/devices", env.TAILSCALE_API_KEY);
    if (!Array.isArray(payload.devices) || !payload.devices.every((device) => isRecord(device) && typeof device.hostname === "string")) {
      throw new Error("Invalid Tailscale response");
    }
    const devices: Record<string, unknown>[] = payload.devices;
    return names.map((name) => {
      const matches = devices.filter((device) => device.hostname === name);
      if (matches.length > 1) throw new Error("Ambiguous hostname");
      const device = matches[0];
      if (!device) return { source: "tailscale", name, status: "offline", reason: "节点不存在或未加入 tailnet" };
      if (typeof device.lastSeen !== "string" || !Number.isFinite(Date.parse(device.lastSeen))) {
        throw new Error("Invalid lastSeen");
      }
      const offline = now - Date.parse(device.lastSeen) > thresholdMinutes * 60 * 1000;
      return { source: "tailscale", name, status: offline ? "offline" : "online", reason: `lastSeen: ${device.lastSeen}；离线阈值: ${thresholdMinutes} 分钟` };
    });
  } catch (error) {
    console.error(JSON.stringify({ event: "source_skipped", source: "tailscale", reason: "api_or_payload_failure", message: error instanceof Error ? error.message : String(error) }));
    return null;
  }
}

export async function checkCloudflared(env: CloudflareEnv, names: string[]): Promise<CheckResult[] | null> {
  if (names.length === 0) return [];
  try {
    if (!env.CF_API_TOKEN || !env.CF_ACCOUNT_ID) throw new Error("Missing Cloudflare secrets");
    const tunnels: Record<string, unknown>[] = [];
    let totalPages = 1;
    for (let page = 1; page <= totalPages; page++) {
      const url = new URL(`https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(env.CF_ACCOUNT_ID)}/cfd_tunnel`);
      url.search = new URLSearchParams({ is_deleted: "false", per_page: "100", page: String(page) }).toString();
      const payload = await fetchJson(url.toString(), env.CF_API_TOKEN);
      if (payload.success !== true || !Array.isArray(payload.result) || !payload.result.every((tunnel) => isRecord(tunnel) && typeof tunnel.name === "string")) {
        throw new Error("Invalid Cloudflare response");
      }
      tunnels.push(...payload.result);
      if (isRecord(payload.result_info) && payload.result_info.total_pages !== undefined) {
        const pages = payload.result_info.total_pages;
        if (typeof pages !== "number" || !Number.isSafeInteger(pages) || pages < 0 || pages > 100) {
          throw new Error("Invalid pagination");
        }
        totalPages = pages;
      }
    }
    return names.map((name) => {
      const matches = tunnels.filter((tunnel) => tunnel.name === name);
      if (matches.length > 1) throw new Error("Ambiguous tunnel name");
      const tunnel = matches[0];
      if (!tunnel) return { source: "cloudflared", name, status: "offline", reason: "隧道不存在或已删除" };
      if (typeof tunnel.status !== "string" || (tunnel.connections !== undefined && !Array.isArray(tunnel.connections))) {
        throw new Error("Invalid tunnel status");
      }
      const empty = Array.isArray(tunnel.connections) && tunnel.connections.length === 0;
      const offline = tunnel.status !== "healthy" || empty;
      return { source: "cloudflared", name, status: offline ? "offline" : "online", reason: `隧道状态: ${tunnel.status}${empty ? "；connections 为空" : ""}` };
    });
  } catch (error) {
    console.error(JSON.stringify({ event: "source_skipped", source: "cloudflared", reason: "api_or_payload_failure", message: error instanceof Error ? error.message : String(error) }));
    return null;
  }
}
