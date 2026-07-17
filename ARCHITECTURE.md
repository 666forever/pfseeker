# pfseeker Architecture

## Current status

The project has completed the audit, engineering foundation, design primitives, global public shell, Cloudinary media abstraction, seed galleries, asset detail pages, expanded search, D1 server layer, Phase 10 Discord authentication, Phase 11 authenticated private collections, Phase 12 signed pending submissions, and Phase 13 moderation. Current status: Phase 13 is deployed and production-verified in solo-owner mode.

Phase 10 adds open Discord sign-in with `identify` scope only, D1-backed users, one-time OAuth state records, opaque sessions, POST logout, protected `/account`, server-rendered header auth state, and safe auth errors. Production OAuth and logout were manually verified on `https://pfseeker.com` on 2026-07-08. Phase 11 requires sign-in for collection features, stores multiple private collections in D1, and removes anonymous local collection persistence. Production collection creation, rename, add/remove, reorder, ZIP download, persistence, deletion, and access protection were manually verified on `https://pfseeker.com`. Phase 12 adds authenticated signed submissions into a private pending state. Migrations `0004_signed_submissions.sql` and `0005_optional_submission_taxonomy.sql` support the submission schema; signed-out route protection and production runtime upload behavior have been manually verified. Production verification confirmed signed upload completion, pending persistence, private list and detail rendering, runtime Cloudinary previews, optional taxonomy behavior, suggested tags, owner-only cancellation, D1 and Cloudinary cleanup, inaccessible cancelled detail URLs, and no regression to private collections.

Phase 13 adds server-side moderator and owner authorization, server-only owner bootstrap by Discord ID allowlist, durable moderator memberships, moderation events, metadata correction, approval/publication, rejection, taxonomy management, and owner-only archive. Migration `0006_moderation_and_publishing.sql` is applied in production. Production verification confirmed taxonomy creation/update, approval/publication, public Cloudinary media rendering, rejection, archive, duplicate bootstrap behavior, last-owner protection, signed-out moderation route protection, and solo-owner membership UI hardening. Production currently has one active owner membership and zero active moderator memberships. Multi-user moderator add/revoke testing is intentionally deferred by user choice. Ordinary users remain the default account type. There is no `admin` role, no Discord guild check, and no Discord bot check. Public collection publishing, reports, creators, and leaderboards remain future work.

## Product identity

- Public product name: `pfseeker`
- Expressive brand mark: `.pfseeker®`.
- Production domain: `https://pfseeker.com/`

The visual system must be original. The reference website is functional inspiration only.

## Platform choices

Frontend:

- Astro for crawlable pages and minimal client JavaScript.
- TypeScript with strict mode.
- Compiled Tailwind CSS.
- Native browser APIs.
- Hydrated islands only for interactions that need client state.

Deployment:

- GitHub as source of truth once the repository is initialized.
- Cloudflare Pages for frontend deployment.
- Cloudflare Pages Functions or Workers for secure server-side behavior.
- Cloudflare D1 for relational dynamic data.
- Cloudinary for media storage, transformations, delivery, and original downloads.

## Repository layout

Target layout:

```text
.
├── .github/workflows/
├── docs/
├── functions/
├── migrations/
├── public/
├── scripts/
├── src/
│   ├── components/
│   ├── content/
│   ├── data/
│   ├── layouts/
│   ├── lib/
│   ├── pages/
│   ├── styles/
│   └── types/
├── tests/
├── astro.config.mjs
├── package.json
├── postcss.config.mjs
├── tailwind.config.mjs
├── tsconfig.json
└── wrangler.toml
```

The `reference/` directory remains read-only reference material.

## Rendering model

Public discovery pages should be statically or server-rendered through Astro so primary content is available without client-side rendering.

Client JavaScript is reserved for:

- search/filter refinement where progressive enhancement is useful
- lightboxes
- authenticated collection picker and detail controls implemented by `src/scripts/collection-client.ts`
- ZIP progress and cancellation implemented through `src/lib/collection-zip.ts`
- dialogs/drawers/dropdowns
- authenticated account workflows

Essential controls must remain available without hover-only disclosure.

## Data model direction

Phase 5 uses typed local seed data under `src/data/` to validate public discovery before persistence. Phase 9 introduces a D1-compatible content repository and local seed fallback. Public gallery, category, search, and detail routes now ask `src/server/repositories` for asset data instead of importing seed lookups directly. The current D1 schema covers:

- assets
- categories
- tags
- asset_categories
- asset_tags
- downloads

Persist stable Cloudinary public IDs and metadata. Do not persist transformed Cloudinary URLs.

Seed records intentionally store durable local development media references and metadata only. They exclude fake creator accounts, download counts, rankings, and user IDs.

Authenticated collection state is stored in D1 through `collections` and `collection_items`. Collection ownership is derived from the active session, not client input. Collection names are private, duplicate names are allowed, and item order is stored as normalized integer positions. The former anonymous `pfseeker.collection.v1` browser storage model is no longer used in production code and no import path is retained.

Search and taxonomy filtering is centralized in `src/lib/search.ts`. It parses URL parameters, canonicalizes filter URLs, applies deterministic server-side filtering, derives orientation from dimensions, maps palette metadata to restrained color families, and validates taxonomy assumptions for the current seed dataset.

The D1 repository currently loads published rows and applies the same search/filter functions in application code. This preserves Phase 8 URL and matching behavior while the dataset is small. Later production-scale search can push filtering into indexed SQL or a dedicated search service if profiling shows that is needed.

Authenticated users, sessions, OAuth state, private collections, collection items, submissions, optional submission category links, optional submission tags, suggested submission tags, upload intents, moderator memberships, and moderation events now exist. Reports, public collection publishing, and creator attribution remain future schema additions. Do not add placeholder creator rows, fake report rows, fake roles, fake moderation events, fake taxonomy rows, or fake download counts.

## Cloudinary boundary

All Cloudinary URL construction belongs in `src/lib/media.ts`. It supports:

- stable public ID validation and encoding
- deterministic transformation ordering
- responsive `srcset`
- width and DPR variants
- automatic format and quality
- PFP crops
- banner aspect ratios
- icon previews
- animated assets
- original download URLs
- blurred preview placeholders

Cloudinary API secrets stay server-side. Browser uploads require short-lived signed parameters created by authorized server code.

## Cloudflare boundary

Cloudflare config is centralized in `wrangler.toml` and Astro's Cloudflare adapter.

The required D1 binding name is `DB`. `wrangler.toml` maps local state and `env.preview` to `pfseeker-preview` (`4418e176-f912-4de8-b8d2-75dd531a80e4`) and `env.production` to `pfseeker-production` (`be2bcba3-2857-4c32-84f5-64010c8a23a3`). Both remote databases were verified in `WEUR`.

Current note: the installed Cloudflare adapter auto-enables a `SESSION` KV binding. That default remains visible in build output, but Phase 10 explicitly uses D1-backed opaque sessions instead of that KV binding.

Cloudflare Pages SSR is deployed with the Pages advanced-mode compatibility layer from commit `f41c81a9`: `npm run build` prepares `dist/client/_worker.js`, the root Wrangler file sets `pages_build_output_dir = "./dist/client"`, and Cloudflare builds use Node `24.16.0`. This keeps D1-backed SSR on Pages rather than converting the app to a static site.

Server-side behavior should live in Pages Functions or Worker-compatible modules for:

- Discord OAuth. Implemented for open `identify` sign-in.
- sessions. Implemented as D1-backed opaque sessions.
- signed Cloudinary uploads
- submissions
- moderation
- reports
- protected account/admin actions
- download event recording

Every privileged route must authorize server-side on every request.

## Environment configuration

Known environment variables from `.env.example`:

- `PUBLIC_SITE_URL`
- `PUBLIC_CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`
- `DISCORD_CLIENT_ID`
- `DISCORD_CLIENT_SECRET`
- `DISCORD_REDIRECT_URI`
- `SESSION_SECRET`
- `MODERATOR_BOOTSTRAP_DISCORD_IDS`

Phase 1 should add typed validation for required public configuration and document required server secrets without exposing them to browser code.

## Route architecture

Public routes:

- `/` implemented
- `/pfps` implemented as seed gallery
- `/pfps/[category]` implemented
- `/pfp/[slug]` implemented for seed assets
- `/banners` implemented as seed gallery
- `/banners/[category]` implemented
- `/banner/[slug]` implemented for seed assets
- `/icons` implemented as seed gallery
- `/icons/[category]` implemented
- `/icon/[slug]` implemented for seed assets
- `/collections` implemented as authenticated private collection management
- `/collections/[collectionId]` implemented as authenticated private collection detail
- `/collection/[slug]`
- `/creators`
- `/creator/[slug-or-id]`
- `/search` implemented as noindex seed-data search and filter route
- `/api/downloads` implemented as a JSON POST endpoint foundation for D1-backed download events
- `/auth/discord` implemented
- `/auth/discord/callback` implemented
- `/auth/logout` implemented as POST-only
- `/auth/error` implemented
- `/account` implemented as an authenticated identity page
- `/about` implemented

Dedicated category routes such as `/pfps/[category]`, `/banners/[category]`,
and `/icons/[category]` currently resolve the committed seed/static taxonomy.
D1-created moderation categories are discoverable through search filter URLs
such as `/search?type=pfp&category=phase-13-test`; DB-backed dedicated category
routes are deferred to a later discovery/SEO pass.

- `/faq` implemented
- `/privacy` implemented
- `/terms` implemented

Moderation routes now exist as protected server-backed Phase 13 routes: `/moderation`, `/moderation/submissions`, `/moderation/submissions/[submissionId]`, `/moderation/taxonomy`, `/moderation/history`, and `/moderation/members`. There is no `/moderation/reports` route. Submission routes show private lifecycle state to the owner, and the current account route shows truthful Discord identity and local session information only.

## Styling architecture

Use compiled Tailwind with global design tokens defined in `src/styles/global.css` and Tailwind theme extensions.

Phase 2 centralizes the active token system in `src/styles/global.css` using semantic custom properties for surfaces, text, borders, accents, semantic state colors, typography, spacing, radii, shadows, focus rings, motion, overlays, and breakpoints. Reusable primitives live in `src/components/`, with shared interaction behavior in `src/scripts/primitives.ts`.

Phase 3 adds the public shell through `SiteHeader`, `SiteFooter`, and `SiteSearch`, with route metadata in `src/lib/shell.ts`. The public shell owns primary navigation, search entry, footer links, mobile drawer activation, active-route state, canonical URLs, and title formatting. Phase 10 replaces the disabled account entry with server-rendered Discord sign-in/account state.

Design priorities:

- dark
- precise
- curated
- premium
- image-first
- editorial
- restrained
- intentional

Avoid the reference site's exact visual system and avoid generic dashboard templates.

## Testing architecture

Foundation scripts should include:

- `npm run build`
- `npm run preview`
- `npm run lint`
- `npm run typecheck`
- `npm run test`

Later phases add Playwright E2E coverage for public routes, overlays, galleries, collections, downloads, auth, submissions, moderation, mobile navigation, and keyboard behavior.

Current unit coverage includes collection naming validation, reorder payload validation, migration shape checks, repository ownership checks, duplicate prevention, add/remove/reorder behavior, invalid asset rejection, ZIP filename generation, controlled concurrency, partial failure, all-failure, empty, cancellation behavior, search query normalization, canonical filter serialization, type/category compatibility, tag matching, color mapping, orientation derivation, combined filters, sort behavior, active-filter URLs, result-count wording, taxonomy validation, optional submission taxonomy validation, upload-intent namespace checks, submission quotas, duplicate submission handling, owner-only pending submission access, upload-intent expiry/replay prevention, and SVG rejection.

Phase 9 unit coverage adds D1 migration-shape checks, seed SQL generation checks, seed repository search parity, D1 row mapping, and download-event insert behavior through a fake D1 boundary.

## Security architecture

Required baseline:

- no committed secrets
- environment validation
- no unsanitized HTML insertion
- safe redirects
- server-side authorization for privileged routes
- upload validation and signing
- CSRF protection where applicable
- secure cookies for auth
- security headers
- rate limiting for abuse-prone endpoints

## Accessibility architecture

Required baseline:

- semantic landmarks and headings
- skip link
- visible focus states
- keyboard navigation
- reduced-motion handling
- accessible form labels
- live regions for dynamic feedback
- dialogs/drawers with Escape handling, focus trap, and focus restoration

## Performance architecture

Required baseline:

- compiled CSS
- no jQuery
- no runtime Tailwind
- no duplicate third-party scripts
- minimal hydration
- responsive image helpers
- stable aspect-ratio reservations
- lazy noncritical media
- crawlable public content
