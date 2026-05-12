import type { CronJob, ExecutionResult } from '../types/index.js';

function parseHeaders(headersJson: string | null): Record<string, string> {
  if (!headersJson) return {};
  try {
    return JSON.parse(headersJson) as Record<string, string>;
  } catch {
    return {};
  }
}

export async function executeHttpJob(job: CronJob): Promise<ExecutionResult> {
  const startTime = Date.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), job.timeout_seconds * 1000);

  try {
    const response = await fetch(job.url, {
      method: job.method,
      headers: parseHeaders(job.headers),
      body:
        job.payload && job.method !== 'GET' && job.method !== 'HEAD'
          ? job.payload
          : undefined,
      redirect: job.follow_redirects ? 'follow' : 'manual',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const duration = Date.now() - startTime;
    const body = await response.text();

    return {
      status: response.ok ? 1 : 4,
      statusCode: response.status,
      durationMs: duration,
      responseSize: body.length,
      responseBody: body.substring(0, 10000),
    };
  } catch (error) {
    clearTimeout(timeoutId);
    const err = error as Error;
    const isTimeout = err.name === 'AbortError';

    return {
      status: isTimeout ? 3 : 2,
      durationMs: Date.now() - startTime,
      errorMessage: err.message,
    };
  }
}