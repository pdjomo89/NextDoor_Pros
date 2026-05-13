import createIntlMiddleware from 'next-intl/middleware';
import { convexAuthNextjsMiddleware } from '@convex-dev/auth/nextjs/server';
import type { NextRequest } from 'next/server';
import { routing } from './i18n/routing';

const intlMiddleware = createIntlMiddleware(routing);

export default convexAuthNextjsMiddleware(async (request: NextRequest) => {
  return intlMiddleware(request);
});

export const config = {
  matcher: [
    // next-intl: run on every path except API routes, Next internals, and static files.
    '/((?!api|_next|_vercel|.*\\..*).*)',
    // @convex-dev/auth: the middleware must handle POST /api/auth so it can proxy
    // the auth:signIn / auth:signOut actions to Convex and set the session cookies.
    '/api/auth',
  ],
};
