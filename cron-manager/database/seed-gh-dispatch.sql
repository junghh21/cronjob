-- GitHub Actions repository_dispatch job templates (5개)
-- 적용: wrangler d1 execute cronjob --file=database/seed-gh-dispatch.sql --remote
-- PAT 교체 필요: ghp_xxxxxxxxxxxxxxxxxxxx → 실제 GitHub Personal Access Token

INSERT INTO jobs (title, url, method, headers, payload, schedule, timezone, enabled, timeout_seconds, follow_redirects, verify_ssl) VALUES

-- 1. Worker 배포 (매일 새벽 2시 KST)
(
  'GH: Deploy Worker',
  'https://api.github.com/repos/junghh21/cronjob/dispatches',
  'POST',
  '{"Authorization":"Bearer ghp_xxxxxxxxxxxxxxxxxxxx","Accept":"application/vnd.github+json","User-Agent":"cron-manager","X-GitHub-Api-Version":"2022-11-28"}',
  '{"event_type":"deploy-worker","client_payload":{"env":"production"}}',
  '0 2 * * *',
  'Asia/Seoul',
  1, 30, 1, 1
),

-- 2. Frontend 배포 (매일 새벽 3시 KST)
(
  'GH: Deploy Frontend',
  'https://api.github.com/repos/junghh21/cronjob/dispatches',
  'POST',
  '{"Authorization":"Bearer ghp_xxxxxxxxxxxxxxxxxxxx","Accept":"application/vnd.github+json","User-Agent":"cron-manager","X-GitHub-Api-Version":"2022-11-28"}',
  '{"event_type":"deploy-frontend","client_payload":{"env":"production"}}',
  '0 3 * * *',
  'Asia/Seoul',
  1, 30, 1, 1
),

-- 3. CI 테스트 실행 (매주 월요일 오전 9시 KST)
(
  'GH: Run CI Tests',
  'https://api.github.com/repos/junghh21/cronjob/dispatches',
  'POST',
  '{"Authorization":"Bearer ghp_xxxxxxxxxxxxxxxxxxxx","Accept":"application/vnd.github+json","User-Agent":"cron-manager","X-GitHub-Api-Version":"2022-11-28"}',
  '{"event_type":"run-tests","client_payload":{"suite":"full"}}',
  '0 9 * * 1',
  'Asia/Seoul',
  1, 60, 1, 1
),

-- 4. 데이터베이스 백업 (매일 새벽 1시 KST)
(
  'GH: Database Backup',
  'https://api.github.com/repos/junghh21/cronjob/dispatches',
  'POST',
  '{"Authorization":"Bearer ghp_xxxxxxxxxxxxxxxxxxxx","Accept":"application/vnd.github+json","User-Agent":"cron-manager","X-GitHub-Api-Version":"2022-11-28"}',
  '{"event_type":"db-backup","client_payload":{"target":"d1-cronjob"}}',
  '0 1 * * *',
  'Asia/Seoul',
  1, 60, 1, 1
),

-- 5. 주간 리포트 (매주 월요일 오전 8시 KST)
(
  'GH: Weekly Report',
  'https://api.github.com/repos/junghh21/cronjob/dispatches',
  'POST',
  '{"Authorization":"Bearer ghp_xxxxxxxxxxxxxxxxxxxx","Accept":"application/vnd.github+json","User-Agent":"cron-manager","X-GitHub-Api-Version":"2022-11-28"}',
  '{"event_type":"weekly-report","client_payload":{"channel":"slack"}}',
  '0 8 * * 1',
  'Asia/Seoul',
  1, 30, 1, 1
);
