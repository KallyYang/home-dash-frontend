declare module "*.open-next/worker.js" {
  const handler: {
    fetch: ExportedHandlerFetchHandler<CloudflareEnv>;
  };
  export default handler;
  export const DOQueueHandler: unknown;
  export const DOShardedTagCache: unknown;
  export const BucketCachePurge: unknown;
}
