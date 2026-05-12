import { parseExpression } from 'cron-parser';
import type { CronJob } from '../types/index.js';

export function isJobDue(job: CronJob, now: Date = new Date()): boolean {
  try {
    const interval = parseExpression(job.schedule, {
      currentDate: new Date(now.getTime() - 60 * 1000),
      tz: job.timezone || 'UTC',
    });
    const next = interval.next().toDate();
    return next.getTime() <= now.getTime();
  } catch {
    return false;
  }
}

export function filterDueJobs(jobs: CronJob[], now: Date = new Date()): CronJob[] {
  return jobs.filter(job => isJobDue(job, now));
}