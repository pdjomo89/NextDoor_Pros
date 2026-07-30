# Deployments

## Production

Pushes to `main` auto-deploy to production: Vercel project `nextdoor-pros`
(team `priscille-djomos-projects`), stable alias
`https://nextdoor-pros.vercel.app`, backed by the Convex prod deployment
`resilient-ant-653`.

The production build runs

```
npx convex deploy --cmd 'npm run build'
```

which builds the frontend, pushes `convex/` to the prod deployment, and injects
`NEXT_PUBLIC_CONVEX_URL` for the build. It needs the Vercel env var
`CONVEX_DEPLOY_KEY` (Production scope, a prod deploy key from the Convex
dashboard).

`convex/_generated/` is committed on purpose — `convex deploy --cmd` runs the
build *before* its own codegen, so `_generated/` must already be present.
Commit it after schema or function changes.

## Previews

Preview builds skip `convex deploy` and run a plain `npm run build`, so
`vercel.json` branches on `VERCEL_ENV`:

```
if [ "$VERCEL_ENV" = production ]; then npx convex deploy --cmd 'npm run build'; else npm run build; fi
```

The reason is that `convex deploy` fails without a deploy key, and preview
builds have no Production-scoped env vars. Rather than mint a preview deploy
key, previews point at the shared **dev** deployment
(`marvelous-seahorse-437`) via `NEXT_PUBLIC_CONVEX_URL` at Preview scope.

Two consequences worth knowing:

- Previews read and write the dev backend's data. They are not isolated from
  each other or from local development.
- A preview only sees backend changes that have been pushed to dev, i.e. after
  `npx convex dev` has run on that branch. Frontend-only branches are unaffected.

To get isolated per-branch backends instead, generate a **preview** deploy key
in the Convex dashboard (Settings → Generate Preview Deploy Key), set it as
`CONVEX_DEPLOY_KEY` at Preview scope, drop the Preview-scoped
`NEXT_PUBLIC_CONVEX_URL` (`convex deploy` sets it per branch), and restore the
unconditional build command. Auth in previews then also needs
`JWT_PRIVATE_KEY`/`JWKS` as preview default env vars in Convex settings.

## Vercel CLI

Use v58 or newer. On v54, `vercel env add <name> preview --yes` never completes
— it loops asking for a git branch. `npx -y vercel@latest env add …` works
without touching a global install.
