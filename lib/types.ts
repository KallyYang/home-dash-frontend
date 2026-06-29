export interface MetaInfo {
  available: boolean;
  updated_at?: string;
  error?: string;
}

export interface PVEGuest {
  vmid: number;
  name: string;
  type: "qemu" | "lxc";
  status: string;
  cpu: number;
  cpus: number;
  mem: number;
  maxmem: number;
  disk: number;
  maxdisk: number;
  uptime: number;
  tags?: string;
}

export interface PVENode {
  node: string;
  status: string;
  cpu: number;
  maxcpu: number;
  mem: number;
  maxmem: number;
  disk: number;
  maxdisk: number;
  uptime: number;
  level?: string;
  vms?: PVEGuest[];
  cts?: PVEGuest[];
}

export interface PVETotals {
  cpu_usage: number;
  maxcpu: number;
  mem: number;
  maxmem: number;
  disk: number;
  maxdisk: number;
  node_count: number;
  online_nodes: number;
}

export interface PVESnapshot {
  nodes: PVENode[];
  totals: PVETotals;
  fetched_at: string;
}

export interface K8SNodeSummary {
  name: string;
  ready: boolean;
  role: string;
  kubelet_version: string;
  os_image: string;
  architecture: string;
  kernel_version: string;
  container_runtime: string;
  internal_ip: string;
  cpu_capacity: string;
  cpu_allocatable: string;
  memory_capacity: string;
  memory_allocatable: string;
  disk_capacity: string;
  pods_capacity: string;
  cpu_capacity_milli: number;
  memory_capacity_bytes: number;
  disk_capacity_bytes: number;
  pod_count: number;
}

export interface K8SPodStats {
  total: number;
  running: number;
  pending: number;
  succeeded: number;
  failed: number;
  unknown: number;
}

export interface K8SDeploymentSummary {
  name: string;
  namespace: string;
  desired: number;
  ready: number;
  updated: number;
  available: number;
}

export interface K8SDeploymentStats {
  total: number;
  ready: number;
  items: K8SDeploymentSummary[];
}

export interface K8SSnapshot {
  version: string;
  node_count: number;
  pod_count: number;
  nodes: K8SNodeSummary[];
  pods: K8SPodStats;
  deployments: K8SDeploymentStats;
  fetched_at: string;
}

export interface ProxyUsagePoint {
  date: string;
  download: number;
  upload: number;
}

export interface ProxySnapshot {
  service_name: string;
  used_percent: number;
  total_gb: number;
  used_gb: number;
  remaining_gb: number;
  reset_in_days: number;
  expire_in_days: number;
  remaining_label: string;
  daily_usage: ProxyUsagePoint[];
  source_url: string;
  fetched_at: string;
}

export interface Overview {
  pve: PVESnapshot | null;
  pve_meta: MetaInfo;
  k8s: K8SSnapshot | null;
  k8s_meta: MetaInfo;
  proxy: ProxySnapshot | null;
  proxy_meta: MetaInfo;
  dns: DNSSnapshot | null;
  dns_meta: MetaInfo;
  cfai: CFAISnapshot | null;
  cfai_meta: MetaInfo;
}

export interface DNSCountEntry {
  name: string;
  count: number;
}

export interface DNSAvgTimeEntry {
  name: string;
  avg_time: number;
}

export interface DNSSnapshot {
  time_units: string;
  num_dns_queries: number;
  num_blocked_filtering: number;
  num_replaced_safebrowsing: number;
  num_replaced_safesearch: number;
  num_replaced_parental: number;
  avg_processing_time: number;
  dns_queries: number[];
  blocked_filtering: number[];
  replaced_safebrowsing: number[];
  replaced_parental: number[];
  top_queried_domains: DNSCountEntry[];
  top_blocked_domains: DNSCountEntry[];
  top_clients: DNSCountEntry[];
  top_upstreams_responses: DNSCountEntry[];
  top_upstreams_avg_time: DNSAvgTimeEntry[];
  source_url: string;
  fetched_at: string;
}

export interface CFAIDimensionEntry {
  name: string;
  requests: number;
  tokens_in: number;
  tokens_out: number;
  total_tokens: number;
  cost: number;
  cached_requests: number;
  errored_requests: number;
}

export interface CFAITimePoint {
  ts: string;
  requests: number;
  tokens: number;
  cost: number;
  cached: number;
  errors: number;
}

export interface WeatherNow {
  temp: number;
  icon: string;
  text: string;
}

export interface WeatherToday {
  temp_max: number;
  temp_min: number;
}

export interface WeatherMinutely {
  summary: string;
}

export interface WeatherSnapshot {
  location: string;
  updated_at: string;
  now: WeatherNow;
  today: WeatherToday;
  minutely?: WeatherMinutely;
}

export interface CFAISnapshot {
  account_id: string;
  gateway_id: string;
  window_days: number;
  window_start: string;
  window_end: string;
  total_requests: number;
  total_tokens_in: number;
  total_tokens_out: number;
  total_tokens: number;
  total_cost: number;
  total_cached: number;
  total_errored: number;
  cache_hit_pct: number;
  error_pct: number;
  by_model: CFAIDimensionEntry[];
  by_provider: CFAIDimensionEntry[];
  by_gateway: CFAIDimensionEntry[];
  daily_series: CFAITimePoint[];
  fetched_at: string;
}
