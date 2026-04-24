import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function proxy(request: NextRequest) {
  if (request.nextUrl.pathname !== '/') return;

  const url = request.nextUrl.clone();
  url.pathname = '/es';
  return NextResponse.redirect(url);
}

export const config = {
  matcher: '/',
};
