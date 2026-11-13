import assert from "node:assert/strict";
import { after, afterEach, test } from "node:test";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
import ts from "typescript";

const directory = mkdtempSync(join(tmpdir(), "home-dash-monitor-test-"));
for (const file of readdirSync(new URL("../src/", import.meta.url))) {
  const source = readFileSync(new URL(`../src/${file}`, import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
  writeFileSync(join(directory, file.replace(/\.ts$/, ".js")), compiled.outputText);
}
const require = createRequire(import.meta.url);
const { checkTailscale, checkCloudflared } = require(join(directory, "checkers.js"));
const { runMonitor, default: worker } = require(join(directory, "index.js"));
const { updateNodeState } = require(join(directory, "state.js"));
const { sendBark } = require(join(directory, "notify.js"));
const { parseWhitelist } = require(join(directory, "config.js"));
const now = Date.parse("2026-11-12T12:00:00Z");
const originalFetch = globalThis.fetch;
const originalLog = console.log;
const originalError = console.error;
let logs = [];
console.log = (...values) => logs.push(values.join(" "));
console.error = (...values) => logs.push(values.join(" "));
afterEach(() => { globalThis.fetch = originalFetch; logs = []; });
after(() => { console.log = originalLog; console.error = originalError; });

function environment() {
  const values = new Map();
  return {
    MONITOR_TAILSCALE_NODES: '["nas"]', MONITOR_CLOUDFLARED_TUNNELS: '["home"]',
    OFFLINE_THRESHOLD_MINUTES: "10", FAIL_THRESHOLD: "2", BARK_SERVER: "https://api.day.app",
    TAILSCALE_API_KEY: "test-only-tailscale", CF_API_TOKEN: "test-only-cloudflare", CF_ACCOUNT_ID: "test-account", BARK_KEY: "test-only-bark",
    MONITOR_STATE: { async get(key) { return values.has(key) ? JSON.parse(values.get(key)) : null; }, async put(key, value) { values.set(key, value); } },
    values,
  };
}
const json = (payload, status = 200) => Response.json(payload, { status });
const node = (status, name = "nas") => ({ source: "tailscale", name, status, reason: "Test observation" });

test("two failures alert once, recovery notifies once, and timestamps persist", async () => {
  const env = environment();
  const titles = [];
  globalThis.fetch = async (url) => { titles.push(decodeURIComponent(new URL(url).pathname.split("/")[2])); return json({ code: 200 }); };
  await updateNodeState(env, node("offline"), 2, now);
  assert.equal(titles.length, 0);
  await updateNodeState(env, node("offline"), 2, now + 300000);
  await updateNodeState(env, node("offline"), 2, now + 600000);
  assert.deepEqual(titles, ["[离线] tailscale: nas"]);
  assert.equal(JSON.parse(env.values.get("tailscale:nas")).lastChange, new Date(now).toISOString());
  await updateNodeState(env, node("online"), 2, now + 900000);
  await updateNodeState(env, node("online"), 2, now + 1200000);
  assert.deepEqual(titles, ["[离线] tailscale: nas", "[恢复] tailscale: nas"]);
  const state = JSON.parse(env.values.get("tailscale:nas"));
  assert.equal(state.failCount, 0);
  assert.equal(state.notified, false);
});

test("an unconfirmed failure resets silently and a new outage can alert", async () => {
  const env = environment();
  let pushes = 0;
  globalThis.fetch = async () => { pushes++; return json({ code: 200 }); };
  for (const status of ["offline", "online", "offline", "offline", "online", "offline", "offline"]) await updateNodeState(env, node(status), 2, now);
  assert.equal(pushes, 3);
});

test("Bark failure is not retried and logs never expose credential-bearing errors", async () => {
  const env = environment();
  let pushes = 0;
  globalThis.fetch = async (url) => { pushes++; throw new Error(url); };
  for (let i = 0; i < 4; i++) await updateNodeState(env, node("offline"), 2, now);
  assert.equal(pushes, 1);
  assert.equal(JSON.parse(env.values.get("tailscale:nas")).notified, true);
  assert.ok(!logs.join("").includes(env.BARK_KEY));
});

test("KV failures do not send notifications or block other nodes", async () => {
  const env = environment();
  const put = env.MONITOR_STATE.put;
  env.MONITOR_STATE.put = async (key, value) => { if (key.endsWith(":bad")) throw new Error("KV unavailable"); await put(key, value); };
  let pushes = 0;
  globalThis.fetch = async () => { pushes++; return json({ code: 200 }); };
  await updateNodeState(env, node("offline", "bad"), 1, now);
  await updateNodeState(env, node("offline", "good"), 1, now);
  assert.equal(pushes, 1);
  assert.ok(env.values.has("tailscale:good"));
});

test("Tailscale uses strict ten-minute boundary and reports missing whitelist nodes", async () => {
  globalThis.fetch = async (_url, options) => {
    assert.equal(options.headers.Authorization, "Bearer test-only-tailscale");
    assert.ok(options.signal instanceof AbortSignal);
    assert.equal(options.redirect, "manual");
    return json({ devices: [{ hostname: "nas", lastSeen: new Date(now - 600000).toISOString() }, { hostname: "old", lastSeen: new Date(now - 600001).toISOString() }, { hostname: "ignored" }] });
  };
  const results = await checkTailscale(environment(), ["nas", "old", "missing"], 10, now);
  assert.deepEqual(results.map((result) => result.status), ["online", "offline", "offline"]);
  assert.equal(results[2].reason, "节点不存在或未加入 tailnet");
});

test("malformed lastSeen and ambiguous names skip the source", async () => {
  for (const devices of [[{ hostname: "nas", lastSeen: "invalid" }], [{ hostname: "nas", lastSeen: new Date(now).toISOString() }, { hostname: "nas", lastSeen: new Date(now).toISOString() }]]) {
    globalThis.fetch = async () => json({ devices });
    assert.equal(await checkTailscale(environment(), ["nas"], 10, now), null);
  }
});

test("Cloudflare pagination includes later whitelist tunnels and empty connections are offline", async () => {
  globalThis.fetch = async (url) => {
    const page = new URL(url).searchParams.get("page");
    return json({ success: true, result_info: { total_pages: 2 }, result: page === "1" ? [{ name: "empty", status: "healthy", connections: [] }, { name: "down", status: "degraded" }] : [{ name: "home", status: "healthy", connections: [{}] }] });
  };
  const results = await checkCloudflared(environment(), ["home", "empty", "down", "missing"]);
  assert.deepEqual(results.map((result) => result.status), ["online", "offline", "offline", "offline"]);
});

for (const failure of [401, 500, "network", "timeout", "malformed"]) {
  test(`upstream ${failure} skips both sources without mutating state or sending Bark`, async () => {
    const env = environment();
    env.values.set("tailscale:nas", JSON.stringify({ status: "offline", failCount: 1, notified: false, lastChecked: new Date(now).toISOString() }));
    const before = [...env.values];
    let bark = 0;
    globalThis.fetch = async (url) => {
      if (url.includes("api.day.app")) bark++;
      if (typeof failure === "number") return json({}, failure);
      if (failure === "malformed") return json({ unexpected: [] });
      throw failure === "timeout" ? new DOMException("Timeout", "TimeoutError") : new Error("Network unavailable");
    };
    await runMonitor(env, now);
    assert.deepEqual([...env.values], before);
    assert.equal(bark, 0);
  });
}

test("a failing source does not prevent the other source alerting and recovering", async () => {
  const env = environment();
  let status = "down";
  const titles = [];
  globalThis.fetch = async (url) => {
    if (url.includes("api.tailscale.com")) return json({}, 401);
    if (url.includes("api.cloudflare.com")) return json({ success: true, result: [{ name: "home", status, connections: [{}] }] });
    titles.push(decodeURIComponent(new URL(url).pathname.split("/")[2]));
    return json({ code: 200 });
  };
  await runMonitor(env, now);
  await runMonitor(env, now + 300000);
  await runMonitor(env, now + 600000);
  status = "healthy";
  await runMonitor(env, now + 900000);
  assert.deepEqual(titles, ["[离线] cloudflared: home", "[恢复] cloudflared: home"]);
  assert.ok(!env.values.has("tailscale:nas"));
});

test("Bark encodes path segments, supports self-hosted base paths and handles rejection", async () => {
  const env = { ...environment(), BARK_SERVER: "https://bark.example.test/push/", BARK_KEY: "test/key" };
  globalThis.fetch = async (url) => {
    assert.equal(url, "https://bark.example.test/push/test%2Fkey/%E7%A6%BB%E7%BA%BF%2Fnas/body%20%26%20more?group=home-dash");
    return json({ code: 400 });
  };
  assert.equal(await sendBark(env, "离线/nas", "body & more"), false);
  env.BARK_SERVER = "http://bark.example.test";
  assert.equal(await sendBark(env, "title", "body"), false);
});

test("invalid config fails closed and empty whitelists make no requests", async () => {
  assert.deepEqual(parseWhitelist('["nas","nas"]'), ["nas"]);
  assert.throws(() => parseWhitelist('[""]'));
  assert.throws(() => parseWhitelist('{}'));
  const env = environment();
  globalThis.fetch = async () => { throw new Error("Unexpected request"); };
  env.FAIL_THRESHOLD = "0";
  await runMonitor(env, now);
  assert.equal(env.values.size, 0);
  env.FAIL_THRESHOLD = "2";
  env.MONITOR_TAILSCALE_NODES = "[]";
  env.MONITOR_CLOUDFLARED_TUNNELS = "[]";
  await runMonitor(env, now);
  assert.equal(env.values.size, 0);
  assert.ok(!("fetch" in worker));
  assert.equal(typeof worker.scheduled, "function");
});

test("the unified worker delegates HTTP, preserves exports and runs Cron", async () => {
  const sourceDirectory = join(directory, "workers/monitor/src");
  const generatedDirectory = join(directory, ".open-next");
  mkdirSync(sourceDirectory, { recursive: true });
  mkdirSync(generatedDirectory);
  for (const file of readdirSync(new URL("../src/", import.meta.url))) {
    writeFileSync(join(sourceDirectory, file.replace(/\.ts$/, ".js")), readFileSync(join(directory, file.replace(/\.ts$/, ".js"))));
  }
  writeFileSync(join(generatedDirectory, "worker.js"), 'exports.default = { fetch(request, env, ctx) { return ctx.respond(request, env); } }; exports.DOQueueHandler = class {}; exports.DOShardedTagCache = class {}; exports.BucketCachePurge = class {};');
  const source = readFileSync(new URL("../../../worker.ts", import.meta.url), "utf8");
  writeFileSync(join(directory, "worker.js"), ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText);
  const unified = require(join(directory, "worker.js"));
  const generated = require(join(generatedDirectory, "worker.js"));
  assert.equal(unified.default.fetch, generated.default.fetch);
  for (const name of ["DOQueueHandler", "DOShardedTagCache", "BucketCachePurge"]) assert.equal(unified[name], generated[name]);
  const env = environment();
  env.MONITOR_TAILSCALE_NODES = "[]";
  env.MONITOR_CLOUDFLARED_TUNNELS = "[]";
  const request = new Request("https://home.example.test/api/config");
  const response = new Response("Existing Next response");
  const context = { respond(receivedRequest, receivedEnv) { assert.equal(receivedRequest, request); assert.equal(receivedEnv, env); return response; } };
  assert.equal(await unified.default.fetch(request, env, context), response);
  await unified.default.scheduled({ cron: "*/5 * * * *" }, env, context);
  assert.ok(logs.some((entry) => entry.includes('"event":"monitor_completed"')));
});

test("snapshot reads only whitelist keys, distinguishes stale and pending, and never returns secrets", async () => {
  const { readMonitorSnapshot } = require(join(directory, "snapshot.js"));
  const env = environment();
  env.MONITOR_TAILSCALE_NODES = '["nas","old","missing","broken"]';
  env.MONITOR_CLOUDFLARED_TUNNELS = "[]";
  env.values.set("tailscale:nas", JSON.stringify({ status: "online", failCount: 0, notified: false, lastChecked: new Date(now).toISOString(), extraSecret: "never-return" }));
  env.values.set("tailscale:old", JSON.stringify({ status: "online", failCount: 0, notified: false, lastChecked: new Date(now - 16 * 60000).toISOString() }));
  env.values.set("tailscale:broken", JSON.stringify({ status: "offline", failCount: -1 }));
  env.values.set("tailscale:unlisted", JSON.stringify({ status: "online" }));
  const before = [...env.values];
  globalThis.fetch = async () => { throw new Error("Snapshot must not fetch upstream"); };
  const snapshot = await readMonitorSnapshot(env, now);
  assert.deepEqual(snapshot.nodes.map((node) => node.freshness), ["fresh", "stale", "pending", "error"]);
  assert.equal(snapshot.nodes[1].status, "online");
  assert.equal(snapshot.nodes[2].status, "unknown");
  assert.ok(!JSON.stringify(snapshot).includes("never-return"));
  assert.ok(!JSON.stringify(snapshot).includes(env.BARK_KEY));
  assert.equal(snapshot.nodes.length, 4);
  assert.deepEqual([...env.values], before);
});

test("a single KV read failure is isolated and malformed whitelists fail closed", async () => {
  const { readMonitorSnapshot } = require(join(directory, "snapshot.js"));
  const env = environment();
  env.MONITOR_STATE.get = async (key) => { if (key.startsWith("tailscale:")) throw new Error("KV unavailable"); return null; };
  const snapshot = await readMonitorSnapshot(env, now);
  assert.deepEqual(snapshot.nodes.map((node) => node.freshness), ["error", "pending"]);
  env.MONITOR_TAILSCALE_NODES = "invalid";
  await assert.rejects(readMonitorSnapshot(env, now));
});
