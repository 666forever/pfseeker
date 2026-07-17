# .pfseeker® — Codex project package

This package contains the instructions and reference material needed for Codex to plan and build **pfseeker** from start to finish.

## Product identity

- **Visual brand:** `.pfseeker®`
- **Standard written name:** `pfseeker`
- **Meaning:** profile seeker
- **Production domain:** `https://pfseeker.com/`
- **Source control and deployment:** GitHub + Cloudflare Pages
- **Media storage and delivery:** Cloudinary

## Important starting point

The files under `reference/assessed-site/` are a captured copy of another website that was studied for product functionality and architecture. They are included only as a reference for concepts such as galleries, search, collections, creator rankings, submissions, and asset pages.

They are **not** the pfseeker codebase and must not be copied literally. Do not reuse its branding, proprietary content, analytics IDs, advertising code, OAuth configuration, API routes, or legacy frontend architecture.

## Codex entry point

Codex must read these files in order:

1. `CODEX.md`
2. `docs/PROJECT_BRIEF.md`
3. `docs/REFERENCE_ASSESSMENT.md`
4. `docs/ARCHITECTURE_TARGET.md`
5. `docs/IMPLEMENTATION_ROADMAP.md`
6. `docs/ACCEPTANCE_CRITERIA.md`
7. `INITIAL_TASK.md`

Begin with the audit and planning task in `INITIAL_TASK.md`. Do not immediately generate a generic website scaffold before completing the audit documents requested there.

## Current implementation docs

- `ARCHITECTURE.md`
- `IMPLEMENTATION_PLAN.md`
- `PROJECT_AUDIT.md`
- `MIGRATION_NOTES.md`
- `DATABASE.md`
- `SERVER_ARCHITECTURE.md`
- `AUTHENTICATION.md`
- `SEED_DATA.md`
- `SEARCH_AND_TAXONOMY.md`
- `COLLECTIONS.md`
- `SUBMISSIONS.md`
- `MODERATION.md`
- `ASSET_PAGES.md`

## D1 environments

The required runtime binding name is `DB`.

- local Wrangler state: `DB`
- preview: `pfseeker-preview`
- production: `pfseeker-production`

Preview contains development seed media for validation. Production has the Phase 10 auth schema, Phase 11 collection schema, Phase 12 signed-submission schema, and Phase 13 moderation schema after migration `0006_moderation_and_publishing.sql`. Production remains intentionally not seeded with development SVG records, fake collections, fake categories, fake tags, fake submissions, or fake moderation data.

## Authentication

Discord sign-in is implemented with the approved client ID, `identify` scope only, D1-backed opaque sessions, and no guild or bot behavior. Phase 13 moderation roles are local D1 memberships, not Discord guild roles. See `AUTHENTICATION.md` and `MODERATION.md`.

Production OAuth was manually verified on `https://pfseeker.com` on 2026-07-08. The production callback is `https://pfseeker.com/auth/discord/callback`. Arbitrary preview OAuth remains intentionally unsupported until a stable preview callback is registered.

Cloudflare Pages runs the Astro SSR deployment through the Pages advanced-mode `_worker.js` compatibility layer, with `pages_build_output_dir = "./dist/client"` and Node `24.16.0` for builds.

## Collections

Collections require Discord sign-in. Signed-in users can create multiple private D1-backed collections, save assets from gallery cards or asset detail pages, reorder and remove items, rename or delete collections, and download owner-only ZIP files. Anonymous users may browse, search, preview, and download individual assets, but cannot save assets or create collections. The former localStorage collection model is removed from production behavior and no anonymous import path is retained.

Phase 11 production verification is complete on `https://pfseeker.com`: collection creation, rename, add/remove, duplicate prevention, reorder, ZIP download, persistence after refresh and sign-out/sign-in, deletion, signed-out access protection, and signed-out Save sign-in prompting were manually verified. Public collection publishing remains deferred.

## Submissions

Phase 12 adds authenticated signed submissions. Signed-in users can submit one PFP, banner, or icon image through direct signed Cloudinary upload. Successful submissions enter a private pending state, are owner-only, and can only be cancelled. Cancellation deletes the pending Cloudinary file and D1 submission row.

Submission taxonomy is optional for Phase 12: category is optional, existing tags are 0 to 5, and suggested tags are 0 to 3. Production currently has no real category or tag taxonomy, and the application must not seed fake taxonomy or block uploads because taxonomy tables are empty. Phase 12 production runtime verification is complete: signed upload completion, pending persistence, private list and detail rendering, runtime Cloudinary previews, optional taxonomy display, suggested tags, owner-only cancellation, D1 and Cloudinary cleanup, inaccessible cancelled detail URLs, and private collection non-regression were manually verified on `https://pfseeker.com`.

Phase 13 is deployed and production-verified in solo-owner mode. It adds protected moderator/owner workflows for submission review, metadata correction, required taxonomy assignment before publication, approval/publication, rejection, archive, taxonomy management, membership management, and append-only moderation history. Production verification confirmed taxonomy creation/update, approval/publication, public Cloudinary media rendering, rejection, archive, duplicate bootstrap behavior, last-owner protection, signed-out moderation route protection, and solo-owner membership UI hardening. Production currently has one active owner membership and zero active moderator memberships. Multi-user moderator add/revoke testing is intentionally deferred by user choice. Reports remain deferred and no report tables or `/moderation/reports` route are implemented. No restore/unarchive flow, admin role, Discord guild check, or Discord bot check exists. DB-backed dedicated category routes remain deferred; D1 categories are discoverable through search filter URLs. No cleanup of production test records has been performed yet. See `MODERATION.md`.
