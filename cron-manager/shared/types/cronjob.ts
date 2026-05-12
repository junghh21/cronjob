export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD';

export type JobStatus = 0 | 1 | 2 | 3 | 4;
// 0: 미실행, 1: 성공, 2: 실패, 3: 타임아웃, 4: HTTP에러

export interface CronJob {
  id: number;
  user_id: string;
  title: string;
  url: string;
  method: HttpMethod;
  headers: string | null;      // JSON string
  payload: string | null;
  schedule: string;
  timezone: string;
  enabled: number;             // 0 | 1

  last_status: JobStatus;
  last_duration_ms: number | null;
  last_fetch: number | null;
  last_response: string | null;

  timeout_seconds: number;
  follow_redirects: number;    // 0 | 1
  verify_ssl: number;          // 0 | 1

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
  id: number;
  job_id: number;
  date: string;
  total_runs: number;
  success_count: number;
  fail_count: number;
  timeout_count: number;
  avg_duration_ms: number | null;
}

export interface ExecutionResult {
  status: JobStatus;
  statusCode?: number;
  durationMs: number;
  responseSize?: number;
  responseBody?: string;
  errorMessage?: string;
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

export interface UpdateJobInput extends Partial<CreateJobInput> {}

export interface JobListResponse {
  jobs: CronJob[];
  total: number;
}

export interface LogListResponse {
  logs: ExecutionLog[];
  total: number;
  page: number;
  pageSize: number;
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