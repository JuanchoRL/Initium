import { NextRequest, NextResponse } from 'next/server';
import { appendTelemetryEvents } from '@/lib/server/telemetry-store';

type IncomingEvent = {
  event: string;
  ts: number;
  gameId?: string;
  payload?: Record<string, unknown>;
};

type EventsPayload = {
  sessionId?: string;
  candidate?: {
    role?: string;
    emailMasked?: string;
  } | null;
  events?: IncomingEvent[];
};

const MAX_EVENTS_PER_BATCH = 300;

const sanitizeEvents = (events: IncomingEvent[]) => {
  return events
    .filter((event) => typeof event.event === 'string' && Number.isFinite(event.ts))
    .slice(0, MAX_EVENTS_PER_BATCH)
    .map((event) => ({
      event: event.event.slice(0, 120),
      ts: event.ts,
      gameId: event.gameId?.slice(0, 40),
      payload: event.payload ?? {},
    }));
};

export async function POST(request: NextRequest) {
  let body: EventsPayload;
  try {
    body = (await request.json()) as EventsPayload;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  if (!body.sessionId || !Array.isArray(body.events)) {
    return NextResponse.json({ error: 'sessionId and events are required' }, { status: 400 });
  }

  const events = sanitizeEvents(body.events);

  if (!events.length) {
    return NextResponse.json({ ok: true, accepted: 0 });
  }

  try {
    appendTelemetryEvents({
      sessionId: body.sessionId,
      role: body.candidate?.role,
      emailMasked: body.candidate?.emailMasked,
      events,
    });
  } catch (error) {
    console.error('[events_ingest_failed]', error);
    return NextResponse.json({ error: 'Failed to persist events' }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    accepted: events.length,
  });
}
