let cachedBase: string | null = null;
let inflight: Promise<string> | null = null;

const FALLBACK_BASE =
  process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8080";

export async function getApiBase(): Promise<string> {
  if (cachedBase) return cachedBase;
  if (inflight) return inflight;

  inflight = (async () => {
    try {
      const res = await fetch("/api/config", { cache: "no-store" });
      if (!res.ok) throw new Error(`config ${res.status}`);
      const data = (await res.json()) as { apiBase?: string };
      cachedBase = data.apiBase || FALLBACK_BASE;
    } catch {
      cachedBase = FALLBACK_BASE;
    } finally {
      inflight = null;
    }
    return cachedBase!;
  })();

  return inflight;
}

export function resetApiBaseCache() {
  cachedBase = null;
  inflight = null;
}

export async function apiFetch<T>(path: string): Promise<T> {
  const base = await getApiBase();
  const res = await fetch(`${base}${path}`, {
    headers: {
      "Content-Type": "application/json",
      // If backend AUTH_TOKEN is enabled, uncomment and wire via env:
      // Authorization: `Bearer ${process.env.NEXT_PUBLIC_API_TOKEN}`,
    },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`API ${path} failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export const fetcher = <T>(path: string): Promise<T> => apiFetch<T>(path);
