import { NextRequest, NextResponse } from 'next/server';

import { requireAdminSession } from '@/lib/server/admin-auth';
import type { UpcomingInterview } from '@/types/admin-dashboard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const unauthorized = requireAdminSession(request);
  if (unauthorized) return unauthorized;

  let body: UpcomingInterview;
  try {
    body = (await request.json()) as UpcomingInterview;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  if (!body.id || !body.candidateId || !body.candidateName?.trim() || !body.vacancyId || !body.scheduledAt) {
    return NextResponse.json({ error: 'Interview payload is incomplete' }, { status: 400 });
  }

  // Mock successful interview creation
  return NextResponse.json({ workspace: { ...body } });
}
