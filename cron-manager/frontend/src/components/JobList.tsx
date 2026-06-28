import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useJobs, useJobActions } from '../hooks/useJobs';
import StatusBadge from './StatusBadge';
import { toString as cronToString } from 'cronstrue';

export default function JobList() {
  const { jobs, isLoading } = useJobs();
  const { deleteJob, executeJob } = useJobActions();
  const [executing, setExecuting] = useState<number | null>(null);

  if (isLoading) return <div style={{ padding: '24px' }}>Loading...</div>;

  const handleExecute = async (id: number) => {
    setExecuting(id);
    try {
      await executeJob(id);
      alert('Job executed successfully');
    } catch (e) {
      alert(`Execution failed: ${(e as Error).message}`);
    } finally {
      setExecuting(null);
    }
  };

  const handleDelete = async (id: number, title: string) => {
    if (!confirm(`Delete job "${title}"?`)) return;
    await deleteJob(id);
  };

  const scheduleLabel = (expr: string) => {
    try { return cronToString(expr); } catch { return expr; }
  };

  const isGhDispatch = (url: string) => /api\.github\.com\/repos\/[^/]+\/[^/]+\/dispatches/.test(url);

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
        <h2>Cron Jobs</h2>
        <div style={{ display: 'flex', gap: '8px' }}>
          <Link to="/jobs/gh-new">
            <button style={{ background: '#24292f', color: '#fff', border: 'none', borderRadius: '6px', padding: '8px 18px', cursor: 'pointer' }}>
              🐙 GitHub Dispatch
            </button>
          </Link>
          <Link to="/jobs/new">
            <button style={{ background: '#1976d2', color: '#fff', border: 'none', borderRadius: '6px', padding: '8px 18px', cursor: 'pointer' }}>
              + New Job
            </button>
          </Link>
        </div>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <thead style={{ background: '#f5f5f5' }}>
          <tr>
            {['Title', 'URL', 'Schedule', 'Status', 'Last Run', 'Actions'].map(h => (
              <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '13px', fontWeight: 600, color: '#555' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {jobs.map(job => (
            <tr key={job.id} style={{ borderTop: '1px solid #eee' }}>
              <td style={{ padding: '12px 16px' }}>
                <Link to={`/jobs/${job.id}`} style={{ fontWeight: 600, textDecoration: 'none', color: '#1976d2' }}>
                  {job.title}
                </Link>
                {isGhDispatch(job.url) && (
                  <span style={{ marginLeft: '8px', fontSize: '11px', background: '#24292f', color: '#fff', padding: '1px 6px', borderRadius: '10px' }}>🐙 dispatch</span>
                )}
                {!job.enabled && <span style={{ marginLeft: '8px', fontSize: '11px', color: '#999' }}>(disabled)</span>}
              </td>
              <td style={{ padding: '12px 16px', fontSize: '13px', color: '#444', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {job.url}
              </td>
              <td style={{ padding: '12px 16px', fontSize: '13px', color: '#444' }}>
                <code style={{ fontSize: '12px' }}>{job.schedule}</code>
                <div style={{ fontSize: '11px', color: '#999' }}>{scheduleLabel(job.schedule)}</div>
              </td>
              <td style={{ padding: '12px 16px' }}>
                <StatusBadge status={job.last_status} size="sm" />
              </td>
              <td style={{ padding: '12px 16px', fontSize: '13px', color: '#666' }}>
                {job.last_fetch ? new Date(job.last_fetch * 1000).toLocaleString() : '-'}
              </td>
              <td style={{ padding: '12px 16px' }}>
                <button onClick={() => handleExecute(job.id)} disabled={executing === job.id}
                  style={{ marginRight: '8px', fontSize: '12px', padding: '4px 10px', cursor: 'pointer', borderRadius: '4px', border: '1px solid #ccc' }}>
                  {executing === job.id ? '...' : 'Run'}
                </button>
                <Link to={isGhDispatch(job.url) ? `/jobs/${job.id}/gh-edit` : `/jobs/${job.id}/edit`}>
                  <button style={{ marginRight: '8px', fontSize: '12px', padding: '4px 10px', cursor: 'pointer', borderRadius: '4px', border: '1px solid #ccc' }}>Edit</button>
                </Link>
                <button onClick={() => handleDelete(job.id, job.title)}
                  style={{ fontSize: '12px', padding: '4px 10px', cursor: 'pointer', borderRadius: '4px', border: '1px solid #f44336', color: '#f44336' }}>
                  Delete
                </button>
              </td>
            </tr>
          ))}
          {jobs.length === 0 && (
            <tr>
              <td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: '#999' }}>
                No cron jobs yet. <Link to="/jobs/new">Create one</Link>.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}