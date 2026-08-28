'use client';

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { useWebSocket } from '@/lib/use-websocket';

interface RealtimeContextValue {
  connected: boolean;
  lastEvent: { event: string; data: unknown } | null;
  subscribe: (event: string, callback: (data: unknown) => void) => void;
  unsubscribe: (event: string, callback: (data: unknown) => void) => void;
}

const RealtimeContext = createContext<RealtimeContextValue | null>(null);

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const { connected, subscribe, unsubscribe } = useWebSocket();
  const [lastEvent, setLastEvent] = useState<{ event: string; data: unknown } | null>(null);

  const handleEvent = useCallback((event: string) => {
    return (data: unknown) => {
      setLastEvent({ event, data });
    };
  }, []);

  const subscribeWithTracking = useCallback(
    (event: string, callback: (data: unknown) => void) => {
      subscribe(event, handleEvent(event));
      subscribe(event, callback);
    },
    [subscribe, handleEvent]
  );

  const unsubscribeWithTracking = useCallback(
    (event: string, callback: (data: unknown) => void) => {
      unsubscribe(event, callback);
    },
    [unsubscribe]
  );

  return (
    <RealtimeContext.Provider
      value={{
        connected,
        lastEvent,
        subscribe: subscribeWithTracking,
        unsubscribe: unsubscribeWithTracking,
      }}
    >
      {children}
    </RealtimeContext.Provider>
  );
}

export function useRealtime(): RealtimeContextValue {
  const ctx = useContext(RealtimeContext);
  if (!ctx) throw new Error('useRealtime must be used within RealtimeProvider');
  return ctx;
}

export function ConnectionIndicator() {
  const { connected } = useRealtime();
  return (
    <div className="flex items-center gap-1.5 text-[11px] font-medium" title={connected ? 'Connected' : 'Disconnected'}>
      <span className={`h-2 w-2 rounded-full ${connected ? 'bg-gold-500' : 'bg-red-500'}`} />
      <span className="hidden sm:inline text-slate-500">{connected ? 'Live' : 'Offline'}</span>
    </div>
  );
}
