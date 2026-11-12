import handler from "./.open-next/worker.js";
import monitor from "./workers/monitor/src/index";

export { DOQueueHandler, DOShardedTagCache, BucketCachePurge } from "./.open-next/worker.js";

export default {
  fetch: handler.fetch,
  scheduled: monitor.scheduled,
} satisfies ExportedHandler<CloudflareEnv>;
