import { NextRequest, NextResponse } from 'next/server';

import { createJob } from '@/lib/server/admin-db';
import type { VacancyScoreProfileId } from '@/types/admin-dashboard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  let body: { title?: string; department?: string; location?: string; owner?: string; scoreProfileId?: VacancyScoreProfileId };
  try {
    body = (await request.json()) as { title?: string; department?: string; location?: string; owner?: string; scoreProfileId?: VacancyScoreProfileId };
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  if (!body.title?.trim() || !body.department?.trim() || !body.location?.trim()) {
    return NextResponse.json({ error: 'title, department and location are required' }, { status: 400 });
  }

  return NextResponse.json({
    workspace: createJob({
      title: body.title.trim(),
      department: body.department.trim(),
      location: body.location.trim(),
      owner: body.owner?.trim() || undefined,
      scoreProfileId: body.scoreProfileId,
    }),
  });
}
