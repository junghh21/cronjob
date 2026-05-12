interface Env {
  DB: D1Database;
}

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  const { results } = await env.DB.prepare(
    'SELECT * FROM jobs ORDER BY created_at DESC'
  ).all();
  return Response.json({ jobs: results, total: results.length });
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const body = await request.json() as Record<string, unknown>;
  const {
    title, url, method = 'GET', headers, payload, schedule,
    timezone = 'UTC', enabled = true, timeout_seconds = 30,
    follow_redirects = true, verify_ssl = true,
  } = body;

  const result = await env.DB.prepare(
    `INSERT INTO jobs (title, url, method, headers, payload, schedule, timezone, enabled, timeout_seconds, follow_redirects, verify_ssl)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    title, url, method,
    headers ? JSON.stringify(headers) : null,
    payload ?? null,
    schedule, timezone,
    enabled ? 1 : 0,
    timeout_seconds,
    follow_redirects ? 1 : 0,
    verify_ssl ? 1 : 0,
  ).run();

  const job = await env.DB.prepare('SELECT * FROM jobs WHERE id = ?')
    .bind(result.meta.last_row_id)
    .first();

  return Response.json(job, { status: 201 });
};
