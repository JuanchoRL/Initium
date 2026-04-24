import { NextRequest, NextResponse } from 'next/server';

import { getWorkspaceBundle, updateWorkspaceSettings } from '@/lib/server/admin-db';
import { requireAdminSession } from '@/lib/server/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const unauthorized = requireAdminSession(request);
  if (unauthorized) return unauthorized;

  return NextResponse.json({ workspace: getWorkspaceBundle() });
}

export async function PATCH(request: NextRequest) {
  const unauthorized = requireAdminSession(request);
  if (unauthorized) return unauthorized;

  let body: { organizationName?: string; ownerName?: string; ownerRole?: string };
  try {
    body = (await request.json()) as { organizationName?: string; ownerName?: string; ownerRole?: string };
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  if (!body.organizationName?.trim() || !body.ownerName?.trim() || !body.ownerRole?.trim()) {
    return NextResponse.json({ error: 'organizationName, ownerName and ownerRole are required' }, { status: 400 });
  }

  return NextResponse.json({
    workspace: updateWorkspaceSettings({
      organizationName: body.organizationName.trim(),
      ownerName: body.ownerName.trim(),
      ownerRole: body.ownerRole.trim(),
    }),
  });
}
