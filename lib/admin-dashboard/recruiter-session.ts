'use client';

export const RECRUITER_SESSION_STORAGE_KEY = 'initium_recruiter_session_v1';

export type RecruiterAccessSession = {
  sessionId: string;
  name: string;
  email: string;
  createdAt: number;
  persistedAt?: string;
};

export function readRecruiterAccessSession(): RecruiterAccessSession | null {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.sessionStorage.getItem(RECRUITER_SESSION_STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<RecruiterAccessSession>;
    if (typeof parsed.sessionId !== 'string' || typeof parsed.name !== 'string' || typeof parsed.email !== 'string') return null;

    return {
      sessionId: parsed.sessionId.trim(),
      name: parsed.name.trim(),
      email: parsed.email.trim(),
      createdAt: typeof parsed.createdAt === 'number' ? parsed.createdAt : Date.now(),
      persistedAt: typeof parsed.persistedAt === 'string' ? parsed.persistedAt : undefined,
    };
  } catch {
    return null;
  }
}

export function writeRecruiterAccessSession(
  session: Pick<RecruiterAccessSession, 'name' | 'email'> & Partial<Pick<RecruiterAccessSession, 'sessionId' | 'createdAt' | 'persistedAt'>>
) {
  if (typeof window === 'undefined') return;

  const payload: RecruiterAccessSession = {
    sessionId: session.sessionId?.trim() || `recruiter-${crypto.randomUUID()}`,
    name: session.name.trim(),
    email: session.email.trim(),
    createdAt: typeof session.createdAt === 'number' ? session.createdAt : Date.now(),
    persistedAt: session.persistedAt,
  };

  window.sessionStorage.setItem(RECRUITER_SESSION_STORAGE_KEY, JSON.stringify(payload));
}

export function clearRecruiterAccessSession() {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(RECRUITER_SESSION_STORAGE_KEY);
}
