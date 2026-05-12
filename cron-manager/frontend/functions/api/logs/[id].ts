interface Env { DB: D1Database; }

export const onRequestGet: PagesFunction<Env> = async ({ params, request, env }) => {
  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get('page') ?? '1');
  const pageSize = parseInt(url.searchParams.get('pageSize') ?? '20');
  const offset = (page - 1) * pageSize;

  const [{ count }] = (await env.DB.prepare('SELECT COUNT(*) as count FROM execution_logs WHERE job_id = ?').bind(params.id).all()).results as { count: number }[];
  const { results } = await env.DB.prepare(
    'SELECT * FROM execution_logs WHERE job_id = ? ORDER BY executed_at DESC LIMIT ? OFFSET ?'
  ).bind(params.id, pageSize, offset).all();

  return Response.json({ logs: results, total: count, page, pageSize });
};