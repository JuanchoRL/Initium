import { NextRequest, NextResponse } from 'next/server';

import { getAssessmentInviteById } from '@/lib/server/admin-db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ inviteId: string }> }) {
  const { inviteId } = await params;
  const invite = getAssessmentInviteById(inviteId);

  if (!invite) {
    return NextResponse.json({ error: 'Assessment invite not found' }, { status: 404 });
  }

  return NextResponse.json({ invite });
}
