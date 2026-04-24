import { NextResponse } from 'next/server';
import { rankPipelineWithAi } from '@/lib/ai-match';
import { updateCandidateAIMatch } from '@/lib/server/admin-db';
import { requireAdminSession } from '@/lib/server/admin-auth';
import type { CandidateResult, JobOpening } from '@/types/admin-dashboard';

export async function POST(req: Request) {
  const unauthorized = requireAdminSession(req);
  if (unauthorized) return unauthorized;

  try {
    const body = await req.json();
    const { candidates, job } = body as { candidates: CandidateResult[]; job: JobOpening };

    if (!candidates || !job || !Array.isArray(candidates)) {
      return NextResponse.json({ error: 'Payload inválido' }, { status: 400 });
    }

    // Pass candidates to Gemini in bulk
    const rankResults = await rankPipelineWithAi(candidates, job);

    // Save results to DB
    for (const result of rankResults) {
      updateCandidateAIMatch(result.candidateId, result.aiMatchScore, result.aiMatchReason);
    }

    return NextResponse.json({ success: true, rankResults });
  } catch (error: any) {
    console.error('Error rankeando pipeline:', error);
    return NextResponse.json(
      { error: error.message || 'Error del servidor al evaluar pipeline' },
      { status: 500 }
    );
  }
}
