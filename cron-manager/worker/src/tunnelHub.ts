/**
 * TunnelHub — Durable Object that brokers raw TCP-over-WebSocket tunnels so the
 * vault9 agent can reach managed hosts (this PC, the OCI VPS) that sit behind
 * NAT / changing IPs. BOTH ends dial OUT to the hub — neither needs a public IP.
 *
 *   host  (managed target) : wss://cronjob…/tunnel?id=<hostId>&token=…&role=host
 *   agent (client side)    : wss://cronjob…/tunnel?id=<hostId>&token=…&role=client&conn=<id>
 *                            wss://cronjob…/tunnel?id=<hostId>&token=…&role=hostdata&conn=<id>
 *
 * Flow (per SSH connection):
 *   1. host keeps a 'host' control socket parked in idFromName(hostId).
 *   2. agent opens a 'client' data socket with a fresh conn id → hub tells the
 *      host control socket { type:'open', conn }.
 *   3. host opens a matching 'hostdata' socket (+ connects to its local sshd) →
 *      hub pairs client<->hostdata by conn and relays raw bytes both ways.
 *
 * Control frames (JSON text on the 'host' socket): hub->host { type:'open', conn };
 * host->hub { type:'hello' }. Data frames are raw binary, relayed verbatim.
 */
import type { Env } from './types/index.js';

type Att = { role: 'host' | 'client' | 'hostdata'; conn?: string; hostId: string; connectedAt: number };

export class TunnelHub {
  private state: DurableObjectState;
  private env: Env;
  constructor(state: DurableObjectState, env: Env) { this.state = state; this.env = env; }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if ((request.headers.get('Upgrade') || '').toLowerCase() === 'websocket') {
      const token = url.searchParams.get('token') || '';
      if (!this.env.HUB_SECRET || token !== this.env.HUB_SECRET) return new Response('unauthorized', { status: 401 });
      const role = (url.searchParams.get('role') || 'host') as Att['role'];
      const hostId = url.searchParams.get('id') || '';
      const conn = url.searchParams.get('conn') || undefined;
      if (role !== 'host' && !conn) return new Response('conn required', { status: 400 });

      const { 0: client, 1: server } = new WebSocketPair();
      this.state.acceptWebSocket(server);
      server.serializeAttachment({ role, conn, hostId, connectedAt: Date.now() } satisfies Att);

      // A client data socket: ask the host to open the matching data socket.
      if (role === 'client') {
        const ctrl = this.control();
        if (!ctrl) { try { server.close(1011, 'no host connected'); } catch { /* */ } }
        else { try { ctrl.send(JSON.stringify({ type: 'open', conn })); } catch { /* */ } }
      }
      // The host data socket just paired — tell the waiting client to start sending
      // (it buffers until now so the SSH client banner isn't dropped pre-pairing).
      if (role === 'hostdata') {
        for (const s of this.state.getWebSockets()) {
          const a = s.deserializeAttachment() as Att | null;
          if (a && a.role === 'client' && a.conn === conn) { try { s.send(JSON.stringify({ type: 'ready' })); } catch { /* */ } }
        }
      }
      return new Response(null, { status: 101, webSocket: client });
    }

    // Control RPC: status (is the host connected?).
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    if ((body.op as string) === 'status') {
      const hasHost = !!this.control();
      const conns = this.state.getWebSockets().filter((s) => (s.deserializeAttachment() as Att | null)?.role !== 'host').length;
      return Response.json({ connected: hasHost, streams: conns });
    }
    return Response.json({ error: 'unknown op' }, { status: 400 });
  }

  private control(): WebSocket | null {
    // Newest host socket wins (stale hibernated sockets can linger post-restart).
    let best: WebSocket | null = null;
    let bestT = -1;
    for (const s of this.state.getWebSockets()) {
      const a = s.deserializeAttachment() as Att | null;
      if (a?.role === 'host' && (a.connectedAt ?? 0) >= bestT) { best = s; bestT = a.connectedAt ?? 0; }
    }
    return best;
  }

  private pairOf(att: Att): WebSocket | null {
    const want = att.role === 'client' ? 'hostdata' : 'client';
    for (const s of this.state.getWebSockets()) {
      const a = s.deserializeAttachment() as Att | null;
      if (a && a.role === want && a.conn === att.conn) return s;
    }
    return null;
  }

  webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): void {
    const att = ws.deserializeAttachment() as Att | null;
    if (!att) return;
    if (att.role === 'host') return; // control socket: host->hub frames (hello) need no action
    // data socket: relay raw bytes to the paired socket
    const pair = this.pairOf(att);
    if (pair) { try { pair.send(message); } catch { /* */ } }
  }

  webSocketClose(ws: WebSocket): void {
    const att = ws.deserializeAttachment() as Att | null;
    if (att && att.role !== 'host') { const p = this.pairOf(att); if (p) { try { p.close(1000, 'peer closed'); } catch { /* */ } } }
    try { ws.close(); } catch { /* */ }
  }
  webSocketError(): void { /* dropped */ }
}

/** Route the tunnel HTTP surface from the Worker's fetch handler. */
export function handleTunnelHub(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const id = url.searchParams.get('id');
  if (!id) return Promise.resolve(new Response('id required', { status: 400 }));
  return env.TUNNEL_HUB.get(env.TUNNEL_HUB.idFromName(id)).fetch(request);
}
