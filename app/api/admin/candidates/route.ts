import { NextRequest, NextResponse } from 'next/server';

import { createCandidate, updateCandidateProgress } from '@/lib/server/admin-db';
import type { CandidatePipelineStage, CandidateResult, CandidateStatus, VacancyRecommendation } from '@/types/admin-dashboard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  let body: CandidateResult;
  try {
    body = (await request.json()) as CandidateResult;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  if (!body.id || !body.name?.trim() || !body.email?.trim() || !body.vacancyId || !body.vacancy?.trim()) {
    return NextResponse.json({ error: 'Candidate payload is incomplete' }, { status: 400 });
  }

  try {
    return NextResponse.json({ workspace: createCandidate(body) });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create candidate';
    if (message.includes('UNIQUE constraint failed') || message.includes('constraint failed')) {
      return NextResponse.json({ error: 'Assessment already imported' }, { status: 409 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  let body: {
    id?: string;
    status?: CandidateStatus;
    pipelineStage?: CandidatePipelineStage;
    shortlistManual?: boolean;
    vacancyRecommendation?: VacancyRecommendation;
  };
  try {
    body = (await request.json()) as {
      id?: string;
      status?: CandidateStatus;
      pipelineStage?: CandidatePipelineStage;
      shortlistManual?: boolean;
      vacancyRecommendation?: VacancyRecommendation;
    };
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  if (!body.id || !body.status || !body.pipelineStage) {
    return NextResponse.json({ error: 'id, status and pipelineStage are required' }, { status: 400 });
  }

  try {
    return NextResponse.json({
      workspace: updateCandidateProgress({
        id: body.id,
        status: body.status,
        pipelineStage: body.pipelineStage,
        shortlistManual: typeof body.shortlistManual === 'boolean' ? body.shortlistManual : undefined,
        vacancyRecommendation: body.vacancyRecommendation,
        vacancyRecommendationSource: body.vacancyRecommendation ? 'manual' : undefined,
      }),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update candidate';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
