import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useJob, useJobActions } from '../hooks/useJobs';
import { toString as cronToString } from 'cronstrue';

const TIMEZONES = ['UTC', 'Asia/Seoul', 'America/New_York', 'America/Los_Angeles', 'Europe/London', 'Asia/Tokyo'];

interface GhForm {
  title: string;
  owner: string;
  repo: string;
  token: string;
  eventType: string;
  clientPayload: string;   // raw JSON object string
  schedule: string;
  timezone: string;
  enabled: boolean;
  timeout_seconds: number;
}

const DISPATCH_URL_RE = /api\.github\.com\/repos\/([^/]+)\/([^/]+)\/dispatches/;

function buildHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'User-Agent': 'cron-manager',
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

export default function GhDispatchEditor() {
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id && id !== 'new';
  const navigate = useNavigate();
  const { job } = useJob(isEdit ? Number(id) : 0);
  const { createJob, updateJob } = useJobActions();

  const [form, setForm] = useState<GhForm>({
    title: '',
    owner: '',
    repo: '',
    token: '',
    eventType: 'deploy-worker',
    clientPayload: '{}',
    schedule: '0 2 * * *',
    timezone: 'Asia/Seoul',
    enabled: true,
    timeout_seconds: 30,
  });
  const [saving, setSaving] = useState(false);
  const [scheduleLabel, setScheduleLabel] = useState('');

  // Hydrate from an existing job: parse url / headers / payload back into GH fields.
  useEffect(() => {
    if (!job || !isEdit) return;
    const m = job.url.match(DISPATCH_URL_RE);
    let token = '';
    try {
      const hdrs = job.headers ? JSON.parse(job.headers) as Record<string, string> : {};
      token = (hdrs.Authorization ?? '').replace(/^Bearer\s+/i, '');
    } catch { /* ignore */ }

    let eventType = 'deploy-worker';
    let clientPayload = '{}';
    try {
      const p = job.payload ? JSON.parse(job.payload) as { event_type?: string; client_payload?: unknown } : {};
      if (p.event_type) eventType = p.event_type;
      if (p.client_payload !== undefined) clientPayload = JSON.stringify(p.client_payload, null, 2);
    } catch { /* ignore */ }

    setForm({
      title: job.title,
      owner: m?.[1] ?? '',
      repo: m?.[2] ?? '',
      token,
      eventType,
      clientPayload,
      schedule: job.schedule,
      timezone: job.timezone,
      enabled: !!job.enabled,
      timeout_seconds: job.timeout_seconds,
    });
  }, [job, isEdit]);

  useEffect(() => {
    try { setScheduleLabel(cronToString(form.schedule)); }
    catch { setScheduleLabel('Invalid cron expression'); }
  }, [form.schedule]);

  const set = <K extends keyof GhForm>(key: K, value: GhForm[K]) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      // Validate client_payload is valid JSON object.
      let parsedClient: unknown = {};
      if (form.clientPayload.trim()) {
        parsedClient = JSON.parse(form.clientPayload);
      }
      const payload = JSON.stringify({
        event_type: form.eventType,
        client_payload: parsedClient,
      });

      const data = {
        title: form.title,
        url: `https://api.github.com/repos/${form.owner}/${form.repo}/dispatches`,
        method: 'POST' as const,
        schedule: form.schedule,
        timezone: form.timezone,
        payload,
        headers: buildHeaders(form.token),
        timeout_seconds: form.timeout_seconds,
        enabled: form.enabled,
        follow_redirects: true,
        verify_ssl: true,
      };

      if (isEdit) await updateJob(Number(id), data);
      else await createJob(data);
      navigate('/jobs');
    } catch (e) {
      alert(`Error: ${(e as Error).message}`);
    } finally {
      setSaving(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '8px 12px', border: '1px solid #ddd',
    borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box',
  };
  const labelStyle: React.CSSProperties = { display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 600, color: '#444' };
  const fieldStyle: React.CSSProperties = { marginBottom: '18px' };

  const dispatchUrl = `https://api.github.com/repos/${form.owner || '{owner}'}/${form.repo || '{repo}'}/dispatches`;

  return (
    <div style={{ padding: '24px', maxWidth: '640px' }}>
      <h2 style={{ marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span>🐙</span> {isEdit ? 'Edit GitHub Dispatch' : 'New GitHub Dispatch'}
      </h2>
      <p style={{ color: '#666', fontSize: '13px', marginBottom: '24px' }}>
        Triggers a GitHub Actions workflow via <code>repository_dispatch</code>.
      </p>

      <form onSubmit={handleSubmit} style={{ background: '#fff', padding: '24px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <div style={fieldStyle}>
          <label style={labelStyle}>Title</label>
          <input style={inputStyle} value={form.title} onChange={e => set('title', e.target.value)} required placeholder="GH: Deploy Worker" />
        </div>

        <div style={{ ...fieldStyle, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div>
            <label style={labelStyle}>Owner</label>
            <input style={inputStyle} value={form.owner} onChange={e => set('owner', e.target.value)} required placeholder="junghh21" />
          </div>
          <div>
            <label style={labelStyle}>Repository</label>
            <input style={inputStyle} value={form.repo} onChange={e => set('repo', e.target.value)} required placeholder="cronjob" />
          </div>
        </div>

        <div style={fieldStyle}>
          <label style={labelStyle}>Personal Access Token</label>
          <input style={inputStyle} type="password" value={form.token} onChange={e => set('token', e.target.value)}
            required placeholder="ghp_xxxxxxxxxxxxxxxxxxxx" autoComplete="off" />
          <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
            Needs <code>repo</code> scope (classic) or <em>Contents: Read &amp; Write</em> (fine-grained).
          </div>
        </div>

        <div style={fieldStyle}>
          <label style={labelStyle}>Event Type</label>
          <input style={inputStyle} value={form.eventType} onChange={e => set('eventType', e.target.value)}
            required placeholder="deploy-worker" />
          <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
            Must match a <code>repository_dispatch.types</code> entry in your workflow.
          </div>
        </div>

        <div style={fieldStyle}>
          <label style={labelStyle}>Client Payload (JSON)</label>
          <textarea style={{ ...inputStyle, height: '90px', resize: 'vertical', fontFamily: 'monospace' }}
            value={form.clientPayload} onChange={e => set('clientPayload', e.target.value)}
            placeholder='{"env": "production"}' />
          <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
            Available in the workflow as <code>github.event.client_payload</code>.
          </div>
        </div>

        <div style={fieldStyle}>
          <label style={labelStyle}>Cron Schedule</label>
          <input style={inputStyle} value={form.schedule} onChange={e => set('schedule', e.target.value)} required placeholder="0 2 * * *" />
          <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>{scheduleLabel}</div>
        </div>

        <div style={{ ...fieldStyle, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div>
            <label style={labelStyle}>Timezone</label>
            <select style={inputStyle} value={form.timezone} onChange={e => set('timezone', e.target.value)}>
              {TIMEZONES.map(tz => <option key={tz}>{tz}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Timeout (seconds)</label>
            <input style={inputStyle} type="number" min={1} max={300}
              value={form.timeout_seconds} onChange={e => set('timeout_seconds', Number(e.target.value))} />
          </div>
        </div>

        <label style={{ ...fieldStyle, display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
          <input type="checkbox" checked={form.enabled} onChange={e => set('enabled', e.target.checked)} />
          <span style={{ fontSize: '13px' }}>Enabled</span>
        </label>

        <div style={{ background: '#f5f7fa', border: '1px solid #e0e4e8', borderRadius: '6px', padding: '12px 14px', marginBottom: '20px', fontSize: '12px', color: '#555' }}>
          <div style={{ fontWeight: 600, marginBottom: '6px', color: '#444' }}>Generated request</div>
          <div style={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>POST {dispatchUrl}</div>
          <div style={{ fontFamily: 'monospace', marginTop: '4px' }}>
            {`{"event_type":"${form.eventType}","client_payload":${form.clientPayload || '{}'}}`}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <button type="submit" disabled={saving}
            style={{ background: '#24292f', color: '#fff', border: 'none', borderRadius: '6px', padding: '10px 24px', cursor: 'pointer', fontWeight: 600 }}>
            {saving ? 'Saving...' : isEdit ? 'Update Dispatch' : 'Create Dispatch'}
          </button>
          <button type="button" onClick={() => navigate('/jobs')}
            style={{ background: '#fff', border: '1px solid #ccc', borderRadius: '6px', padding: '10px 24px', cursor: 'pointer' }}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
