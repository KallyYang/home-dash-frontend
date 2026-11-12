export type Source = "tailscale" | "cloudflared";

export interface CheckResult {
  source: Source;
  name: string;
  status: "online" | "offline";
  reason: string;
}

export function parseWhitelist(value: string): string[] {
  const parsed: unknown = JSON.parse(value);
  if (!Array.isArray(parsed) || !parsed.every((name) => typeof name === "string" && name.trim().length > 0)) {
    throw new Error("Invalid whitelist");
  }
  const names: string[] = [...new Set<string>(parsed)];
  if (names.some((name) => new TextEncoder().encode(`cloudflared:${name}`).length > 512)) {
    throw new Error("Node name exceeds KV key limit");
  }
  return names;
}

export function positiveNumber(value: string, integer = false): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0 || (integer && !Number.isSafeInteger(parsed))) {
    throw new Error("Invalid threshold");
  }
  return parsed;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
