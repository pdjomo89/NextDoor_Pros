import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { fetchQuery } from 'convex/nextjs';
import { convexAuthNextjsToken } from '@convex-dev/auth/nextjs/server';
import { api } from '../../convex/_generated/api';
import { getConvexEnv } from '@/lib/convex-env';

type ProAccess = {
  signedIn: boolean;
  required: boolean;
  blocked: boolean;
  country: string | null;
  status: string | null;
};

/**
 * Whether the signed-in pro may open the pro area. In subscription markets the
 * membership must be active — meaning they completed Stripe Checkout and a card
 * is on file — before onboarding or the dashboard will render. The decision is
 * made in Convex from the session token; geo-IP is only a hint for a pro who has
 * neither a listing nor a membership yet (someone who abandoned checkout).
 */
export async function getProAccess(): Promise<ProAccess | null> {
  if (!getConvexEnv().configured) return null;
  try {
    const token = await convexAuthNextjsToken();
    if (!token) return null;
    const geoCountry = headers().get('x-vercel-ip-country') ?? undefined;
    return (await fetchQuery(
      api.memberships.proAccess,
      { geoCountry },
      { token },
    )) as ProAccess;
  } catch {
    // Never trade a transient backend error for a redirect loop — the mutations
    // behind the pro area enforce the same rule server-side regardless.
    return null;
  }
}

/**
 * Send a pro without an active membership to the membership hub instead of
 * rendering the page they asked for. `?status=required` tells that page why.
 */
export async function requireProMembership(locale: string): Promise<void> {
  const access = await getProAccess();
  if (!access?.blocked) return;
  const query = new URLSearchParams({ role: 'pro', status: 'required' });
  if (access.country) query.set('country', access.country);
  redirect(`/${locale}/membership?${query.toString()}`);
}
