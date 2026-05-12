import type { CronJob, CreateJobInput, UpdateJobInput, ExecutionLog, StatsResponse } from '../types/cronjob';

const BASE = '/api';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    ...init,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  jobs: {
    list: () => request<{ jobs: CronJob[]; total: number }>('/jobs'),
    get: (id: number) => request<CronJob>(`/jobs/${id}`),
    create: (data: CreateJobInput) =>
      request<CronJob>('/jobs', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: UpdateJobInput) =>
      request<CronJob>(`/jobs/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (id: number) => request<{ success: boolean }>(`/jobs/${id}`, { method: 'DELETE' }),
    execute: (id: number) =>
      request<{ success: boolean; result: unknown }>(`/jobs/${id}/execute`, { method: 'POST' }),
  },
  logs: {
    list: (jobId: number, page = 1, pageSize = 20) =>
      request<{ logs: ExecutionLog[]; total: number; page: number; pageSize: number }>(
        `/logs/${jobId}?page=${page}&pageSize=${pageSize}`
      ),
  },
  stats: {
    global: () => request<StatsResponse>('/stats'),
    job: (jobId: number) =>
      request<{ daily: unknown[] }>(`/stats/${jobId}`),
  },
};