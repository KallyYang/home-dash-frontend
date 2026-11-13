import { checkCloudflared, checkTailscale } from "./checkers";
import { parseWhitelist, positiveNumber, type Source } from "./config";
import { updateNodeState } from "./state";

export async function runMonitor(env: CloudflareEnv, now = Date.now()): Promise<void> {
  console.log(JSON.stringify({ event: "monitor_started", checkedAt: new Date(now).toISOString() }));
  let failThreshold: number;
  try {
    failThreshold = positiveNumber(env.FAIL_THRESHOLD, true);
  } catch {
    console.error(JSON.stringify({ event: "monitor_skipped", reason: "invalid_fail_threshold" }));
    return;
  }
  await Promise.all((["tailscale", "cloudflared"] as const).map(async (source: Source) => {
    try {
      const names = parseWhitelist(source === "tailscale" ? env.MONITOR_TAILSCALE_NODES : env.MONITOR_CLOUDFLARED_TUNNELS);
      const results = source === "tailscale"
        ? await checkTailscale(env, names, positiveNumber(env.OFFLINE_THRESHOLD_MINUTES), now)
        : await checkCloudflared(env, names);
      if (results === null) return;
      for (const result of results) await updateNodeState(env, result, failThreshold, now);
      console.log(JSON.stringify({ event: "source_checked", source, nodes: results.length, online: results.filter((result) => result.status === "online").length, offline: results.filter((result) => result.status === "offline").length }));
    } catch (error) {
      console.error(JSON.stringify({ event: "source_skipped", source, reason: "invalid_configuration", message: error instanceof Error ? error.message : String(error) }));
    }
  }));
  console.log(JSON.stringify({ event: "monitor_completed", checkedAt: new Date(now).toISOString() }));
}

export default {
  async scheduled(_controller, env) {
    await runMonitor(env);
  },
} satisfies ExportedHandler<CloudflareEnv>;
