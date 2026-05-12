import type { ExecutionResult } from '../types/index.js';

export async function cacheJobResult(
  kv: KVNamespace,
  jobId: number,
  result: ExecutionResult
): Promise<void> {
  await kv.put(
    `job:${jobId}:last`,
    JSON.stringify({ ...result, cachedAt: Date.now() }),
    { expirationTtl: 86400 }
  );
}

export async function bufferDailyLog(
  kv: KVNamespace,
  jobId: number,
  result: ExecutionResult
): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  const key = `log:${jobId}:${today}`;
  const existing = await kv.get<{ entries: unknown[] }>(key, 'json');
  const entries = existing?.entries ?? [];
  entries.push({ ...result, ts: Date.now() });
  await kv.put(key, JSON.stringify({ entries: entries.slice(-100) }), {
    expirationTtl: 86400 * 7,
  });
}