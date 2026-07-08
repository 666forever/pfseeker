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
- `ASSET_PAGES.md`

## D1 environments

The required runtime binding name is `DB`.

- local Wrangler state: `DB`
- preview: `pfseeker-preview`
- production: `pfseeker-production`

Preview contains development seed media for validation. Production has the Phase 10 auth schema, Phase 11 collection schema, and Phase 12 signed-submission schema after migration `0004_signed_submissions.sql`. Production remains intentionally not seeded with development SVG records, fake collections, or fake submissions.

## Authentication

Discord sign-in is implemented with the approved client ID, `identify` scope only, D1-backed opaque sessions, and no guild, role, bot, moderation, or admin behavior. See `AUTHENTICATION.md`.

Production OAuth was manually verified on `https://pfseeker.com` on 2026-07-08. The production callback is `https://pfseeker.com/auth/discord/callback`. Arbitrary preview OAuth remains intentionally unsupported until a stable preview callback is registered.

Cloudflare Pages runs the Astro SSR deployment through the Pages advanced-mode `_worker.js` compatibility layer, with `pages_build_output_dir = "./dist/client"` and Node `24.16.0` for builds.

## Collections

Collections require Discord sign-in. Signed-in users can create multiple private D1-backed collections, save assets from gallery cards or asset detail pages, reorder and remove items, rename or delete collections, and download owner-only ZIP files. Anonymous users may browse, search, preview, and download individual assets, but cannot save assets or create collections. The former localStorage collection model is removed from production behavior and no anonymous import path is retained.

Phase 11 production verification is complete on `https://pfseeker.com`: collection creation, rename, add/remove, duplicate prevention, reorder, ZIP download, persistence after refresh and sign-out/sign-in, deletion, signed-out access protection, and signed-out Save sign-in prompting were manually verified. Public collection publishing remains deferred.

## Submissions

Phase 12 adds authenticated signed submissions on the `phase-12-signed-submissions` branch. Signed-in users can submit one PFP, banner, or icon image through direct signed Cloudinary upload. Successful submissions enter a private pending state, are owner-only, and can only be cancelled. Cancellation deletes the pending Cloudinary file and D1 submission row.

Migration `0004_signed_submissions.sql` has been applied locally, to preview, and to production. Signed-out Cloudflare preview verification passed for `/submissions`, `/submissions/new`, and protected detail-route behavior. Production runtime upload verification is still pending until this branch is reviewed, merged, and configured with Cloudinary server credentials.

Moderation, approval, rejection, public publishing, notifications, drafts, edit routes, and image replacement remain deferred to later phases. See `SUBMISSIONS.md`.
