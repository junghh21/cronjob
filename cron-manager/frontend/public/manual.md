# CronManager — Agent Manual

HTTP cron job scheduler running on Cloudflare Pages (API) + Cloudflare Workers (1-min executor). Jobs stored in D1 (SQLite).

---

## REST API

Base: `/api` · Content-Type: `application/json`

### Jobs

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/jobs` | List all jobs |
| GET | `/api/jobs/:id` | Get one job |
| POST | `/api/jobs` | Create a job |
| PATCH | `/api/jobs/:id` | Update fields |
| DELETE | `/api/jobs/:id` | Delete a job |
| POST | `/api/jobs/:id/execute` | Run immediately |

### Logs & Stats

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/logs/:job_id?page=1&pageSize=20` | Execution logs |
| GET | `/api/stats` | Global stats |
| GET | `/api/stats/:job_id` | Per-job daily stats |

### Create job body

```json
{
  "title": "Daily Ping",
  "url": "https://example.com/ping",
  "method": "POST",
  "schedule": "0 9 * * *",
  "timezone": "Asia/Seoul",
  "payload": "{\"msg\":\"hello\"}",
  "headers": { "Authorization": "Bearer token" },
  "timeout_seconds": 30,
  "enabled": true,
  "follow_redirects": true,
  "verify_ssl": true
}
```

---

## MCP Interface (`/api/mcp`)

Protocol: MCP 2024-11-05 · HTTP transport · JSON-RPC 2.0

- **Discovery:** `GET /api/mcp` — returns tool list without side effects
- **Calls:** `POST /api/mcp` with JSON-RPC body

### Handshake

```json
{ "jsonrpc": "2.0", "id": 1, "method": "initialize",
  "params": { "protocolVersion": "2024-11-05", "clientInfo": { "name": "my-agent" } } }
```

### List tools

```json
{ "jsonrpc": "2.0", "id": 2, "method": "tools/list" }
```

### Call a tool

```json
{ "jsonrpc": "2.0", "id": 3, "method": "tools/call",
  "params": {
    "name": "create_job",
    "arguments": {
      "title": "GitHub Deploy",
      "url": "https://api.github.com/repos/owner/repo/dispatches",
      "method": "POST",
      "schedule": "0 2 * * *",
      "headers": {
        "Authorization": "Bearer ghp_xxx",
        "Accept": "application/vnd.github+json",
        "User-Agent": "cron-manager"
      },
      "payload": "{\"event_type\":\"deploy-worker\"}"
    }
  }
}
```

### Available tools

| Tool | Required args | Description |
|------|--------------|-------------|
| `list_jobs` | — | List all jobs |
| `get_job` | `id` | Get one job |
| `create_job` | `title, url, schedule` | Create a job |
| `update_job` | `id` | Update any fields |
| `delete_job` | `id` | Delete a job |
| `execute_job` | `id` | Run immediately |
| `list_logs` | `job_id` | Execution history (opt: `page`, `page_size`) |
| `get_stats` | — | Global statistics |

### Claude Desktop config

```json
{
  "mcpServers": {
    "cron-manager": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "https://<your-pages-domain>/api/mcp"]
    }
  }
}
```

---

## Webhook Trigger

```
POST https://<worker-domain>/webhook
GET  https://<worker-domain>/webhook/status
```

---

## GitHub Actions (`repository_dispatch`)

Job settings to trigger a workflow:

| Field | Value |
|-------|-------|
| URL | `https://api.github.com/repos/{owner}/{repo}/dispatches` |
| Method | POST |
| Headers | `{"Authorization":"Bearer <PAT>","Accept":"application/vnd.github+json","User-Agent":"cron-manager"}` |
| Body | `{"event_type":"deploy-worker","client_payload":{}}` |

PAT scope: `repo` (classic) or Contents Read+Write (fine-grained).
The workflow file must exist on the **default branch** to receive `repository_dispatch` events.

---

## Job Field Reference

| Field | Type | Default | Notes |
|-------|------|---------|-------|
| `title` | string | — | Display name |
| `url` | string | — | Target URL |
| `method` | string | `GET` | GET POST PUT DELETE PATCH HEAD |
| `schedule` | string | — | 5-field cron expression |
| `timezone` | string | `UTC` | IANA timezone |
| `payload` | string | null | Request body; ignored for GET/HEAD |
| `headers` | object | null | Key-value HTTP headers |
| `timeout_seconds` | number | 30 | Max 300 |
| `enabled` | boolean | true | Paused when false |
| `follow_redirects` | boolean | true | |
| `verify_ssl` | boolean | true | |

---

## Execution Status Codes

| Code | Meaning |
|------|---------|
| 0 | Never run |
| 1 | Success (2xx) |
| 2 | Network / fetch error |
| 3 | Timeout |
| 4 | HTTP error (non-2xx) |
