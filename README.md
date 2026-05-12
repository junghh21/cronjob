# cronjob
아래는 cron-job.org 오픈소스를 참고하여, Cloudflare Pages(React+Vite+_worker.js) + Cloudflare Worker(Cron Trigger) 조합으로 주기적 크론잡을 CRUD하는 프로젝트를 작성할 에이전트에게 줄 상세 프롬프트입니다.
프롬프트: Cloudflare 기반 크론잡 관리 시스템 (Cron-Job.org 스타일)
프로젝트 개요
cron-job.org 오픈소스의 아키텍처를 참고하여, Cloudflare Pages(프론트엔드) + Cloudflare Worker(Cron Trigger + API) 조합으로 주기적 HTTP 크론잡을 CRUD 관리하는 풀스택 시스템을 구축하라.
plain
Copy
참고 아키텍처 (cron-job.org):
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Frontend  │────▶│  API (PHP)  │────▶│  chronos    │
│  (React)    │     │  (REST)     │     │  (C++ Cron) │
└─────────────┘     └─────────────┘     └─────────────┘
                           │
                    ┌──────┴──────┐
                    │  MySQL/Redis│
                    └─────────────┘

우리의 아키텍처:
┌─────────────┐     ┌─────────────────┐     ┌─────────────┐
│   Frontend  │────▶│  _worker.js     │────▶│  Worker     │
│  (React+Vite) │     │  (Pages Functions)│    │  (Cron Trig)│
└─────────────┘     └─────────────────┘     └─────────────┘
                           │                        │
                    ┌──────┴──────┐          ┌─────┴─────┐
                    │  D1 (SQLite) │          │  KV (캐시) │
                    └─────────────┘          └───────────┘
디렉토리 구조
plain
Copy
cron-manager/
├── frontend/                    # Cloudflare Pages (React + Vite)
│   ├── src/
│   │   ├── components/
│   │   │   ├── JobList.tsx      # 크론잡 목록 (활성/비활성 상태 뱃지)
│   │   │   ├── JobEditor.tsx    # 크론잡 생성/수정 폼
│   │   │   ├── JobLogs.tsx      # 실행 로그 + 통계 차트
│   │   │   ├── Dashboard.tsx    # 대시보드 (성공/실패 통계)
│   │   │   └── StatusBadge.tsx  # SVG 상태 뱃지 (cron-job.org 스타일)
│   │   ├── hooks/
│   │   │   ├── useJobs.ts       # SWR 기반 잡 관리
│   │   │   └── useStats.ts      # 통계 데이터
│   │   ├── types/
│   │   │   └── cronjob.ts       # TypeScript 인터페이스
│   │   ├── utils/
│   │   │   └── api.ts           # API 클라이언트
│   │   └── App.tsx
│   ├── functions/                # Pages Functions (_worker.js)
│   │   └── api/
│   │       ├── [[path]].ts      # API 라우터 (cron-job.org의 index.php 역할)
│   │       ├── jobs/
│   │       │   ├── index.ts     # GET/POST /api/jobs
│   │       │   └── [id].ts      # GET/PATCH/DELETE /api/jobs/:id
│   │       ├── logs/
│   │       │   └── [id].ts      # GET /api/logs/:jobId
│   │       ├── stats/
│   │       │   └── index.ts     # GET /api/stats
│   │       └── execute/
│   │           └── index.ts     # POST /api/execute (수동 실행)
│   ├── _worker.js               # Pages Functions 엔트리포인트
│   ├── wrangler.toml            # Pages 설정
│   └── vite.config.ts
│
├── worker/                       # 독립 Cloudflare Worker (Cron Trigger 전용)
│   ├── src/
│   │   ├── index.ts             # Worker 엔트리 (fetch + scheduled 핸들러)
│   │   ├── cron/
│   │   │   ├── executor.ts      # 실제 HTTP 요청 실행 (curl 역할)
│   │   │   ├── scheduler.ts     # D1 조회 → 예약된 잡 선별
│   │   │   └── logger.ts        # 실행 결과 로깅
│   │   ├── lib/
│   │   │   ├── d1.ts            # D1 데이터베이스 유틸
│   │   │   ├── kv.ts            # KV 캐시/통계 유틸
│   │   │   └── http.ts          # HTTP 요청 유틸 (fetch 기반 curl)
│   │   └── types/
│   │       └── index.ts
│   ├── wrangler.toml            # Worker 설정 + Cron Triggers
│   └── package.json
│
├── shared/                       # 프론트/워커 공용 타입/유틸
│   └── types/
│       └── cronjob.ts
│
├── database/
│   ├── schema.sql               # D1 스키마 (cron-job.org DB 참고)
│   └── migrations/
│
└── README.md
핵심 요구사항
1. 데이터 모델 (D1 SQLite) - cron-job.org 참고
sql
Copy
-- Jobs 테이블 (cron-job.org의 job 테이블 대응)
CREATE TABLE jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,           -- 향후 멀티유저 대비
    title TEXT NOT NULL,
    url TEXT NOT NULL,
    method TEXT DEFAULT 'GET',     -- GET, POST, PUT, DELETE, PATCH
    headers TEXT,                  -- JSON 문자열
    payload TEXT,                  -- 요청 바디
    schedule TEXT NOT NULL,        -- Cron 표현식 (e.g., "*/5 * * * *")
    timezone TEXT DEFAULT 'UTC',
    enabled INTEGER DEFAULT 1,
    
    -- 상태 추적 (cron-job.org 스타일)
    last_status INTEGER DEFAULT 0,  -- 0:미실행, 1:성공, 2:실패, 3:타임아웃, 4:HTTP에러
    last_duration_ms INTEGER,       -- 응답 시간
    last_fetch INTEGER,            -- 마지막 실행 타임스탬프
    last_response TEXT,            -- 마지막 응답 (요약)
    
    -- 설정
    timeout_seconds INTEGER DEFAULT 30,
    follow_redirects INTEGER DEFAULT 1,
    verify_ssl INTEGER DEFAULT 1,
    
    -- 메타
    created_at INTEGER DEFAULT (unixepoch()),
    updated_at INTEGER DEFAULT (unixepoch())
);

-- Execution Logs 테이블 (cron-job.org의 SQLite per-day 로그 대응)
-- KV에 일별 저장 + D1에 요약 저장 (하이브리드)
CREATE TABLE execution_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id INTEGER NOT NULL,
    status INTEGER NOT NULL,       -- 1:성공, 2:실패, 3:타임아웃, 4:HTTP에러
    status_code INTEGER,           -- HTTP 상태 코드
    duration_ms INTEGER,
    response_size INTEGER,
    error_message TEXT,
    executed_at INTEGER DEFAULT (unixepoch()),
    
    FOREIGN KEY (job_id) REFERENCES jobs(id)
);

-- 통계 집계 (cron-job.org의 통계 대응)
CREATE TABLE daily_stats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id INTEGER NOT NULL,
    date TEXT NOT NULL,              -- YYYY-MM-DD
    total_runs INTEGER DEFAULT 0,
    success_count INTEGER DEFAULT 0,
    fail_count INTEGER DEFAULT 0,
    timeout_count INTEGER DEFAULT 0,
    avg_duration_ms INTEGER,
    
    UNIQUE(job_id, date)
);
2. Worker Cron Trigger 설정 (wrangler.toml)
toml
Copy
name = "cron-executor"
main = "src/index.ts"
compatibility_date = "2024-01-01"

# 1분마다 실행 (cron-job.org의 "매분 체크" 대응)
[[triggers]]
crons = ["* * * * *"]

# D1 바인딩
[[d1_databases]]
binding = "DB"
database_name = "cron-manager-db"
database_id = "<your-db-id>"

# KV 바인딩 (캐시 + 로그 버퍼)
[[kv_namespaces]]
binding = "CACHE"
id = "<your-kv-id>"

# 로그 상세 저장용 R2 (선택)
[[r2_buckets]]
binding = "LOGS"
bucket_name = "cron-logs"
3. Worker 핵심 로직 (src/index.ts)
TypeScript
Copy
// fetch 핸들러: 수동 실행/상태 확인 API
// scheduled 핸들러: 1분마다 실행되는 Cron Trigger

export interface Env {
  DB: D1Database;
  CACHE: KVNamespace;
  LOGS?: R2Bucket;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // Pages Functions와 통신하는 내부 API (선택적)
    return new Response('Worker OK');
  },

  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    // 1. D1에서 enabled=1인 잡 조회
    // 2. 각 잡의 schedule(cron expr)이 현재 시간과 매칭되는지 확인
    // 3. 매칭된 잡들을 병렬 fetch 실행 (Promise.allSettled)
    // 4. 결과를 D1 logs + KV 캐시 + 통계 업데이트
    
    const scheduler = new CronScheduler(env.DB);
    const executor = new JobExecutor(env);
    
    const dueJobs = await scheduler.getDueJobs();
    
    const executions = dueJobs.map(job => 
      executor.execute(job).catch(err => ({ jobId: job.id, error: err.message }))
    );
    
    await Promise.allSettled(executions);
  }
};
4. HTTP Executor (curl 대체)
TypeScript
Copy
// worker/src/lib/http.ts
// cron-job.org의 curl multi + libev 대응 (간소화)

export async function executeHttpJob(job: CronJob): Promise<ExecutionResult> {
  const startTime = Date.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), job.timeout_seconds * 1000);
  
  try {
    const response = await fetch(job.url, {
      method: job.method,
      headers: parseHeaders(job.headers),
      body: job.payload || undefined,
      redirect: job.follow_redirects ? 'follow' : 'manual',
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    const duration = Date.now() - startTime;
    const body = await response.text();
    
    return {
      status: response.ok ? 1 : 4,  // 1:성공, 4:HTTP에러
      statusCode: response.status,
      durationMs: duration,
      responseSize: body.length,
      response: body.substring(0, 10000), // 10KB 제한
    };
    
  } catch (error) {
    clearTimeout(timeoutId);
    const isTimeout = error.name === 'AbortError';
    
    return {
      status: isTimeout ? 3 : 2,  // 3:타임아웃, 2:실패
      durationMs: Date.now() - startTime,
      errorMessage: error.message,
    };
  }
}
5. Pages Functions API (frontend/functions/api/...)
cron-job.org의 PHP API를 TypeScript로 포팅:
Table
엔드포인트	메서드	설명	인증
/api/jobs	GET	잡 목록 (폴더/필터 지원)	JWT
/api/jobs	POST	새 잡 생성	JWT
/api/jobs/:id	GET	잡 상세	JWT
/api/jobs/:id	PATCH	잡 수정	JWT
/api/jobs/:id	DELETE	잡 삭제	JWT
/api/jobs/:id/execute	POST	수동 즉시 실행	JWT
/api/logs/:jobId	GET	실행 로그 (페이지네이션)	JWT
/api/stats	GET	대시보드 통계	JWT
/api/stats/:jobId	GET	잡별 상세 통계	JWT
/jobs/:id/:token/status.svg	GET	공개 상태 뱃지 (SVG)	토큰
6. 프론트엔드 컴포넌트 (React)
tsx
Copy
// JobEditor.tsx - cron-job.org 스타일의 상세 설정 폼
interface JobFormData {
  title: string;
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers: Record<string, string>;
  payload: string;
  schedule: string;        // Cron 표현식
  timezone: string;
  timeout: number;
  enabled: boolean;
}

// SchedulePicker: 분/시/일/월/요일 시각적 선택기
// HeaderEditor: 키-값 편집기
// PayloadEditor: JSON/Plain 텍스트 에디터 (문법 강조)
7. 상태 뱃지 (SVG) - cron-job.org 스타일
tsx
Copy
// StatusBadge.tsx - 외부 임베드용 SVG
// URL: /jobs/:id/:token/status.svg?withTitle=1&withLatency=1

export function generateStatusBadge(job: Job, options: BadgeOptions): string {
  const colors = {
    success: ['#4caf50', '#2e7d32'],
    error: ['#ef5350', '#d32f2f'],
    warn: ['#ff9800', '#ed6c02'],
    unknown: ['#03a9f4', '#0288d1'],
  };
  
  // SVG 생성 (cron-job.org의 GetJobStatusBadge 참고)
  return `<svg>...</svg>`;
}
cron-job.org에서 차용할 설계 패턴
Table
cron-job.org 기능	우리 구현
분 단위 스케줄링	Worker Cron Trigger (1분) + cron-parser 라이브러리
curl multi + libev	Cloudflare Worker의 native fetch (병렬 Promise.allSettled)
SQLite per-day 로그	KV에 일별 로그 버퍼 + D1 집계 테이블
Thrift 노드 통신	불필요 (Worker가 직접 실행)
SVG 상태 뱃지	Pages Functions에서 동적 SVG 생성
이메일 알림	(향후) Resend/Email Workers 연동
멀티 노드	(향후) 여러 Worker 배포 + D1 글로벌 복제
기술 스택 및 의존성
JSON
Copy
// worker/package.json
{
  "dependencies": {
    "cron-parser": "^4.9.0",      // Cron 표현식 파싱/매칭
    "zod": "^3.22.0"              // 스키마 검증
  }
}

// frontend/package.json
{
  "dependencies": {
    "react": "^18.2.0",
    "react-router-dom": "^6.20.0",
    "swr": "^2.2.0",               // 데이터 페칭
    "recharts": "^2.10.0",         // 통계 차트
    "cronstrue": "^2.32.0",        // Cron 표현식 → 자연어
    "date-fns": "^2.30.0",
    "zod": "^3.22.0"
  }
}
구현 우선순위
Phase 1: D1 스키마 + Worker Cron Trigger (1분 실행 + HTTP fetch + 로깅)
Phase 2: Pages Functions API (잡 CRUD + 로그 조회)
Phase 3: React 프론트엔드 (대시보드 + 잡 에디터)
Phase 4: SVG 상태 뱃지 + 공유 기능
Phase 5: 통계 집계 + 알림 (이메일/웹훅)
참고: cron-job.org 핵심 코드 스니펫
php
Copy
// api/apimethods/GetJobStatusBadge.php 참고
// - Redis 캐싱 (우리는 KV 사용)
// - imagettfbbox로 SVG 너비 계산 (우리는 고정 폰트 + 추정)
// - 상태별 색상 매핑 그대로 차용

// chronos의 개념 참고
// - "매분 D1 조회 → 실행 대상 선별 → 병렬 fetch → 결과 저장"
// - "성능 > 데이터 무결성" (로그는 휘발성 허용)
이 프롬프트를 에이전트에게 전달하면, cron-job.org의 검증된 아키텍처를 Cloudflare 생태계에 맞게 재구현한 크론잡 관리 시스템을 구축할 수 있습니다.