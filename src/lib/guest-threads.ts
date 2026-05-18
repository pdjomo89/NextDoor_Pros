/**
 * Guest customers have no account, so their conversation tokens are kept in
 * the browser's localStorage. This lets a customer return to their threads
 * from the same device without relying on the emailed private link.
 */

const KEY = 'ndp.guestThreads';
const MAX = 30;

export type GuestThreadRef = { token: string; ts: number };

/** All guest conversation tokens saved on this device, newest first. */
export function readGuestThreads(): GuestThreadRef[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const arr: unknown = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr
      .filter(
        (x): x is GuestThreadRef =>
          !!x && typeof x.token === 'string' && typeof x.ts === 'number',
      )
      .sort((a, b) => b.ts - a.ts);
  } catch {
    return [];
  }
}

/** Save (or bump) a guest conversation token on this device. */
export function rememberGuestThread(token: string): void {
  if (typeof window === 'undefined' || !token) return;
  try {
    const next = [
      { token, ts: Date.now() },
      ...readGuestThreads().filter((t) => t.token !== token),
    ].slice(0, MAX);
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // localStorage may be unavailable (private mode, disabled) — ignore.
  }
}
