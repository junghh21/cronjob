import { useStats } from '../hooks/useStats';

export default function Dashboard() {
  const { stats, isLoading } = useStats();

  if (isLoading) return <div className="loading">Loading...</div>;
  if (!stats) return null;

  const cards = [
    { label: 'Total Jobs', value: stats.totalJobs },
    { label: 'Active Jobs', value: stats.enabledJobs },
    { label: 'Total Runs', value: stats.totalRuns },
    { label: 'Success Rate', value: `${stats.successRate.toFixed(1)}%` },
    { label: 'Failures', value: stats.failCount },
    { label: 'Timeouts', value: stats.timeoutCount },
  ];

  return (
    <div style={{ padding: '24px' }}>
      <h2 style={{ marginBottom: '20px' }}>Dashboard</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '16px' }}>
        {cards.map(c => (
          <div
            key={c.label}
            style={{
              background: '#fff',
              border: '1px solid #e0e0e0',
              borderRadius: '8px',
              padding: '20px',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: '28px', fontWeight: 700, color: '#1976d2' }}>{c.value}</div>
            <div style={{ fontSize: '13px', color: '#666', marginTop: '6px' }}>{c.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
