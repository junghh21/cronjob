import useSWR, { mutate } from 'swr';
import { api } from '../utils/api';
import type { CreateJobInput, UpdateJobInput } from '../types/cronjob';

const JOBS_KEY = '/api/jobs';

export function useJobs() {
  const { data, error, isLoading } = useSWR(JOBS_KEY, () => api.jobs.list(), {
    refreshInterval: 30000,
  });

  return {
    jobs: data?.jobs ?? [],
    total: data?.total ?? 0,
    isLoading,
    error,
    refresh: () => mutate(JOBS_KEY),
  };
}

export function useJob(id: number) {
  const { data, error, isLoading } = useSWR(
    id ? `/api/jobs/${id}` : null,
    () => api.jobs.get(id)
  );
  return { job: data, isLoading, error };
}

export function useJobActions() {
  const refresh = () => mutate(JOBS_KEY);

  return {
    createJob: async (data: CreateJobInput) => {
      const job = await api.jobs.create(data);
      await refresh();
      return job;
    },
    updateJob: async (id: number, data: UpdateJobInput) => {
      const job = await api.jobs.update(id, data);
      await refresh();
      return job;
    },
    deleteJob: async (id: number) => {
      await api.jobs.delete(id);
      await refresh();
    },
    executeJob: (id: number) => api.jobs.execute(id),
  };
}