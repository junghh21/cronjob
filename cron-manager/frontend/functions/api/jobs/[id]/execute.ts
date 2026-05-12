interface Env {
  DB: D1Database;
  CACHE: KVNamespace;
}

interface DbJob {
  id: number;
  url: string;
  method: string;
  headers: string | null;
  payload: string | null;
  timeout_seconds: number;
  follow_redirects: number;
}

async function runHttpJob(job: DbJob) {
  const startTime = Date.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), job.timeout_seconds * 1000);

  let parsedHeaders: Record<string, string> = {};
  if (job.headers) {
    try { parsedHeaders = JSON.parse(job.headers) as Record<string, string>; } catch { /* ignore */ }
  }

  try {
    const response = await fetch(job.url, {
      method: job.method,
      headers: parsedHeaders,
      body: job.payload && job.method !== 'GET' && job.method !== 'HEAD' ? job.payload : undefined,
      redirect: job.follow_redirects ? 'follow' : 'manual',
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    const body = await response.text();
    return {
      status: (response.ok ? 1 : 4) as 1 | 4,
      statusCode: response.status,
      durationMs: Date.now() - startTime,
      responseSize: body.length,
      responseBody: body.substring(0, 10000),
      errorMessage: undefined as string | undefined,
    };
  } catch (error) {
    clearTimeout(timeoutId);
    const err = error as Error;
    return {
      status: (err.name === 'AbortError' ? 3 : 2) as 2 | 3,
      statusCode: undefined as number | undefined,
      durationMs: Date.now() - startTime,
      responseSize: undefined as number | undefined,
      responseBody: undefined as string | undefined,
      errorMessage: err.message,
    };
  }
}

export const onRequestPost: PagesFunction<Env> = async ({ params, env }) => {
  const job = await env.DB.prepare('SELECT * FROM jobs WHERE id = ?')
    .bind(params.id)
    .first<DbJob>();

  if (!job) return new Response('Not found', { status: 404 });

  const result = await runHttpJob(job);

  await Promise.allSettled([
    env.DB.prepare(
      `UPDATE jobs SET last_status = ?, last_duration_ms = ?, last_fetch = unixepoch(),
       last_response = ?, updated_at = unixepoch() WHERE id = ?`
    ).bind(
      result.status,
      result.durationMs,
      result.responseBody?.substring(0, 500) ?? result.errorMessage ?? null,
      params.id
    ).run(),
    env.DB.prepare(
      `INSERT INTO execution_logs
         (job_id, status, status_code, duration_ms, response_size, error_message, response_body)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      params.id,
      result.status,
      result.statusCode ?? null,
      result.durationMs,
      result.responseSize ?? null,
      result.errorMessage ?? null,
      result.responseBody?.substring(0, 10000) ?? null
    ).run(),
  ]);

  return Response.json({ success: true, result });
};