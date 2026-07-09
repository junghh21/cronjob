// MCP (Model Context Protocol) HTTP endpoint — JSON-RPC 2.0
// POST /api/mcp  { jsonrpc, id, method, params }

interface Env {
  DB: D1Database;
}

// ── JSON-RPC types ──────────────────────────────────────────────────────────

interface RpcRequest {
  jsonrpc: '2.0';
  id?: string | number | null;
  method: string;
  params?: unknown;
}

interface RpcResponse {
  jsonrpc: '2.0';
  id: string | number | null;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

function ok(id: RpcResponse['id'], result: unknown): Response {
  return Response.json({ jsonrpc: '2.0', id, result } satisfies RpcResponse);
}

function err(id: RpcResponse['id'], code: number, message: string, data?: unknown): Response {
  return Response.json(
    { jsonrpc: '2.0', id, error: { code, message, ...(data ? { data } : {}) } } satisfies RpcResponse
  );
}

// ── Tool definitions ────────────────────────────────────────────────────────

const TOOLS = [
  {
    name: 'list_jobs',
    description: 'List all cron jobs',
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'get_job',
    description: 'Get a single cron job by ID',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'number', description: 'Job ID' } },
      required: ['id'],
    },
  },
  {
    name: 'create_job',
    description: 'Create a new cron job',
    inputSchema: {
      type: 'object',
      properties: {
        title:            { type: 'string' },
        url:              { type: 'string' },
        method:           { type: 'string', enum: ['GET','POST','PUT','DELETE','PATCH','HEAD'] },
        schedule:         { type: 'string', description: 'Cron expression e.g. "0 * * * *"' },
        timezone:         { type: 'string', default: 'UTC' },
        payload:          { type: 'string', description: 'Request body (JSON string)' },
        headers:          { type: 'object', description: 'HTTP headers as key-value pairs' },
        enabled:          { type: 'boolean', default: true },
        timeout_seconds:  { type: 'number', default: 30 },
        follow_redirects: { type: 'boolean', default: true },
        verify_ssl:       { type: 'boolean', default: true },
      },
      required: ['title', 'url', 'schedule'],
    },
  },
  {
    name: 'update_job',
    description: 'Update fields on an existing cron job',
    inputSchema: {
      type: 'object',
      properties: {
        id:               { type: 'number' },
        title:            { type: 'string' },
        url:              { type: 'string' },
        method:           { type: 'string', enum: ['GET','POST','PUT','DELETE','PATCH','HEAD'] },
        schedule:         { type: 'string' },
        timezone:         { type: 'string' },
        payload:          { type: 'string' },
        headers:          { type: 'object' },
        enabled:          { type: 'boolean' },
        timeout_seconds:  { type: 'number' },
        follow_redirects: { type: 'boolean' },
        verify_ssl:       { type: 'boolean' },
      },
      required: ['id'],
    },
  },
  {
    name: 'delete_job',
    description: 'Delete a cron job',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'number' } },
      required: ['id'],
    },
  },
  {
    name: 'execute_job',
    description: 'Manually trigger a cron job immediately',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'number' } },
      required: ['id'],
    },
  },
  {
    name: 'list_logs',
    description: 'Get execution logs for a job',
    inputSchema: {
      type: 'object',
      properties: {
        job_id:    { type: 'number' },
        page:      { type: 'number', default: 1 },
        page_size: { type: 'number', default: 20 },
      },
      required: ['job_id'],
    },
  },
  {
    name: 'get_stats',
    description: 'Get global statistics (total jobs, runs, success rate, etc.)',
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
];

// ── Tool implementations ────────────────────────────────────────────────────

type Args = Record<string, unknown>;

async function callTool(name: string, args: Args, env: Env): Promise<unknown> {
  const db = env.DB;

  switch (name) {
    case 'list_jobs': {
      const { results } = await db.prepare('SELECT * FROM jobs ORDER BY created_at DESC').all();
      return { jobs: results, total: results.length };
    }

    case 'get_job': {
      const job = await db.prepare('SELECT * FROM jobs WHERE id = ?').bind(args.id).first();
      if (!job) throw { code: -32602, message: `Job ${args.id} not found` };
      return job;
    }

    case 'create_job': {
      const {
        title, url, method = 'GET', headers, payload, schedule,
        timezone = 'UTC', enabled = true, timeout_seconds = 30,
        follow_redirects = true, verify_ssl = true,
      } = args;
      const res = await db.prepare(
        `INSERT INTO jobs (title, url, method, headers, payload, schedule, timezone,
           enabled, timeout_seconds, follow_redirects, verify_ssl)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        title, url, method,
        headers ? JSON.stringify(headers) : null,
        payload ?? null,
        schedule, timezone,
        enabled ? 1 : 0,
        Number(timeout_seconds),
        follow_redirects ? 1 : 0,
        verify_ssl ? 1 : 0,
      ).run();
      return db.prepare('SELECT * FROM jobs WHERE id = ?').bind(res.meta.last_row_id).first();
    }

    case 'update_job': {
      const { id, headers: hdrs, enabled, follow_redirects, verify_ssl, ...rest } = args;
      const fields: string[] = [];
      const values: unknown[] = [];

      const scalars = ['title', 'url', 'method', 'schedule', 'timezone', 'payload', 'timeout_seconds'] as const;
      for (const k of scalars) {
        if (k in rest && rest[k] !== undefined) { fields.push(`${k} = ?`); values.push(rest[k]); }
      }
      if (hdrs !== undefined) { fields.push('headers = ?'); values.push(hdrs ? JSON.stringify(hdrs) : null); }
      if (enabled !== undefined) { fields.push('enabled = ?'); values.push(enabled ? 1 : 0); }
      if (follow_redirects !== undefined) { fields.push('follow_redirects = ?'); values.push(follow_redirects ? 1 : 0); }
      if (verify_ssl !== undefined) { fields.push('verify_ssl = ?'); values.push(verify_ssl ? 1 : 0); }

      if (fields.length === 0) throw { code: -32602, message: 'Nothing to update' };
      fields.push('updated_at = unixepoch()');
      values.push(id);

      await db.prepare(`UPDATE jobs SET ${fields.join(', ')} WHERE id = ?`).bind(...values).run();
      return db.prepare('SELECT * FROM jobs WHERE id = ?').bind(id).first();
    }

    case 'delete_job': {
      await db.prepare('DELETE FROM jobs WHERE id = ?').bind(args.id).run();
      return { success: true };
    }

    case 'execute_job': {
      const job = await db.prepare('SELECT * FROM jobs WHERE id = ?')
        .bind(args.id)
        .first<{ id: number; url: string; method: string; headers: string | null; payload: string | null; timeout_seconds: number; follow_redirects: number }>();
      if (!job) throw { code: -32602, message: `Job ${args.id} not found` };

      const startTime = Date.now();
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), job.timeout_seconds * 1000);
      let parsedHeaders: Record<string, string> = {};
      if (job.headers) { try { parsedHeaders = JSON.parse(job.headers) as Record<string, string>; } catch { /* ignore */ } }

      let status: number, statusCode: number | null = null, responseBody: string | null = null, errorMessage: string | null = null;
      try {
        const resp = await fetch(job.url, {
          method: job.method,
          headers: parsedHeaders,
          body: job.payload && job.method !== 'GET' && job.method !== 'HEAD' ? job.payload : undefined,
          redirect: job.follow_redirects ? 'follow' : 'manual',
          signal: controller.signal,
        });
        clearTimeout(timer);
        const body = await resp.text();
        status = resp.ok ? 1 : 4;
        statusCode = resp.status;
        responseBody = body.substring(0, 10000);
      } catch (e) {
        clearTimeout(timer);
        const ex = e as Error;
        status = ex.name === 'AbortError' ? 3 : 2;
        errorMessage = ex.message;
      }
      const durationMs = Date.now() - startTime;

      await Promise.allSettled([
        db.prepare(
          `UPDATE jobs SET last_status=?, last_duration_ms=?, last_fetch=unixepoch(), last_response=?, updated_at=unixepoch() WHERE id=?`
        ).bind(status, durationMs, responseBody ?? errorMessage, job.id).run(),
        db.prepare(
          `INSERT INTO execution_logs (job_id, status, status_code, duration_ms, response_size, error_message, response_body)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        ).bind(job.id, status, statusCode, durationMs, responseBody?.length ?? null, errorMessage, responseBody).run(),
      ]);

      return { success: true, status, statusCode, durationMs, responseBody, errorMessage };
    }

    case 'list_logs': {
      const page = Number(args.page ?? 1);
      const pageSize = Number(args.page_size ?? 20);
      const offset = (page - 1) * pageSize;
      const { results } = await db.prepare(
        'SELECT * FROM execution_logs WHERE job_id = ? ORDER BY executed_at DESC LIMIT ? OFFSET ?'
      ).bind(args.job_id, pageSize, offset).all();
      const total = await db.prepare('SELECT COUNT(*) as n FROM execution_logs WHERE job_id = ?')
        .bind(args.job_id).first<{ n: number }>();
      return { logs: results, total: total?.n ?? 0, page, pageSize };
    }

    case 'get_stats': {
      const [jobs, runs] = await Promise.all([
        db.prepare('SELECT COUNT(*) as total, SUM(enabled) as enabled FROM jobs').first<{ total: number; enabled: number }>(),
        db.prepare(
          `SELECT COUNT(*) as totalRuns,
                  SUM(CASE WHEN status=1 THEN 1 ELSE 0 END) as successCount,
                  SUM(CASE WHEN status=2 OR status=4 THEN 1 ELSE 0 END) as failCount,
                  SUM(CASE WHEN status=3 THEN 1 ELSE 0 END) as timeoutCount
           FROM execution_logs`
        ).first<{ totalRuns: number; successCount: number; failCount: number; timeoutCount: number }>(),
      ]);
      const totalRuns = runs?.totalRuns ?? 0;
      const successCount = runs?.successCount ?? 0;
      return {
        totalJobs: jobs?.total ?? 0,
        enabledJobs: jobs?.enabled ?? 0,
        totalRuns,
        successCount,
        failCount: runs?.failCount ?? 0,
        timeoutCount: runs?.timeoutCount ?? 0,
        successRate: totalRuns > 0 ? (successCount / totalRuns) * 100 : 0,
      };
    }

    default:
      throw { code: -32601, message: `Unknown tool: ${name}` };
  }
}

// ── Request handler ─────────────────────────────────────────────────────────

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  let req: RpcRequest;
  try {
    req = await request.json() as RpcRequest;
  } catch {
    return err(null, -32700, 'Parse error');
  }

  const id = req.id ?? null;
  const method = req.method;

  try {
    switch (method) {
      case 'initialize':
        return ok(id, {
          protocolVersion: '2024-11-05',
          serverInfo: { name: 'cron-manager', version: '1.0.0' },
          capabilities: { tools: {} },
        });

      case 'tools/list':
        return ok(id, { tools: TOOLS });

      case 'tools/call': {
        const p = req.params as { name?: string; arguments?: Args };
        if (!p?.name) return err(id, -32602, 'Missing tool name');
        const result = await callTool(p.name, p.arguments ?? {}, env);
        return ok(id, {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        });
      }

      case 'ping':
        return ok(id, {});

      default:
        return err(id, -32601, `Method not found: ${method}`);
    }
  } catch (e) {
    const rpcErr = e as { code?: number; message?: string };
    if (rpcErr.code && rpcErr.message) return err(id, rpcErr.code, rpcErr.message);
    return err(id, -32603, 'Internal error', e instanceof Error ? e.message : String(e));
  }
};

// GET — returns a discovery document so AI clients can find the endpoint
export const onRequestGet: PagesFunction<Env> = async () => {
  return Response.json({
    mcp: true,
    endpoint: '/api/mcp',
    transport: 'http',
    protocolVersion: '2024-11-05',
    tools: TOOLS.map(t => ({ name: t.name, description: t.description })),
  });
};
