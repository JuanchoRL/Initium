import { NextRequest, NextResponse } from 'next/server';

import { getAssessmentResults } from '@/lib/server/admin-db';
import { requireAdminSession } from '@/lib/server/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const unauthorized = requireAdminSession(request);
  if (unauthorized) return unauthorized;

  return NextResponse.json({ results: getAssessmentResults() });
}
