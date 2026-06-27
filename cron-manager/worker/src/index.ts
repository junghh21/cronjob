import { getEnabledJobs } from './lib/d1.js';
import { filterDueJobs } from './cron/scheduler.js';
import { executeJob } from './cron/executor.js';
import { handleShellHub, ShellHub } from './shellHub.js';
import { handleTunnelHub, TunnelHub } from './tunnelHub.js';
import { handleWebhook, webhookStatus, webhookTick, pingVault9 } from './webhook.js';
import type { Env } from './types/index.js';

// The Durable Object classes must be exported from the entry module.
export { ShellHub, TunnelHub };

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const p = url.pathname;

    // Reverse-shell hub (vault9): agent WebSocket + guarded control RPC.
    if (p === '/connect' || p === '/rpc') return handleShellHub(request, env);

    // TCP/SSH tunnel hub: both ends dial out; hub relays raw bytes by conn id.
    if (p === '/tunnel') return handleTunnelHub(request, env);

    // 1-minute recurring trigger / input webhook.
    if (p === '/webhook') return handleWebhook(request, env);
    if (p === '/webhook/status') return webhookStatus(env);

    return new Response('Cron Executor Worker OK', { status: 200 });
  },

  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    // Recurring (1-min) trigger heartbeat + push the trigger to vault9 (no native cron).
    ctx.waitUntil(webhookTick(env));
    ctx.waitUntil(pingVault9(env));
    // Fire any due workbench agents (schedule triggers) in vault9.
    if (env.AGENT_TICK_KEY) {
      ctx.waitUntil(fetch(`https://vault9.pages.dev/api/agents/tick?key=${encodeURIComponent(env.AGENT_TICK_KEY)}`, { method: 'POST' }).then(() => undefined).catch(() => undefined));
    }

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
