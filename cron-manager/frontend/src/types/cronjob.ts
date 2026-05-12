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

export interface ExecutionLog {
  id: number;
  job_id: number;
  status: JobStatus;
  status_code: number | null;
  duration_ms: number | null;
  response_size: number | null;
  error_message: string | null;
  response_body: string | null;
  executed_at: number;
}

export interface DailyStat {
  job_id: number;
  date: string;
  total_runs: number;
  success_count: number;
  fail_count: number;
  timeout_count: number;
  avg_duration_ms: number | null;
}

export interface StatsResponse {
  totalJobs: number;
  enabledJobs: number;
  totalRuns: number;
  successCount: number;
  failCount: number;
  timeoutCount: number;
  successRate: number;
}

export interface CreateJobInput {
  title: string;
  url: string;
  method?: HttpMethod;
  headers?: Record<string, string>;
  payload?: string;
  schedule: string;
  timezone?: string;
  enabled?: boolean;
  timeout_seconds?: number;
  follow_redirects?: boolean;
  verify_ssl?: boolean;
}

export type UpdateJobInput = Partial<CreateJobInput>;
