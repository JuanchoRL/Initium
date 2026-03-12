import { NextRequest, NextResponse } from 'next/server';

import { upsertAssessmentResult } from '@/lib/server/admin-db';
import type { AssessmentImportRecord } from '@/types/admin-dashboard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  let body: AssessmentImportRecord;
  try {
    body = (await request.json()) as AssessmentImportRecord;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  if (!body.id || !body.candidateName?.trim() || !body.candidateEmail?.trim() || !body.completedAt) {
    return NextResponse.json({ error: 'Assessment result payload is incomplete' }, { status: 400 });
  }

  return NextResponse.json({ results: upsertAssessmentResult(body) });
}
