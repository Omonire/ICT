import { Server as HttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { URL } from 'url';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';

export type WSEventType =
  | 'schedule.updated'
  | 'conflict.detected'
  | 'conflict.resolved'
  | 'attendance.marked'
  | 'candidate.rescheduled'
  | 'schedule.published';

interface AuthenticatedSocket extends WebSocket {
  userId?: string;
  isAlive?: boolean;
}

interface WSMessage {
  event: WSEventType | string;
  data?: unknown;
}

let wss: WebSocketServer | null = null;
const clients = new Map<string, Set<AuthenticatedSocket>>();

function authenticate(token: string): string | null {
  try {
    const payload = jwt.verify(token, env.jwtSecret) as { sub?: string; id?: string };
    return payload.sub ?? payload.id ?? null;
  } catch {
    return null;
  }
}

function heartbeat(this: AuthenticatedSocket) {
  this.isAlive = true;
}

function handleConnection(ws: AuthenticatedSocket, req: IncomingMessage) {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
  const token = url.searchParams.get('token');

  if (!token) {
    ws.close(4001, 'Authentication token required');
    return;
  }

  const userId = authenticate(token);
  if (!userId) {
    ws.close(4003, 'Invalid or expired token');
    return;
  }

  ws.userId = userId;
  ws.isAlive = true;

  const userClients = clients.get(userId) ?? new Set<AuthenticatedSocket>();
  userClients.add(ws);
  clients.set(userId, userClients);

  ws.on('pong', heartbeat);

  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw.toString()) as WSMessage;
      if (msg.event === 'ping') {
        ws.send(JSON.stringify({ event: 'pong', data: { timestamp: Date.now() } }));
      }
    } catch {
      // Ignore malformed messages
    }
  });

  ws.on('close', () => {
    const set = clients.get(userId);
    set?.delete(ws);
    if (set && set.size === 0) clients.delete(userId);
  });

  ws.on('error', () => {
    ws.close();
  });

  ws.send(JSON.stringify({ event: 'connected', data: { userId, timestamp: Date.now() } }));
}

export function initWebSocket(server: HttpServer): WebSocketServer {
  if (wss) return wss;

  wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', handleConnection);

  const interval = setInterval(() => {
    wss?.clients.forEach((ws) => {
      const s = ws as AuthenticatedSocket;
      if (s.isAlive === false) return s.terminate();
      s.isAlive = false;
      s.ping();
    });
  }, 30_000);

  wss.on('close', () => clearInterval(interval));

  return wss;
}

export function broadcast(event: WSEventType, data?: unknown): void {
  if (!wss) return;
  const payload = JSON.stringify({ event, data });
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  });
}

export function broadcastToUser(userId: string, event: WSEventType, data?: unknown): void {
  const userClients = clients.get(userId);
  if (!userClients) return;
  const payload = JSON.stringify({ event, data });
  for (const client of userClients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  }
}

export function getConnectedUserIds(): string[] {
  return [...clients.keys()];
}

export function isUserConnected(userId: string): boolean {
  const set = clients.get(userId);
  return !!set && set.size > 0;
}
