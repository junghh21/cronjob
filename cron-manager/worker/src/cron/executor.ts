import { executeHttpJob } from '../lib/http.js';
import { updateJobStatus, insertExecutionLog, upsertDailyStat } from '../lib/d1.js';
import type { CronJob, Env } from '../types/index.js';

export async function executeJob(job: CronJob, env: Env): Promise<void> {
  const result = await executeHttpJob(job);

  await Promise.allSettled([
    updateJobStatus(env.DB, job.id, result),
    insertExecutionLog(env.DB, job.id, result),
    upsertDailyStat(env.DB, job.id, result),
  ]);
}