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

Authenticated submissions flow through server-only modules:

- `src/server/repositories/submissions.ts` owns upload-intent, quota, duplicate, pending-submission, optional taxonomy-relation, owner-read, and owner-delete SQL.
- `src/server/services/submission-api.ts` centralizes authenticated repository access, same-origin mutation checks, JSON body validation, and safe error responses.
- `src/server/services/cloudinary.ts` owns Cloudinary signing, Admin API verification, SHA-256 content hashing, pending namespace checks, and deletion.
- Pages and endpoints derive the owner from `requireUser`; clients never provide owner IDs or arbitrary Cloudinary folders.

## Current repository behavior

The D1 repository reads published assets, categories, and tags from D1 and maps rows into the same public asset shape used by seed data. Search and taxonomy filters still run through `src/lib/search.ts`, preserving Phase 8 URL behavior.

This is acceptable for the current seed-scale dataset. Later phases can push search into SQL or a dedicated search system if needed, but the URL contract and matching behavior must stay compatible.

The collection repository lists owned collections, reads one owned collection, creates, renames, deletes, adds assets, removes assets, and reorders items. Collection names are validated centrally, duplicate names are allowed, and visibility is private-only in Phase 11.

The submission repository lists owned pending submissions, reads one owned pending submission, creates short-lived upload intents, completes verified Cloudinary uploads as `pending`, enforces quotas, checks exact duplicates by content hash, marks pending duplicates from other users, accepts optional category and 0 to 5 existing tags, and deletes owned pending submissions after Cloudinary cleanup. Phase 12 has no approval, rejection, edit, replacement, restore, or public-publishing path.

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

## Submission routes

Phase 12 adds authenticated pending submissions:

- `/submissions` requires sign-in and lists the current user's pending submissions newest first.
- `/submissions/new` requires sign-in and renders the single-page submission form.
- `/submissions/[submissionId]` requires sign-in and returns 404 for missing or non-owned submissions.
- `POST /api/submissions/upload-intent` creates a short-lived signed Cloudinary upload intent.
- `POST /api/submissions/complete` verifies the Cloudinary upload, validates metadata and quotas, and creates the D1 `pending` row.
- `DELETE /api/submissions/[submissionId]` cancels an owned pending submission after deleting its Cloudinary resource.

HTML routes redirect signed-out users to Discord sign-in with a safe return path. Mutation endpoints require active sessions, JSON request bodies where applicable, same-origin Origin/Referer, server-side validation for any provided taxonomy, server-side ownership, and safe JSON errors. Pending submissions are marked `noindex` and are not exposed through public gallery routes. Category is optional, existing tags are optional from 0 to 5, and suggested tags are optional from 0 to 3.

Signed-out Cloudflare preview verification was completed on the Phase 12 preview: `/submissions` and `/submissions/new` show the Discord sign-in flow, `/submissions/[submissionId]` is protected by the same authenticated flow, and the preview hostname no longer returns a Cloudflare 404. Arbitrary preview OAuth completion remains intentionally untested because Discord callback configuration is production-only.

## Security notes

- No secrets are read by browser code.
- No user identity, IP address, or user agent is stored in Phase 9 download events.
- Phase 10 auth secrets remain server-only, OAuth state is single-use, session tokens are stored as hashes in D1, redirects are allowlisted, and logout revokes server-side state.
- Phase 11 collection mutations require active sessions, validate same-origin Origin/Referer, and enforce server-side ownership.
- Phase 12 submission mutations require active sessions, validate same-origin Origin/Referer, enforce owner-only reads/deletes, use short-lived signed Cloudinary upload intents, verify uploaded Cloudinary resources server-side, compute SHA-256 content hashes from verified bytes, and keep Cloudinary secrets out of browser code.
- Future authenticated and abuse-prone endpoints need rate limiting and broader Phase 16 hardening.
