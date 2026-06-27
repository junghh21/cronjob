/**
 * ShellHub — Durable Object + WebSocket hub for the vault9 HF reverse shell,
 * hosted inside the cronjob Worker. An HF Space agent dials OUT to
 *   wss://cronjob.junghh21.workers.dev/connect?id=<spaceId>&token=<HUB_SECRET>
 * and the socket is parked (Hibernation API) in the DO instance idFromName(spaceId).
 * Callers (vault9 Pages via the SHELL_HUB binding, or the guarded /rpc) send a
 * one-shot exec; the DO relays it over the socket and returns the result.
 *
 * Frames (JSON text):
 *   hub -> agent : { type:'exec', reqId, cmd, timeout }
 *   agent -> hub : { type:'result', reqId, stdout, stderr, code }   (also { type:'hello' })
 */
import type { Env } from './types/index.js';

export class ShellHub {
  private state: DurableObjectState;
  private env: Env;
  private pending = new Map<string, (payload: unknown) => void>();

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request: Request): Promise<Response> {
    // Agent connecting over WebSocket.
    if ((request.headers.get('Upgrade') || '').toLowerCase() === 'websocket') {
      const token = new URL(request.url).searchParams.get('token') || '';
      if (!this.env.HUB_SECRET || token !== this.env.HUB_SECRET) {
        return new Response('unauthorized', { status: 401 });
      }
      const { 0: client, 1: server } = new WebSocketPair();
      this.state.acceptWebSocket(server);
      server.serializeAttachment({ connectedAt: Date.now() });
      return new Response(null, { status: 101, webSocket: client });
    }

    // Control request (exec / status).
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const op = (body.op as string) || 'status';
    const sockets = this.state.getWebSockets();

    if (op === 'status') {
      const att = (sockets[0]?.deserializeAttachment?.() as { connectedAt?: number } | null) || null;
      return Response.json({ connected: sockets.length > 0, sockets: sockets.length, since: att?.connectedAt ?? null });
    }

    if (op === 'exec') {
      const cmd = body.cmd as string;
      if (!cmd) return Response.json({ ok: false, error: 'cmd required' }, { status: 400 });
      if (!sockets.length) return Response.json({ ok: false, error: 'no agent connected' }, { status: 503 });
      // Prefer the most recently connected socket — after a Space rebuild, stale
      // hibernated sockets can linger and `sockets[0]` may be dead.
      const ws = sockets.slice().sort((a, b) => {
        const ta = (a.deserializeAttachment() as { connectedAt?: number } | null)?.connectedAt ?? 0;
        const tb = (b.deserializeAttachment() as { connectedAt?: number } | null)?.connectedAt ?? 0;
        return tb - ta;
      })[0];
      const timeout = Math.min(Math.max(Number(body.timeout) || 60, 1), 300);
      const reqId = crypto.randomUUID();
      const result = await new Promise<unknown>((resolve) => {
        const timer = setTimeout(() => {
          this.pending.delete(reqId);
          resolve({ ok: false, error: 'timeout', timedOut: true });
        }, timeout * 1000 + 2000);
        this.pending.set(reqId, (payload) => { clearTimeout(timer); resolve(payload); });
        try {
          ws.send(JSON.stringify({ type: 'exec', reqId, cmd, timeout }));
        } catch (e) {
          clearTimeout(timer);
          this.pending.delete(reqId);
          resolve({ ok: false, error: 'send failed: ' + (e as Error).message });
        }
      });
      return Response.json(result as Record<string, unknown>);
    }

    return Response.json({ error: `unknown op '${op}'` }, { status: 400 });
  }

  webSocketMessage(_ws: WebSocket, message: string | ArrayBuffer): void {
    let msg: { type?: string; reqId?: string };
    try { msg = JSON.parse(typeof message === 'string' ? message : new TextDecoder().decode(message)); }
    catch { return; }
    if (msg.type === 'result' && msg.reqId) {
      const resolve = this.pending.get(msg.reqId);
      if (resolve) { this.pending.delete(msg.reqId); resolve({ ok: true, ...msg }); }
    }
  }

  webSocketClose(ws: WebSocket): void { try { ws.close(); } catch { /* already closed */ } }
  webSocketError(): void { /* socket dropped; pending execs time out */ }
}

/** Route the reverse-shell HTTP surface from the Worker's fetch handler. */
export function handleShellHub(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  if (url.pathname === '/connect') {
    const id = url.searchParams.get('id');
    if (!id) return Promise.resolve(new Response('id required', { status: 400 }));
    return env.SHELL_HUB.get(env.SHELL_HUB.idFromName(id)).fetch(request);
  }
  // Guarded control RPC (testing / direct use). vault9 normally uses the binding.
  if (url.pathname === '/rpc' && request.method === 'POST') {
    if (!env.HUB_SECRET || request.headers.get('x-hub-secret') !== env.HUB_SECRET) {
      return Promise.resolve(new Response('unauthorized', { status: 401 }));
    }
    return rpcRoute(request, env);
  }
  return Promise.resolve(new Response('not found', { status: 404 }));
}

async function rpcRoute(request: Request, env: Env): Promise<Response> {
  const body = (await request.json().catch(() => ({}))) as { id?: string };
  if (!body.id) return Response.json({ error: 'id required' }, { status: 400 });
  const doReq = new Request('https://do/control', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return env.SHELL_HUB.get(env.SHELL_HUB.idFromName(body.id)).fetch(doReq);
}
