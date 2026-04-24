import { NextRequest, NextResponse } from 'next/server';

import { createInvite } from '@/lib/server/admin-db';
import { requireAdminSession } from '@/lib/server/admin-auth';
import type { AssessmentInvite } from '@/types/admin-dashboard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const unauthorized = requireAdminSession(request);
  if (unauthorized) return unauthorized;

  let body: AssessmentInvite;
  try {
    body = (await request.json()) as AssessmentInvite;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  if (!body.id || !body.candidateName?.trim() || !body.candidateEmail?.trim() || !body.vacancyId || !body.expiresAt) {
    return NextResponse.json({ error: 'Invite payload is incomplete' }, { status: 400 });
  }

  return NextResponse.json({ workspace: createInvite(body) });
}
