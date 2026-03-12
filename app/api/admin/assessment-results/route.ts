import { NextResponse } from 'next/server';

import { getAssessmentResults } from '@/lib/server/admin-db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({ results: getAssessmentResults() });
}
