/**
 * 1-minute recurring trigger + input webhook.
 *
 *  - POST/GET https://cronjob.junghh21.workers.dev/webhook
 *      Input webhook: records the payload and bumps a counter. Returns
 *      { ok, count, receivedAt }. Call it from anything to inject a trigger.
 *  - The Worker's scheduled() handler fires webhookTick() every minute (the
 *      recurring trigger) and pings vault9's webhook.
 *  - GET /webhook/status -> { count, last, ticks, lastTick }
 *
 * State lives in D1 (not KV): the per-minute cron would blow the free-plan KV
 * write cap (1000/day), whereas D1 allows ~100k writes/day.
 */
import type { Env } from './types/index.js';

const COUNT_KEY = 'webhook:count';
const LAST_KEY = 'webhook:last';
const TICKS_KEY = 'webhook:ticks';
const TICK_KEY = 'webhook:tick';

let schemaReady = false;
async function ensure(env: Env): Promise<void> {
  if (schemaReady) return;
  await env.DB.prepare('CREATE TABLE IF NOT EXISTS webhook_meta (key TEXT PRIMARY KEY, value TEXT)').run();
  schemaReady = true;
}
const getMeta = async (env: Env, k: string): Promise<string | null> =>
  (await env.DB.prepare('SELECT value FROM webhook_meta WHERE key = ?').bind(k).first<{ value: string }>())?.value ?? null;
const setMeta = (env: Env, k: string, v: string) =>
  env.DB.prepare('INSERT INTO webhook_meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').bind(k, v).run();

export async function handleWebhook(request: Request, env: Env): Promise<Response> {
  try {
    await ensure(env);
    const method = request.method;
    let payload: unknown = null;
    if (method === 'POST' || method === 'PUT' || method === 'PATCH') {
      const txt = await request.text().catch(() => '');
      try { payload = txt ? JSON.parse(txt) : null; } catch { payload = txt; }
    } else {
      payload = Object.fromEntries(new URL(request.url).searchParams);
    }
    const count = (Number(await getMeta(env, COUNT_KEY)) || 0) + 1;
    const entry = { at: Date.now(), method, payload };
    await env.DB.batch([
      env.DB.prepare('INSERT INTO webhook_meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').bind(COUNT_KEY, String(count)),
      env.DB.prepare('INSERT INTO webhook_meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').bind(LAST_KEY, JSON.stringify(entry)),
    ]);
    return Response.json({ ok: true, count, receivedAt: entry.at });
  } catch (e) {
    return Response.json({ ok: false, error: (e as Error)?.message || String(e) }, { status: 500 });
  }
}

export async function webhookStatus(env: Env): Promise<Response> {
  await ensure(env);
  const [count, last, ticks, tick] = await Promise.all([
    getMeta(env, COUNT_KEY), getMeta(env, LAST_KEY), getMeta(env, TICKS_KEY), getMeta(env, TICK_KEY),
  ]);
  return Response.json({
    count: Number(count) || 0,
    last: last ? JSON.parse(last) : null,
    ticks: Number(ticks) || 0,
    lastTick: tick ? JSON.parse(tick) : null,
  });
}

/** Recurring trigger — called by scheduled() once per minute. */
export async function webhookTick(env: Env): Promise<void> {
  await ensure(env);
  const ticks = (Number(await getMeta(env, TICKS_KEY)) || 0) + 1;
  await setMeta(env, TICK_KEY, JSON.stringify({ at: Date.now(), ticks }));
  await setMeta(env, TICKS_KEY, String(ticks));
}

/** Give vault9 (Cloudflare Pages has no cron) its own 1-min trigger by pinging it. */
export async function pingVault9(env: Env): Promise<void> {
  const url = env.VAULT9_WEBHOOK_URL || 'https://vault9.pages.dev/api/webhook';
  try {
    await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ source: 'cronjob-cron', at: Date.now() }) });
  } catch { /* best-effort heartbeat */ }
}
