import { NextResponse } from 'next/server';
import { computeAiMatch } from '@/lib/ai-match';
import { updateCandidateAIMatch } from '@/lib/server/admin-db';
import { requireAdminSession } from '@/lib/server/admin-auth';
import type { CandidateResult, JobOpening } from '@/types/admin-dashboard';

export async function POST(req: Request) {
  const unauthorized = requireAdminSession(req);
  if (unauthorized) return unauthorized;

  try {
    const body = await req.json();
    const { candidate, job } = body as { candidate: CandidateResult; job: JobOpening };

    if (!candidate || !job) {
      return NextResponse.json({ error: 'Debes proveer un candidato y un puesto de trabajo.' }, { status: 400 });
    }

    // Call the generative AI wrapper
    const matchData = await computeAiMatch(candidate, job);

    // Save into database
    updateCandidateAIMatch(candidate.id, matchData.aiMatchScore, matchData.aiMatchReason);

    return NextResponse.json({ success: true, aiMatchScore: matchData.aiMatchScore, aiMatchReason: matchData.aiMatchReason });
  } catch (error: any) {
    console.error('Error generating AI Match:', error);
    return NextResponse.json({ error: error.message || 'Server error occurred' }, { status: 500 });
  }
}
