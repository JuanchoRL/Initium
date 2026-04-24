import fs from 'node:fs';
import path from 'node:path';

type StoredEvent = {
  sessionId: string;
  role: string;
  emailMasked: string;
  event: string;
  ts: number;
  gameId?: string;
  payload: Record<string, unknown>;
  receivedAt: string;
};

const EVENTS_PATH = path.join(process.cwd(), 'data', 'assessment-events.jsonl');
const MAX_PAYLOAD_KEYS = 30;
const MAX_STRING_LENGTH = 500;

function sanitizePayload(payload: Record<string, unknown>) {
  const next: Record<string, unknown> = {};
  Object.entries(payload)
    .slice(0, MAX_PAYLOAD_KEYS)
    .forEach(([key, value]) => {
      if (typeof value === 'string') {
        next[key.slice(0, 80)] = value.slice(0, MAX_STRING_LENGTH);
        return;
      }
      if (typeof value === 'number' || typeof value === 'boolean' || value == null) {
        next[key.slice(0, 80)] = value;
        return;
      }
      next[key.slice(0, 80)] = JSON.stringify(value).slice(0, MAX_STRING_LENGTH);
    });
  return next;
}

export function appendTelemetryEvents(input: {
  sessionId: string;
  role?: string;
  emailMasked?: string;
  events: Array<{
    event: string;
    ts: number;
    gameId?: string;
    payload?: Record<string, unknown>;
  }>;
}) {
  fs.mkdirSync(path.dirname(EVENTS_PATH), { recursive: true });
  const receivedAt = new Date().toISOString();
  const rows: StoredEvent[] = input.events.map((event) => ({
    sessionId: input.sessionId,
    role: input.role || 'n/a',
    emailMasked: input.emailMasked || 'masked',
    event: event.event,
    ts: event.ts,
    gameId: event.gameId,
    payload: sanitizePayload(event.payload ?? {}),
    receivedAt,
  }));

  fs.appendFileSync(EVENTS_PATH, rows.map((row) => JSON.stringify(row)).join('\n') + '\n');
}
