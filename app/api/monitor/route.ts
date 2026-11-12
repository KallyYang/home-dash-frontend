import { getCloudflareContext } from "@opennextjs/cloudflare";
import { readMonitorSnapshot } from "@/workers/monitor/src/snapshot";

export const dynamic = "force-dynamic";

export async function GET() {
  const headers = { "Cache-Control": "private, no-store", "Vary": "Cookie, Cf-Access-Jwt-Assertion" };
  try {
    const { env } = await getCloudflareContext({ async: true });
    if (!env.MONITOR_STATE) return Response.json({ error: "监控 KV 未绑定" }, { status: 503, headers });
    return Response.json(await readMonitorSnapshot(env), { headers });
  } catch {
    console.error(JSON.stringify({ event: "monitor_snapshot_unavailable" }));
    return Response.json({ error: "节点状态暂不可用，请检查 Worker 配置与 KV 绑定" }, { status: 503, headers });
  }
}
