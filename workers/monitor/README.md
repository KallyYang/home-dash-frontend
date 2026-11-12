# 边缘节点在线监控

监控是现有 `home-dash-frontend` Worker 的新增功能，与前端共用一个 Worker、一个根目录 `wrangler.jsonc` 和一次 `npm run deploy`。监控只由每 5 分钟的 Cron 触发，不新增 HTTP 状态端点、状态页面或资源监控。`workers/monitor/` 只是源码模块目录，不再是独立部署项目。

## 架构核实

[OpenNext 官方 Custom Worker 文档](https://opennext.js.org/cloudflare/howtos/custom-worker)支持自定义 wrapper。根目录 `worker.ts` 保留生成 handler 的 `fetch`，同时接入监控 `scheduled`，并透传 OpenNext 1.19.8 的 `DOQueueHandler`、`DOShardedTagCache`、`BucketCachePurge` 导出。主配置 `main` 指向 `worker.ts`；不修改 `.open-next` 产物，不改前端 UI。

`types/open-next-worker.d.ts` 描述生成 JS 的导入边界；环境与运行时类型统一由根配置生成 `cloudflare-env.d.ts`。监控 TS 检查包含真实 wrapper，使用同一份 `CloudflareEnv`，没有独立 MonitorEnv 或独立 Wrangler 配置。

## 部署

在仓库根目录执行，建议使用 Node.js 22.13+：

```powershell
npm ci
npx wrangler kv namespace create home-dash-monitor-state --config wrangler.jsonc
```

将返回的 namespace ID 写入根目录 `wrangler.jsonc` 的绑定：

```json
"kv_namespaces": [{ "binding": "MONITOR_STATE", "id": "<RETURNED_NAMESPACE_ID>" }]
```

仓库默认省略 ID，允许本地 KV 模拟；若直接部署，Wrangler 4.86 支持自动创建 KV 并回写 ID，但名称可能由 Worker 和 binding 自动生成。建议手动创建上面的 namespace，确保名称明确；监控 KV 不要与 Next 缓存 KV 混用。

修改同一配置的 `vars`，填写真实 hostname / tunnel 名称，必须精确匹配，大小写敏感；默认空白名单不会发起任何上游请求：

```json
"vars": {
  "MONITOR_TAILSCALE_NODES": "[\"my-nas\",\"my-vps\"]",
  "MONITOR_CLOUDFLARED_TUNNELS": "[\"home-tunnel\"]",
  "OFFLINE_THRESHOLD_MINUTES": "10",
  "FAIL_THRESHOLD": "2",
  "BARK_SERVER": "https://api.day.app"
}
```

通过 Wrangler 分别输入四个 secret，全部保存到现有 `home-dash-frontend` Worker：

```powershell
npx wrangler secret put TAILSCALE_API_KEY --config wrangler.jsonc
npx wrangler secret put CF_API_TOKEN --config wrangler.jsonc
npx wrangler secret put CF_ACCOUNT_ID --config wrangler.jsonc
npx wrangler secret put BARK_KEY --config wrangler.jsonc
npm run typecheck:monitor
npm run test:monitor
npm run deploy
npx wrangler tail home-dash-frontend --config wrangler.jsonc --format json
```

Tailscale 使用 API access key，默认有效期通常为 90 天，生成时选更长有效期，并在到期前轮换。Cloudflare API token 只需目标账号的 `Account → Cloudflare Tunnel → Read`；部署权限与此只读 token 是不同凭据。`CF_ACCOUNT_ID` 是查询隧道所属账号，也按 secret 保存。

自建 Bark 修改 `BARK_SERVER`，支持 HTTPS 地址及路径前缀，不允许 HTTP、URL 用户密码、查询串或 fragment，Bark key 必须单独放在 secret。不要把真实凭据写入源码、配置、README、`.env` 或 `.dev.vars`；测试使用纯模拟数据，不需要凭据。

`secrets.required` 仅列出 secret 名称，用于 Wrangler 生成类型，不包含真实值；当前 Wrangler 会对该实验性字段提示 warning。类型文件由 `npm run cf-typegen` 生成并忽略。监控不需要 secret 时（空白名单）不会阻塞前端请求。

`npm run deploy` 仍执行 `opennextjs-cloudflare build && opennextjs-cloudflare deploy`：先生成 Next/OpenNext 产物，再一次部署前端与 Cron。主配置的 `vars` 同时管理前端与监控；若此前在 dashboard 设置了非 secret 前端变量，需合并回主配置以免部署覆盖。

若之前已经在云端部署过独立 `home-dash-monitor`，先在 Cloudflare 控制台停用其 Cron，避免两个任务并行告警；独立 Worker 的 secrets 不会自动迁移，需按上述命令重新设置到主 Worker。可将原监控 KV ID 绑定到主 Worker，以保留防抖状态。本实现没有执行任何云端删除或迁移。

## 判定和状态

- Tailscale：`lastSeen` 距检查时间严格超过 10 分钟为离线；白名单节点缺失标记“节点不存在或未加入 tailnet”。非法时间或重名导致来源跳过，避免误报。
- cloudflared：`status !== "healthy"` 或明确返回空 `connections` 为离线；支持分页，缺失隧道视为离线。API 错误、`success: false`、格式异常或重名跳过整个来源。
- 所有 fetch 使用 10 秒超时、禁止重定向、响应体上限 4 MiB；HTTP、网络、超时和解析异常均跳过，不修改该来源的 KV，不累积失败次数。被跳过的轮次不算观测，不重置已有 failCount。
- 每个节点保存 `status`、`failCount`、`notified`、`lastChecked`、`lastChange`；key 为 `tailscale:<hostname>` 或 `cloudflared:<name>`。观察状态变化更新 lastChange；连续两次有效离线观测告警，未确认的离线恢复时静默重置。
- `notified` 表示离线通知已尝试，不保证已送达。先持久化状态，再发送 Bark，避免 Bark 失败导致每轮重试；恢复也只尝试一次。发送失败只记脱敏日志，不重试。KV 写入失败时不推送，避免无法保存去重状态。
- 节点按来源逐个处理，一个节点 KV 或通知失败不阻塞其他节点；两个来源独立执行。日志记录每轮开始/结束、来源统计、节点状态及通知送达结果，不记录凭据或含 Bark key 的 URL。

KV 是最终一致存储，不支持事务锁；该轻量方案适用于单 Cron 每 5 分钟运行，但不能承诺跨区域并发或进程在“KV 写入后、推送前”中断时严格 exactly-once。不要并发手动触发同一个生产 KV；不设置 TTL，避免状态过期导致重复告警。

## 验证

`npm run test:monitor` 使用 Node 内置测试运行器与已有 TypeScript 编译器，模拟 fetch、KV 和 Bark，无新增依赖；也用临时 OpenNext 测试替身验证真实 `worker.ts` 的 HTTP 委托、Cron 与命名导出。临时编译文件放系统临时目录，测试替身不写入生产 `.open-next`，不替代真实 Next 构建验收。

可在不配置任何真实 secret、保持白名单为空时验证 Workers 原生 scheduled 入口：

```powershell
npx opennextjs-cloudflare build
npx wrangler dev --config wrangler.jsonc --test-scheduled
```

另一终端触发 Wrangler 本地测试入口（这不是部署到生产的 HTTP 端点）：

```powershell
Invoke-WebRequest -Uri 'http://localhost:8787/__scheduled?cron=*/5+*+*+*+*'
```

真实部署后 Cron 配置传播可能需要最多 15 分钟。通过 tail 或 Cloudflare Workers Logs 确认 `monitor_started`、`source_checked`、`node_checked`、`monitor_completed`；故障时查看 `source_skipped` / `bark_failed`。实机验收需在独立测试节点停用并等待两次有效离线观测，确认 Bark 离线消息，再恢复并确认单条恢复消息；Tailscale 还需先超过 lastSeen 阈值。测试结束后观察不翻转时无重复推送。

完整 build/preview/deploy 必须先解决项目内已有的前端构建错误。本地监控测试和类型检查可以单独执行，但不能证明实际 Next 页面构建成功。
