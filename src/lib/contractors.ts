import { fetchQuery } from 'convex/nextjs';
import { convexAuthNextjsToken } from '@convex-dev/auth/nextjs/server';
import { api } from '../../convex/_generated/api';
import { getConvexEnv } from '@/lib/convex-env';

export async function getViewer() {
  if (!getConvexEnv().configured) return null;
  try {
    const token = await convexAuthNextjsToken();
    if (!token) return null;
    return await fetchQuery(api.contractors.viewer, {}, { token });
  } catch {
    return null;
  }
}

export async function getMyContractor() {
  if (!getConvexEnv().configured) return null;
  try {
    const token = await convexAuthNextjsToken();
    if (!token) return null;
    return await fetchQuery(api.contractors.getMine, {}, { token });
  } catch {
    return null;
  }
}
