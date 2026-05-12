import type { CronJob, ExecutionResult } from '../types/index.js';

export async function getEnabledJobs(db: D1Database): Promise<CronJob[]> {
  const result = await db
    .prepare('SELECT * FROM jobs WHERE enabled = 1')
    .all<CronJob>();
  return result.results;
}

export async function updateJobStatus(
  db: D1Database,
  jobId: number,
  result: ExecutionResult
): Promise<void> {
  await db
    .prepare(
      `UPDATE jobs
       SET last_status = ?, last_duration_ms = ?, last_fetch = unixepoch(),
           last_response = ?, updated_at = unixepoch()
       WHERE id = ?`
    )
    .bind(
      result.status,
      result.durationMs,
      result.responseBody?.substring(0, 500) ?? result.errorMessage ?? null,
      jobId
    )
    .run();
}

export async function insertExecutionLog(
  db: D1Database,
  jobId: number,
  result: ExecutionResult
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO execution_logs
         (job_id, status, status_code, duration_ms, response_size, error_message, response_body)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      jobId,
      result.status,
      result.statusCode ?? null,
      result.durationMs,
      result.responseSize ?? null,
      result.errorMessage ?? null,
      result.responseBody?.substring(0, 10000) ?? null
    )
    .run();
}

export async function upsertDailyStat(
  db: D1Database,
  jobId: number,
  result: ExecutionResult
): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  const isSuccess = result.status === 1 ? 1 : 0;
  const isFail = result.status === 2 || result.status === 4 ? 1 : 0;
  const isTimeout = result.status === 3 ? 1 : 0;

  await db
    .prepare(
      `INSERT INTO daily_stats (job_id, date, total_runs, success_count, fail_count, timeout_count, avg_duration_ms)
       VALUES (?, ?, 1, ?, ?, ?, ?)
       ON CONFLICT(job_id, date) DO UPDATE SET
         total_runs = total_runs + 1,
         success_count = success_count + excluded.success_count,
         fail_count = fail_count + excluded.fail_count,
         timeout_count = timeout_count + excluded.timeout_count,
         avg_duration_ms = (avg_duration_ms * (total_runs - 1) + excluded.avg_duration_ms) / total_runs`
    )
    .bind(jobId, today, isSuccess, isFail, isTimeout, result.durationMs)
    .run();
}