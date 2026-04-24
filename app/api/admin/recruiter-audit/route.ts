import { NextRequest, NextResponse } from 'next/server';

import { getRecruiterAuditBundle, recordRecruiterActivityEvent } from '@/lib/server/admin-db';
import { requireAdminSession } from '@/lib/server/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RecruiterAuditBody = {
  sessionId?: string;
  recruiterName?: string;
  recruiterEmail?: string;
  action?: string;
  entityType?: string;
  entityId?: string;
  summary?: string;
  details?: string;
};

export async function GET(request: NextRequest) {
  const unauthorized = requireAdminSession(request);
  if (unauthorized) return unauthorized;

  return NextResponse.json({ audit: getRecruiterAuditBundle() });
}

export async function POST(request: NextRequest) {
  const unauthorized = requireAdminSession(request);
  if (unauthorized) return unauthorized;

  let body: RecruiterAuditBody;
  try {
    body = (await request.json()) as RecruiterAuditBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  if (!body.sessionId?.trim() || !body.recruiterName?.trim() || !body.recruiterEmail?.trim() || !body.action?.trim() || !body.summary?.trim()) {
    return NextResponse.json({ error: 'sessionId, recruiterName, recruiterEmail, action and summary are required' }, { status: 400 });
  }

  return NextResponse.json(
    recordRecruiterActivityEvent({
      sessionId: body.sessionId.trim(),
      recruiterName: body.recruiterName.trim(),
      recruiterEmail: body.recruiterEmail.trim(),
      action: body.action.trim(),
      entityType: body.entityType?.trim() || null,
      entityId: body.entityId?.trim() || null,
      summary: body.summary.trim(),
      details: body.details?.trim() || null,
    })
  );
}
