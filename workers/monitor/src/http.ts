import { isRecord } from "./config";

export async function fetchJson(url: string, token?: string): Promise<Record<string, unknown>> {
  const response = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    signal: AbortSignal.timeout(10000),
    redirect: "error",
  });
  if (!response.ok) {
    await response.body?.cancel();
    console.error(JSON.stringify({ event: "upstream_http_error", status: response.status, host: new URL(url).hostname }));
    throw new Error("Upstream HTTP error");
  }
  if (!response.body) throw new Error("Empty response");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 4 * 1024 * 1024) throw new Error("Response too large");
      chunks.push(value);
    }
  } finally {
    await reader.cancel();
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  const payload: unknown = JSON.parse(new TextDecoder().decode(bytes));
  if (!isRecord(payload)) throw new Error("Invalid response");
  return payload;
}
