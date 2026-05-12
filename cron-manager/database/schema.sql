-- Jobs 테이블
CREATE TABLE IF NOT EXISTS jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL DEFAULT 'default',
    title TEXT NOT NULL,
    url TEXT NOT NULL,
    method TEXT NOT NULL DEFAULT 'GET',
    headers TEXT,                  -- JSON string
    payload TEXT,
    schedule TEXT NOT NULL,        -- Cron expression e.g. "*/5 * * * *"
    timezone TEXT NOT NULL DEFAULT 'UTC',
    enabled INTEGER NOT NULL DEFAULT 1,

    last_status INTEGER NOT NULL DEFAULT 0,  -- 0:미실행, 1:성공, 2:실패, 3:타임아웃, 4:HTTP에러
    last_duration_ms INTEGER,
    last_fetch INTEGER,
    last_response TEXT,

    timeout_seconds INTEGER NOT NULL DEFAULT 30,
    follow_redirects INTEGER NOT NULL DEFAULT 1,
    verify_ssl INTEGER NOT NULL DEFAULT 1,

    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Execution Logs 테이블
CREATE TABLE IF NOT EXISTS execution_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id INTEGER NOT NULL,
    status INTEGER NOT NULL,        -- 1:성공, 2:실패, 3:타임아웃, 4:HTTP에러
    status_code INTEGER,
    duration_ms INTEGER,
    response_size INTEGER,
    error_message TEXT,
    response_body TEXT,
    executed_at INTEGER NOT NULL DEFAULT (unixepoch()),

    FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE
);

-- 일별 통계 집계 테이블
CREATE TABLE IF NOT EXISTS daily_stats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id INTEGER NOT NULL,
    date TEXT NOT NULL,              -- YYYY-MM-DD
    total_runs INTEGER NOT NULL DEFAULT 0,
    success_count INTEGER NOT NULL DEFAULT 0,
    fail_count INTEGER NOT NULL DEFAULT 0,
    timeout_count INTEGER NOT NULL DEFAULT 0,
    avg_duration_ms INTEGER,

    UNIQUE(job_id, date),
    FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_jobs_enabled ON jobs(enabled);
CREATE INDEX IF NOT EXISTS idx_logs_job_id ON execution_logs(job_id);
CREATE INDEX IF NOT EXISTS idx_logs_executed_at ON execution_logs(executed_at);
CREATE INDEX IF NOT EXISTS idx_stats_job_date ON daily_stats(job_id, date);