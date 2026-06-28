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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <h2>Dashboard</h2>
        <div style={{ display: 'flex', gap: '8px' }}>
          <a
            href="/manual.md"
            target="_blank"
            rel="noreferrer"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              padding: '6px 14px', borderRadius: '6px', fontSize: '13px', fontWeight: 600,
              background: '#fff', border: '1px solid #1976d2', color: '#1976d2',
              textDecoration: 'none',
            }}
          >
            📖 Manual
          </a>
          <a
            href="/api/mcp"
            target="_blank"
            rel="noreferrer"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              padding: '6px 14px', borderRadius: '6px', fontSize: '13px', fontWeight: 600,
              background: '#fff', border: '1px solid #7b1fa2', color: '#7b1fa2',
              textDecoration: 'none',
            }}
          >
            🤖 MCP API
          </a>
        </div>
      </div>
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
