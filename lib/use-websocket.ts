'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

type EventCallback = (data: unknown) => void;

interface UseWebSocketReturn {
  connected: boolean;
  subscribe: (event: string, callback: EventCallback) => void;
  unsubscribe: (event: string, callback: EventCallback) => void;
}

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('ws_token');
}

export function useWebSocket(path = ''): UseWebSocketReturn {
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const listenersRef = useRef<Map<string, Set<EventCallback>>>(new Map());
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attemptRef = useRef(0);
  const mountedRef = useRef(true);

  const connect = useCallback(() => {
    if (!mountedRef.current) return;
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const token = getToken();
    if (!token) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsHost = window.location.hostname + ':4000';
    const url = `${protocol}//${wsHost}${path}${path.includes('?') ? '&' : '?'}token=${token}`;

    try {
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!mountedRef.current) return;
        setConnected(true);
        attemptRef.current = 0;
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data) as { event: string; data: unknown };
          const cbs = listenersRef.current.get(msg.event);
          cbs?.forEach((cb) => cb(msg.data));
        } catch {
          // ignore malformed messages
        }
      };

      ws.onclose = () => {
        if (!mountedRef.current) return;
        setConnected(false);
        wsRef.current = null;

        if (!getToken()) return;
        const delay = Math.min(1000 * 2 ** attemptRef.current, 30000);
        attemptRef.current += 1;
        reconnectTimeoutRef.current = setTimeout(connect, delay);
      };

      ws.onerror = () => {
        ws.close();
      };
    } catch {
      if (!getToken()) return;
      const delay = Math.min(1000 * 2 ** attemptRef.current, 30000);
      attemptRef.current += 1;
      reconnectTimeoutRef.current = setTimeout(connect, delay);
    }
  }, [path]);

  useEffect(() => {
    mountedRef.current = true;
    connect();

    function onLogin() {
      attemptRef.current = 0;
      connect();
    }
    window.addEventListener('examflow:login', onLogin);

    return () => {
      mountedRef.current = false;
      window.removeEventListener('examflow:login', onLogin);
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      wsRef.current?.close();
    };
  }, [connect]);

  const subscribe = useCallback((event: string, callback: EventCallback) => {
    if (!listenersRef.current.has(event)) {
      listenersRef.current.set(event, new Set());
    }
    listenersRef.current.get(event)!.add(callback);
  }, []);

  const unsubscribe = useCallback((event: string, callback: EventCallback) => {
    listenersRef.current.get(event)?.delete(callback);
  }, []);

  return { connected, subscribe, unsubscribe };
}
