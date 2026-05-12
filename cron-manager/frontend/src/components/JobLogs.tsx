import { useState } from 'react';
import { useParams } from 'react-router-dom';
import useSWR from 'swr';
import { api } from '../utils/api';
import StatusBadge from './StatusBadge';
import type { JobStatus } from '../types/cronjob';

export default function JobLogs() {
  const { id } = useParams<{ id: string }>();
  const [page, setPage] = useState(1);
  const { data, isLoading } = useSWR(
    id ? `/api/logs/${id}?page=${page}` : null,
    () => api.logs.list(Number(id), page)
  );

  if (isLoading) return <div style={{ padding: '24px' }}>Loading...</div>;

  const logs = data?.logs ?? [];
  const total = data?.total ?? 0;
  const pages = Math.ceil(total / (data?.pageSize ?? 20));

  return (
    <div style={{ padding: '24px' }}>
      <h2 style={{ marginBottom: '16px' }}>Execution Logs</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <thead style={{ background: '#f5f5f5' }}>
          <tr>
            {['Time', 'Status', 'HTTP Code', 'Duration', 'Size', 'Error'].map(h => (
              <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: '#555' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {logs.map(log => (
            <tr key={log.id} style={{ borderTop: '1px solid #eee' }}>
              <td style={{ padding: '10px 14px', fontSize: '13px' }}>{new Date(log.executed_at * 1000).toLocaleString()}</td>
              <td style={{ padding: '10px 14px' }}><StatusBadge status={log.status as JobStatus} size="sm" /></td>
              <td style={{ padding: '10px 14px', fontSize: '13px' }}>{log.status_code ?? '-'}</td>
              <td style={{ padding: '10px 14px', fontSize: '13px' }}>{log.duration_ms != null ? `${log.duration_ms}ms` : '-'}</td>
              <td style={{ padding: '10px 14px', fontSize: '13px' }}>{log.response_size != null ? `${log.response_size}B` : '-'}</td>
              <td style={{ padding: '10px 14px', fontSize: '12px', color: '#e53935' }}>{log.error_message ?? ''}</td>
            </tr>
          ))}
          {logs.length === 0 && (
            <tr><td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: '#999' }}>No logs yet.</td></tr>
          )}
        </tbody>
      </table>
      {pages > 1 && (
        <div style={{ marginTop: '16px', display: 'flex', gap: '8px', justifyContent: 'center' }}>
          {Array.from({ length: pages }, (_, i) => i + 1).map(p => (
            <button key={p} onClick={() => setPage(p)}
              style={{ padding: '6px 12px', borderRadius: '4px', border: '1px solid #ddd', background: p === page ? '#1976d2' : '#fff', color: p === page ? '#fff' : '#333', cursor: 'pointer' }}>
              {p}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
