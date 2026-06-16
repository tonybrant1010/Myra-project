import { NextResponse } from 'next/server';

export function middleware(request) {
  if (request.nextUrl.pathname.startsWith('/api/')) {
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('X-Myra-Proxy-Secret', process.env.MYRA_PROXY_SECRET || '');

    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  }
}
