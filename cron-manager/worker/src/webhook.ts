/**
 * 1-minute recurring trigger + input webhook.
 *
 *  - POST/GET https://cronjob.junghh21.workers.dev/webhook
 *      Input webhook: records the payload and bumps a counter (KV). Returns
 *      { ok, count, receivedAt }. Call it from anything to inject a trigger.
 *  - The Worker's scheduled() handler fires webhookTick() every minute (the
 *      recurring trigger), recording a heartbeat so /webhook/status shows liveness.
 *  - GET /webhook/status -> { count, last, ticks, lastTick }
 */
import type { Env } from './types/index.js';

const COUNT_KEY = 'webhook:count';
const LAST_KEY = 'webhook:last';
const TICKS_KEY = 'webhook:ticks';
const TICK_KEY = 'webhook:tick';

export async function handleWebhook(request: Request, env: Env): Promise<Response> {
  const method = request.method;
  let payload: unknown = null;
  if (method === 'POST' || method === 'PUT' || method === 'PATCH') {
    payload = await request.clone().json().catch(async () => (await request.text().catch(() => null)));
  } else {
    payload = Object.fromEntries(new URL(request.url).searchParams);
  }
  const count = (Number(await env.CACHE.get(COUNT_KEY)) || 0) + 1;
  const entry = { at: Date.now(), method, payload };
  await Promise.all([
    env.CACHE.put(COUNT_KEY, String(count)),
    env.CACHE.put(LAST_KEY, JSON.stringify(entry), { expirationTtl: 86400 * 7 }),
  ]);
  return Response.json({ ok: true, count, receivedAt: entry.at });
}

export async function webhookStatus(env: Env): Promise<Response> {
  const [count, last, ticks, tick] = await Promise.all([
    env.CACHE.get(COUNT_KEY),
    env.CACHE.get(LAST_KEY, 'json'),
    env.CACHE.get(TICKS_KEY),
    env.CACHE.get(TICK_KEY, 'json'),
  ]);
  return Response.json({ count: Number(count) || 0, last: last ?? null, ticks: Number(ticks) || 0, lastTick: tick ?? null });
}

/** Recurring trigger — called by scheduled() once per minute. */
export async function webhookTick(env: Env): Promise<void> {
  const ticks = (Number(await env.CACHE.get(TICKS_KEY)) || 0) + 1;
  await Promise.all([
    env.CACHE.put(TICKS_KEY, String(ticks)),
    env.CACHE.put(TICK_KEY, JSON.stringify({ at: Date.now(), ticks }), { expirationTtl: 86400 }),
  ]);
}
