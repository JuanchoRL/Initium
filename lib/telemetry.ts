import { useRef, useCallback, useEffect } from 'react';
import type { CandidateProfile, TelemetryEvent, GameId } from './types';
import { maskEmail } from './math';

export const createSessionId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `session-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

export function useStableSessionId() {
  const idRef = useRef<string>('');
  if (!idRef.current) {
    idRef.current = createSessionId();
  }
  return idRef.current;
}

export function useTelemetry(sessionId: string, candidate: CandidateProfile | null) {
  const queueRef = useRef<TelemetryEvent[]>([]);
  const isFlushingRef = useRef(false);

  const flush = useCallback(async () => {
    if (!queueRef.current.length || isFlushingRef.current) return;
    isFlushingRef.current = true;

    const events = queueRef.current.splice(0, queueRef.current.length);
    const body = {
      sessionId,
      candidate: candidate
        ? {
            role: candidate.role,
            emailMasked: maskEmail(candidate.email),
          }
        : null,
      events,
    };

    try {
      await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        keepalive: true,
      });
    } catch {
      queueRef.current.unshift(...events);
    } finally {
      isFlushingRef.current = false;
    }
  }, [candidate, sessionId]);

  const track = useCallback(
    (event: string, payload?: Record<string, unknown>, gameId?: GameId) => {
      queueRef.current.push({
        event,
        ts: Date.now(),
        gameId,
        payload,
      });
    },
    []
  );

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      void flush();
    }, 4000);

    const onUnload = () => {
      if (!queueRef.current.length) return;
      const events = queueRef.current.splice(0, queueRef.current.length);
      const payload = {
        sessionId,
        candidate: candidate
          ? {
              role: candidate.role,
              emailMasked: maskEmail(candidate.email),
            }
          : null,
        events,
      };

      if (navigator.sendBeacon) {
        const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
        navigator.sendBeacon('/api/events', blob);
      } else {
        fetch('/api/events', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          keepalive: true,
        }).catch(() => {});
      }
    };

    window.addEventListener('beforeunload', onUnload);
    return () => {
      clearInterval(intervalId);
      window.removeEventListener('beforeunload', onUnload);
      void flush();
    };
  }, [flush, candidate, sessionId]);

  return {
    track,
    flush,
  };
}
