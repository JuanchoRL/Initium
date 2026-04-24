import { NextResponse, type NextRequest } from 'next/server';
import { isRecruiterSessionActive } from '@/lib/server/admin-db';

export function requireAdminSession(request: NextRequest | Request) {
  const sessionId = request.headers.get('x-initium-recruiter-session')?.trim() || '';
  const email = request.headers.get('x-initium-recruiter-email')?.trim() || '';

  if (!sessionId || !isRecruiterSessionActive(sessionId, email)) {
    return NextResponse.json({ error: 'Recruiter session required' }, { status: 401 });
  }

  return null;
}
