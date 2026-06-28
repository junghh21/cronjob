import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import Dashboard from './components/Dashboard';
import JobList from './components/JobList';
import JobEditor from './components/JobEditor';
import GhDispatchEditor from './components/GhDispatchEditor';
import JobLogs from './components/JobLogs';

function Nav() {
  const loc = useLocation();
  const active = (path: string) => loc.pathname.startsWith(path);
  const linkStyle = (path: string): React.CSSProperties => ({
    textDecoration: 'none',
    padding: '8px 16px',
    borderRadius: '4px',
    fontSize: '14px',
    fontWeight: active(path) ? 600 : 400,
    background: active(path) ? 'rgba(255,255,255,0.2)' : 'transparent',
    color: '#fff',
  });
  return (
    <nav style={{ background: '#1976d2', padding: '0 24px', display: 'flex', alignItems: 'center', height: '56px', gap: '8px' }}>
      <span style={{ color: '#fff', fontWeight: 700, fontSize: '18px', marginRight: '24px' }}>CronManager</span>
      <Link to="/" style={linkStyle('/_')}>Dashboard</Link>
      <Link to="/jobs" style={linkStyle('/jobs')}>Jobs</Link>
    </nav>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <div style={{ minHeight: '100vh', background: '#f5f5f5', fontFamily: 'system-ui, sans-serif' }}>
        <Nav />
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/jobs" element={<JobList />} />
          <Route path="/jobs/new" element={<JobEditor />} />
          <Route path="/jobs/gh-new" element={<GhDispatchEditor />} />
          <Route path="/jobs/:id" element={<JobLogs />} />
          <Route path="/jobs/:id/edit" element={<JobEditor />} />
          <Route path="/jobs/:id/gh-edit" element={<GhDispatchEditor />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}