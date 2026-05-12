interface Env { DB: D1Database; }

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  const [totals] = (await env.DB.prepare(
    `SELECT
       COUNT(*) as totalJobs,
       SUM(CASE WHEN enabled=1 THEN 1 ELSE 0 END) as enabledJobs
     FROM jobs`
  ).all()).results as { totalJobs: number; enabledJobs: number }[];

  const [logTotals] = (await env.DB.prepare(
    `SELECT
       COUNT(*) as totalRuns,
       SUM(CASE WHEN status=1 THEN 1 ELSE 0 END) as successCount,
       SUM(CASE WHEN status IN (2,4) THEN 1 ELSE 0 END) as failCount,
       SUM(CASE WHEN status=3 THEN 1 ELSE 0 END) as timeoutCount
     FROM execution_logs`
  ).all()).results as { totalRuns: number; successCount: number; failCount: number; timeoutCount: number }[];

  const successRate = logTotals.totalRuns > 0
    ? (logTotals.successCount / logTotals.totalRuns) * 100
    : 0;

  return Response.json({
    totalJobs: totals.totalJobs ?? 0,
    enabledJobs: totals.enabledJobs ?? 0,
    totalRuns: logTotals.totalRuns ?? 0,
    successCount: logTotals.successCount ?? 0,
    failCount: logTotals.failCount ?? 0,
    timeoutCount: logTotals.timeoutCount ?? 0,
    successRate,
  });
};