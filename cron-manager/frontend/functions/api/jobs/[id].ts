interface Env {
  DB: D1Database;
}

export const onRequestGet: PagesFunction<Env> = async ({ params, env }) => {
  try {
    const job = await env.DB.prepare('SELECT * FROM jobs WHERE id = ?')
      .bind(params.id)
      .first();
    if (!job) return Response.json({ error: 'Not found' }, { status: 404 });
    return Response.json(job);
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
};

export const onRequestPatch: PagesFunction<Env> = async ({ params, request, env }) => {
  try {
    const body = await request.json() as Record<string, unknown>;
    const fields: string[] = [];
    const values: unknown[] = [];

    const allowed = ['title', 'url', 'method', 'schedule', 'timezone', 'payload', 'timeout_seconds'];
    for (const key of allowed) {
      if (key in body) { fields.push(`${key} = ?`); values.push(body[key]); }
    }
    if ('headers' in body) {
      fields.push('headers = ?');
      values.push(body.headers ? JSON.stringify(body.headers) : null);
    }
    if ('enabled' in body) { fields.push('enabled = ?'); values.push(body.enabled ? 1 : 0); }
    if ('follow_redirects' in body) { fields.push('follow_redirects = ?'); values.push(body.follow_redirects ? 1 : 0); }
    if ('verify_ssl' in body) { fields.push('verify_ssl = ?'); values.push(body.verify_ssl ? 1 : 0); }

    if (fields.length === 0) return Response.json({ error: 'Nothing to update' }, { status: 400 });
    fields.push('updated_at = unixepoch()');
    values.push(params.id);

    await env.DB.prepare(`UPDATE jobs SET ${fields.join(', ')} WHERE id = ?`)
      .bind(...values)
      .run();

    const job = await env.DB.prepare('SELECT * FROM jobs WHERE id = ?').bind(params.id).first();
    return Response.json(job);
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
};

export const onRequestDelete: PagesFunction<Env> = async ({ params, env }) => {
  try {
    await env.DB.prepare('DELETE FROM jobs WHERE id = ?').bind(params.id).run();
    return Response.json({ success: true });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
};
