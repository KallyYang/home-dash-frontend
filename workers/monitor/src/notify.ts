import { fetchJson } from "./http";

export async function sendBark(env: CloudflareEnv, title: string, body: string): Promise<boolean> {
  try {
    if (!env.BARK_KEY) throw new Error("Missing Bark secret");
    const server = new URL(env.BARK_SERVER || "https://api.day.app");
    if (server.protocol !== "https:" || server.username || server.password || server.search || server.hash) {
      throw new Error("Invalid Bark server");
    }
    const url = `${server.toString().replace(/\/+$/, "")}/${encodeURIComponent(env.BARK_KEY)}/${encodeURIComponent(title)}/${encodeURIComponent(body)}?group=home-dash`;
    const response = await fetchJson(url);
    if (response.code !== 200) throw new Error("Bark rejected notification");
    return true;
  } catch {
    console.error(JSON.stringify({ event: "bark_failed", reason: "notification_not_delivered", retry: false }));
    return false;
  }
}
