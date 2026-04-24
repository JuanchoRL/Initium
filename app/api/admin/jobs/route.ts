import { NextRequest, NextResponse } from 'next/server';

import { createJob, updateJob } from '@/lib/server/admin-db';
import { requireAdminSession } from '@/lib/server/admin-auth';
import type { JobStatus, VacancyScoreProfileId } from '@/types/admin-dashboard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const unauthorized = requireAdminSession(request);
  if (unauthorized) return unauthorized;

  let body: {
    title?: string;
    department?: string;
    location?: string;
    owner?: string;
    scoreProfileId?: VacancyScoreProfileId;
    jobDescription?: string;
    status?: JobStatus;
  };
  try {
    body = (await request.json()) as {
      title?: string;
      department?: string;
      location?: string;
      owner?: string;
      scoreProfileId?: VacancyScoreProfileId;
      jobDescription?: string;
      status?: JobStatus;
    };
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
      jobDescription: body.jobDescription?.trim() || '',
      status: body.status,
    }),
  });
}

export async function PATCH(request: NextRequest) {
  const unauthorized = requireAdminSession(request);
  if (unauthorized) return unauthorized;

  let body: {
    id?: string;
    title?: string;
    department?: string;
    location?: string;
    owner?: string;
    scoreProfileId?: VacancyScoreProfileId;
    jobDescription?: string;
    status?: JobStatus;
  };

  try {
    body = (await request.json()) as {
      id?: string;
      title?: string;
      department?: string;
      location?: string;
      owner?: string;
      scoreProfileId?: VacancyScoreProfileId;
      jobDescription?: string;
      status?: JobStatus;
    };
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  if (!body.id?.trim()) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 });
  }

  return NextResponse.json({
    workspace: updateJob({
      id: body.id.trim(),
      title: body.title?.trim(),
      department: body.department?.trim(),
      location: body.location?.trim(),
      owner: body.owner?.trim(),
      scoreProfileId: body.scoreProfileId,
      jobDescription: typeof body.jobDescription === 'string' ? body.jobDescription : undefined,
      status: body.status,
    }),
  });
}
