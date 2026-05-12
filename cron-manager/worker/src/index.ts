import { getEnabledJobs } from './lib/d1.js';
import { filterDueJobs } from './cron/scheduler.js';
import { executeJob } from './cron/executor.js';
import type { Env } from './types/index.js';

export default {
  async fetch(_request: Request, _env: Env): Promise<Response> {
    return new Response('Cron Executor Worker OK', { status: 200 });
  },

  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    const now = new Date();
    const allJobs = await getEnabledJobs(env.DB);
    const dueJobs = filterDueJobs(allJobs, now);

    if (dueJobs.length === 0) return;

    const executions = dueJobs.map(job =>
      executeJob(job, env).catch(err => {
        console.error(`Job ${job.id} (${job.title}) failed:`, err);
      })
    );

    ctx.waitUntil(Promise.allSettled(executions));
  },
};