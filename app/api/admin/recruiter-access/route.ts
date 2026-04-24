import { NextRequest, NextResponse } from 'next/server';

import { endRecruiterAccessSession, startRecruiterAccessSession } from '@/lib/server/admin-db';
import { requireAdminSession } from '@/lib/server/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RecruiterAccessBody = {
  action?: 'login' | 'logout';
  sessionId?: string;
  name?: string;
  email?: string;
};

export async function POST(request: NextRequest) {
  let body: RecruiterAccessBody;
  try {
    body = (await request.json()) as RecruiterAccessBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  if (!body.action || !body.name?.trim() || !body.email?.trim()) {
    return NextResponse.json({ error: 'action, name and email are required' }, { status: 400 });
  }

  const userAgent = request.headers.get('user-agent');

  if (body.action === 'login') {
    const session = startRecruiterAccessSession({
      sessionId: body.sessionId?.trim() || undefined,
      name: body.name.trim(),
      email: body.email.trim(),
      userAgent,
    });
    return NextResponse.json({ session });
  }

  if (!body.sessionId?.trim()) {
    return NextResponse.json({ error: 'sessionId is required for logout' }, { status: 400 });
  }

  const unauthorized = requireAdminSession(request);
  if (unauthorized) return unauthorized;

  return NextResponse.json(
    endRecruiterAccessSession({
      sessionId: body.sessionId.trim(),
      name: body.name.trim(),
      email: body.email.trim(),
      userAgent,
    })
  );
}
