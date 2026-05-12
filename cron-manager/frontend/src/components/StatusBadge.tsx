import type { JobStatus } from '../types/cronjob';

const STATUS_LABELS: Record<JobStatus, string> = {
  0: 'Unknown',
  1: 'OK',
  2: 'Failed',
  3: 'Timeout',
  4: 'HTTP Error',
};

const STATUS_COLORS: Record<JobStatus, string> = {
  0: '#03a9f4',
  1: '#4caf50',
  2: '#ef5350',
  3: '#ff9800',
  4: '#ef5350',
};

interface Props {
  status: JobStatus;
  size?: 'sm' | 'md';
}

export default function StatusBadge({ status, size = 'md' }: Props) {
  const label = STATUS_LABELS[status];
  const color = STATUS_COLORS[status];
  const px = size === 'sm' ? '6px 10px' : '4px 12px';
  const fs = size === 'sm' ? '11px' : '12px';

  return (
    <span
      style={{
        backgroundColor: color,
        color: '#fff',
        borderRadius: '4px',
        padding: px,
        fontSize: fs,
        fontWeight: 600,
        letterSpacing: '0.03em',
        display: 'inline-block',
      }}
    >
      {label}
    </span>
  );
}