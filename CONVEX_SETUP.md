# Convex setup

NextDoor Pros uses [Convex](https://convex.dev) as its database, server
functions, and auth provider. You'll need a free Convex account (no credit
card required).

## 1. Provision your Convex deployment

In the project root, run:

```bash
npx convex dev
```

The first run will:

1. Open a browser to sign you into Convex.
2. Ask which project to use — pick **Create new project**, name it
   `nextdoor-pros` (or anything you like).
3. Generate `convex/_generated/` (typed client) — these files are not
   checked into git on purpose; they're rebuilt by `convex dev`.
4. Write `NEXT_PUBLIC_CONVEX_URL` and `CONVEX_DEPLOYMENT` into `.env.local`
   automatically.
5. Push the schema in `convex/schema.ts` to your deployment, creating the
   `contractors` table plus the auth tables (`users`, `authSessions`, etc).

Leave this command running in one terminal while you work — it watches
`convex/` and live-deploys changes.

## 2. Run the Next.js dev server

In a **second terminal**:

```bash
npm run dev
```

Open the forwarded URL. Both EN and FR routes are live:

- `/en/auth/sign-up` — create an account (email + password, 8+ chars)
- `/en/pros/onboard` — fill in your business listing
- `/en/services/<slug>` — public listings, filtered by selected city

## 3. (Optional) Configure SITE_URL for production

`SITE_URL` controls where sign-in callbacks redirect. For local dev,
the default origin works; in production set it to your domain.

## Architecture

- **Database & functions**: `convex/`
  - `schema.ts` — table definitions
  - `contractors.ts` — `viewer`, `getMine`, `listByService`, `upsertMine` (queries + mutations)
  - `auth.ts` — Convex Auth with the Password provider
  - `http.ts` — exposes the auth HTTP routes
- **Next.js integration**:
  - `src/middleware.ts` — `convexAuthNextjsMiddleware` composed with `next-intl`
  - `src/components/convex-provider.tsx` — `ConvexAuthNextjsProvider` wrapping the app
  - Server components read auth state with `isAuthenticatedNextjs()` and
    fetch data with `fetchQuery(api.x.y, args, { token })`.
  - Client components use `useQuery` and `useMutation` from `convex/react` —
    fully reactive (saving a listing makes it appear in `/services/<slug>`
    for every viewer instantly, no manual refetch).

## Row-level security

Convex enforces auth checks inside the function body, not via SQL policies.
- `contractors.viewer` and `contractors.getMine` return `null` for anon users.
- `contractors.listByService` is anon-readable but only returns
  `published: true` rows.
- `contractors.upsertMine` reads `getAuthUserId(ctx)` and writes only the
  row whose `ownerId` matches — so even if a client crafted a different
  `ownerId`, it would be ignored.

## Swapping the auth method later

In `convex/auth.ts`:

```ts
import { Password } from '@convex-dev/auth/providers/Password';
// becomes
import { Resend } from '@convex-dev/auth/providers/Resend';
import { Google } from '@auth/core/providers/google';
```

…and add the provider to the `providers: []` array. No schema changes —
Convex Auth tables stay the same.
