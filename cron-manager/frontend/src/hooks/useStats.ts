import useSWR from 'swr';
import { api } from '../utils/api';

export function useStats() {
  const { data, error, isLoading } = useSWR('/api/stats', () => api.stats.global(), {
    refreshInterval: 60000,
  });
  return { stats: data, isLoading, error };
}

export function useJobStats(jobId: number) {
  const { data, error, isLoading } = useSWR(
    jobId ? `/api/stats/${jobId}` : null,
    () => api.stats.job(jobId)
  );
  return { stats: data, isLoading, error };
}
