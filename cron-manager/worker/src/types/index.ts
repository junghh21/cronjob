export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD';
export type JobStatus = 0 | 1 | 2 | 3 | 4;

export interface CronJob {
  id: number;
  user_id: string;
  title: string;
  url: string;
  method: HttpMethod;
  headers: string | null;
  payload: string | null;
  schedule: string;
  timezone: string;
  enabled: number;
  last_status: JobStatus;
  last_duration_ms: number | null;
  last_fetch: number | null;
  last_response: string | null;
  timeout_seconds: number;
  follow_redirects: number;
  verify_ssl: number;
  created_at: number;
  updated_at: number;
}

export interface ExecutionResult {
  status: JobStatus;
  statusCode?: number;
  durationMs: number;
  responseSize?: number;
  responseBody?: string;
  errorMessage?: string;
}

export interface Env {
  DB: D1Database;
  CACHE: KVNamespace;
  // Reverse-shell hub (vault9) — ShellHub DO + shared agent token.
  SHELL_HUB: DurableObjectNamespace;
  // TCP/SSH tunnel rendezvous hub.
  TUNNEL_HUB: DurableObjectNamespace;
  HUB_SECRET: string;
  // Optional override for the vault9 webhook the cron pings each minute.
  VAULT9_WEBHOOK_URL?: string;
}