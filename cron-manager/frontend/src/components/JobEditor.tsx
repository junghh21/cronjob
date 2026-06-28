import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useJob, useJobActions } from '../hooks/useJobs';
import { toString as cronToString } from 'cronstrue';
import type { HttpMethod } from '../types/cronjob';

const METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD'];
const TIMEZONES = ['UTC', 'Asia/Seoul', 'America/New_York', 'America/Los_Angeles', 'Europe/London', 'Asia/Tokyo'];

interface FormData {
  title: string;
  url: string;
  method: HttpMethod;
  schedule: string;
  timezone: string;
  payload: string;
  headersRaw: string;
  timeout_seconds: number;
  enabled: boolean;
  follow_redirects: boolean;
  verify_ssl: boolean;
}

export default function JobEditor() {
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id && id !== 'new';
  const navigate = useNavigate();
  const { job } = useJob(isEdit ? Number(id) : 0);
  const { createJob, updateJob } = useJobActions();

  const [form, setForm] = useState<FormData>({
    title: '',
    url: '',
    method: 'GET',
    schedule: '0 * * * *',
    timezone: 'UTC',
    payload: '',
    headersRaw: '',
    timeout_seconds: 30,
    enabled: true,
    follow_redirects: true,
    verify_ssl: true,
  });
  const [saving, setSaving] = useState(false);
  const [scheduleLabel, setScheduleLabel] = useState('');

  useEffect(() => {
    if (job && isEdit) {
      setForm({
        title: job.title,
        url: job.url,
        method: job.method,
        schedule: job.schedule,
        timezone: job.timezone,
        payload: job.payload ?? '',
        headersRaw: job.headers ?? '',
        timeout_seconds: job.timeout_seconds,
        enabled: !!job.enabled,
        follow_redirects: !!job.follow_redirects,
        verify_ssl: !!job.verify_ssl,
      });
    }
  }, [job, isEdit]);

  useEffect(() => {
    try {
      setScheduleLabel(cronToString(form.schedule));
    } catch {
      setScheduleLabel('Invalid cron expression');
    }
  }, [form.schedule]);

  const set = <K extends keyof FormData>(key: K, value: FormData[K]) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      let parsedHeaders: Record<string, string> | undefined;
      if (form.headersRaw.trim()) {
        parsedHeaders = JSON.parse(form.headersRaw) as Record<string, string>;
      }
      const data = {
        title: form.title,
        url: form.url,
        method: form.method,
        schedule: form.schedule,
        timezone: form.timezone,
        payload: form.payload || undefined,
        headers: parsedHeaders,
        timeout_seconds: form.timeout_seconds,
        enabled: form.enabled,
        follow_redirects: form.follow_redirects,
        verify_ssl: form.verify_ssl,
      };
      if (isEdit) {
        await updateJob(Number(id), data);
      } else {
        await createJob(data);
      }
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

  return (
    <div style={{ padding: '24px', maxWidth: '640px' }}>
      <h2 style={{ marginBottom: '24px' }}>{isEdit ? 'Edit Job' : 'New Cron Job'}</h2>
      <form onSubmit={handleSubmit} style={{ background: '#fff', padding: '24px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <div style={fieldStyle}>
          <label style={labelStyle}>Title</label>
          <input style={inputStyle} value={form.title} onChange={e => set('title', e.target.value)} required placeholder="My Cron Job" />
        </div>
        <div style={fieldStyle}>
          <label style={labelStyle}>URL</label>
          <input style={inputStyle} value={form.url} onChange={e => set('url', e.target.value)} required type="url" placeholder="https://example.com/endpoint" />
        </div>
        <div style={{ ...fieldStyle, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div>
            <label style={labelStyle}>Method</label>
            <select style={inputStyle} value={form.method} onChange={e => set('method', e.target.value as HttpMethod)}>
              {METHODS.map(m => <option key={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Timezone</label>
            <select style={inputStyle} value={form.timezone} onChange={e => set('timezone', e.target.value)}>
              {TIMEZONES.map(tz => <option key={tz}>{tz}</option>)}
            </select>
          </div>
        </div>
        <div style={fieldStyle}>
          <label style={labelStyle}>Cron Schedule</label>
          <input style={inputStyle} value={form.schedule} onChange={e => set('schedule', e.target.value)} required placeholder="* * * * *" />
          <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>{scheduleLabel}</div>
        </div>
        {form.method !== 'GET' && form.method !== 'HEAD' && (
          <div style={fieldStyle}>
            <label style={labelStyle}>Request Body</label>
            <textarea style={{ ...inputStyle, height: '100px', resize: 'vertical', fontFamily: 'monospace' }}
              value={form.payload} onChange={e => set('payload', e.target.value)}
              placeholder={'{"event_type": "deploy-worker", "client_payload": {}}'} />
            <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
              Sent as the request body for {form.method}. (GET/HEAD ignore the body.)
            </div>
          </div>
        )}
        <div style={fieldStyle}>
          <label style={labelStyle}>Headers (JSON)</label>
          <textarea style={{ ...inputStyle, height: '80px', resize: 'vertical', fontFamily: 'monospace' }}
            value={form.headersRaw} onChange={e => set('headersRaw', e.target.value)}
            placeholder='{"Authorization": "Bearer token"}' />
        </div>
        <div style={{ ...fieldStyle, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
          {([['enabled', 'Enabled'], ['follow_redirects', 'Follow Redirects'], ['verify_ssl', 'Verify SSL']] as const).map(([key, label]) => (
            <label key={key} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input type="checkbox" checked={form[key] as boolean} onChange={e => set(key, e.target.checked)} />
              <span style={{ fontSize: '13px' }}>{label}</span>
            </label>
          ))}
        </div>
        <div style={fieldStyle}>
          <label style={labelStyle}>Timeout (seconds)</label>
          <input style={{ ...inputStyle, width: '120px' }} type="number" min={1} max={300}
            value={form.timeout_seconds} onChange={e => set('timeout_seconds', Number(e.target.value))} />
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button type="submit" disabled={saving}
            style={{ background: '#1976d2', color: '#fff', border: 'none', borderRadius: '6px', padding: '10px 24px', cursor: 'pointer', fontWeight: 600 }}>
            {saving ? 'Saving...' : isEdit ? 'Update Job' : 'Create Job'}
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