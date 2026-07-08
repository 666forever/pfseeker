# pfseeker Server Architecture

## Boundary

Server-side data access now flows through `src/server/repositories`.

- Local Astro development without a Cloudflare runtime uses the seed repository fallback.
- Cloudflare runtime with `env.DB` uses `D1ContentRepository`.
- Cloudflare runtime without `env.DB` fails instead of silently falling back.
- Local Cloudflare dev/preview with the configured Wrangler binding uses the local D1 database through `env.DB`.

Public pages should not issue raw SQL. They should use the repository boundary.

Authentication also flows through server-only modules:

- `src/server/config.ts` validates Discord and session configuration without exposing secret values.
- `src/server/repositories/auth.ts` owns user, session, and OAuth-state SQL.
- `src/server/auth/*` owns Discord OAuth, state hashing, session hashing, cookie handling, redirect validation, and current-user helpers.
- Pages and endpoints call these helpers instead of issuing raw auth SQL.

Authenticated collections flow through server-only modules:

- `src/server/repositories/collections.ts` owns collection and collection-item SQL.
- `src/server/services/collection-api.ts` centralizes authenticated repository access, same-origin mutation checks, request body validation, and JSON error responses.
- Pages and endpoints derive the owner from `requireUser`; clients never provide owner IDs.

## Current repository behavior

The D1 repository reads published assets, categories, and tags from D1 and maps rows into the same public asset shape used by seed data. Search and taxonomy filters still run through `src/lib/search.ts`, preserving Phase 8 URL behavior.

This is acceptable for the current seed-scale dataset. Later phases can push search into SQL or a dedicated search system if needed, but the URL contract and matching behavior must stay compatible.

The collection repository lists owned collections, reads one owned collection, creates, renames, deletes, adds assets, removes assets, and reorders items. Collection names are validated centrally, duplicate names are allowed, and visibility is private-only in Phase 11.

## Endpoint foundation

`POST /api/downloads` accepts JSON with:

```json
{
  "assetId": "pfp-ember-orbit",
  "source": "preview"
}
```

It records a download event when D1 is available. The preview download link is not wired to this endpoint yet, so the UI does not imply production analytics are complete.

Runtime verification on 2026-07-05 confirmed:

- valid local `POST /api/downloads` inserts a `downloads` row.
- invalid asset IDs return 404.
- malformed JSON returns 400.
- `GET /api/downloads` returns 405.
- `downloads` stores only `id`, `asset_id`, `source`, and `created_at`.

Cloudflare Pages project `pfseeker` exists. Pages dashboard bindings were manually confirmed after Phase 9 remote provisioning:

- Preview `DB` -> `pfseeker-preview`
- Production `DB` -> `pfseeker-production`

Cloudflare Pages SSR deployment is verified in production. Commit `f41c81a9` adds the Pages advanced-mode `_worker.js` compatibility layer, `pages_build_output_dir = "./dist/client"`, and the Node `24.16.0` build pin. The production deployment was merged through commit `1374e1a` on `main` and manually verified on `https://pfseeker.com`.

## Authentication routes

Phase 10 adds:

- `GET /auth/discord`
- `GET /auth/discord/callback`
- `POST /auth/logout`
- `/auth/error`
- `/account`

The account page is protected and marked `noindex`. Public shell rendering asks the server for an optional current user so the header is rendered in the correct signed-in or signed-out state without a client-side flash.

Sessions are opaque D1 sessions. The browser receives only an HTTP-only `pfseeker_session` token; D1 stores only the HMAC hash. Discord access tokens are used only during the callback exchange and are not stored.

The installed Cloudflare adapter can still mention a generated `SESSION` KV binding during builds. pfseeker does not use that KV binding in Phase 10; D1 is the session store.

Arbitrary Pages preview URLs are not registered Discord callbacks. Local OAuth uses localhost, and production OAuth uses `https://pfseeker.com/auth/discord/callback`.

Production OAuth was manually verified on 2026-07-08: sign-in opens Discord identity access, callback completes, `/account` renders for the authenticated user, refresh preserves the session, and POST logout returns the user to signed-out state. Arbitrary preview OAuth remains intentionally unsupported until a stable preview callback is registered.

## Collection routes

Phase 11 adds authenticated private collection behavior:

- `/collections` requires sign-in and lists the current user's collections.
- `/collections/[collectionId]` requires sign-in and returns 404 for missing or non-owned collections.
- `/api/collections` lists and creates owned collections.
- `/api/collections/[collectionId]` renames or deletes an owned collection.
- `/api/collections/[collectionId]/items/[assetId]` adds or removes an existing asset.
- `/api/collections/[collectionId]/reorder` persists a complete ordered asset ID list.

JSON/API mutations return `401` when signed out. HTML collection routes redirect to `/auth/discord` with a safe return path. Mutation endpoints validate content type, body size, Origin/Referer, names, asset existence, and ownership before writing. Public collection publishing is deferred.

Production collection verification was completed manually on `https://pfseeker.com`: signed-out users are blocked and prompted to sign in from Save, authenticated users can create multiple private collections, save an asset into more than one collection, avoid duplicate saves, rename, reorder, remove items, download ZIPs, persist collection data across refresh and sign-out/sign-in, and delete collections. No anonymous localStorage collection is created.

## Security notes

- No secrets are read by browser code.
- No user identity, IP address, or user agent is stored in Phase 9 download events.
- Phase 10 auth secrets remain server-only, OAuth state is single-use, session tokens are stored as hashes in D1, redirects are allowlisted, and logout revokes server-side state.
- Phase 11 collection mutations require active sessions, validate same-origin Origin/Referer, and enforce server-side ownership.
- Future authenticated and abuse-prone endpoints need rate limiting and broader Phase 16 hardening.
