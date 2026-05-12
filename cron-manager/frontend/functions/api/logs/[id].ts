interface Env { DB: D1Database; }

export const onRequestGet: PagesFunction<Env> = async ({ params, request, env }) => {
  try {
    const url = new URL(request.url);
    const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1'));
    const pageSize = Math.min(100, Math.max(1, parseInt(url.searchParams.get('pageSize') ?? '20')));
    const offset = (page - 1) * pageSize;

    const countRow = await env.DB.prepare(
      'SELECT COUNT(*) as count FROM execution_logs WHERE job_id = ?'
    ).bind(params.id).first<{ count: number }>();
    const total = countRow?.count ?? 0;

    const { results } = await env.DB.prepare(
      'SELECT * FROM execution_logs WHERE job_id = ? ORDER BY executed_at DESC LIMIT ? OFFSET ?'
    ).bind(params.id, pageSize, offset).all();

    return Response.json({ logs: results, total, page, pageSize });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
};
