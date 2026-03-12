import { NextRequest, NextResponse } from 'next/server';

import { createInterview } from '@/lib/server/admin-db';
import type { UpcomingInterview } from '@/types/admin-dashboard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  let body: UpcomingInterview;
  try {
    body = (await request.json()) as UpcomingInterview;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  if (!body.id || !body.candidateId || !body.candidateName?.trim() || !body.vacancyId || !body.scheduledAt) {
    return NextResponse.json({ error: 'Interview payload is incomplete' }, { status: 400 });
  }

  return NextResponse.json({ workspace: createInterview(body) });
}
