interface Env { DB: D1Database; }

export const onRequestGet: PagesFunction<Env> = async ({ params, env }) => {
  const { results } = await env.DB.prepare(
    'SELECT * FROM daily_stats WHERE job_id = ? ORDER BY date DESC LIMIT 30'
  ).bind(params.id).all();
  return Response.json({ daily: results });
};