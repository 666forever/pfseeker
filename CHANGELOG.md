# Changelog

## Unreleased

### Added

- Initialized local Git source control on `main`.
- Added Prettier formatting support for Astro, TypeScript, CSS, JSON, Markdown, and Tailwind class ordering.
- Added centralized pfseeker design tokens.
- Added Phase 2 primitive components.
- Added `/dev/design-system` as an internal noindex component showcase.
- Added focus-helper tests for overlay keyboard behavior.
- Added interaction helpers for dialogs, drawers, dropdowns, Escape handling, and focus restoration.
- Added the Phase 3 public application shell with header, footer, desktop navigation, mobile drawer navigation, search entry forms, active-route helpers, canonical/title helpers, and scroll locking for overlays.
- Added public shell routes for `/pfps`, `/banners`, `/icons`, `/collections`, `/search`, `/about`, `/faq`, `/privacy`, and `/terms`.
- Added shell tests for route coverage, active-route matching, footer route integrity, canonical/title formatting, and search query normalization.
- Added Phase 4 Cloudinary media helpers for typed asset metadata, public ID encoding, deterministic transformations, presets, responsive descriptors, placeholders, and original-download URLs.
- Added `CLOUDINARY.md` documenting the media boundary, transform order, persisted data rules, and public/server-side Cloudinary configuration.
- Added Cloudinary unit tests for PFP, banner, icon preset behavior, animated previews, responsive images, original downloads, invalid inputs, and secret-boundary checks.
- Added Phase 5 seed data with 10 PFPs, 7 banners, 7 icons, data-driven taxonomy, validation, generated local SVG media, read-only galleries, category routes, server-rendered search, and truthful sorting.
- Added reusable gallery components for headings, category navigation, toolbar sorting, result counts, asset grids, and asset cards.
- Added `SEED_DATA.md` documenting the local seed strategy, schema, validation, taxonomy, and D1 replacement path.
- Added discovery tests for seed validation, duplicate detection, category compatibility, filtering, search, sorting, route generation, and image descriptors.
- Added Phase 6 asset detail pages for `/pfp/[slug]`, `/banner/[slug]`, and `/icon/[slug]`.
- Added route-safe gallery card navigation, detail metadata panels, breadcrumbs, related seed assets, copy-link behavior, and preview downloads.
- Added `ASSET_PAGES.md` documenting detail routes, lookup behavior, metadata, related assets, actions, and migration path.
- Added Phase 7 anonymous browser-local collections with add/remove, duplicate prevention, rename, clear confirmation, reorder, missing-ID reporting, header count sync, and collection-page management.
- Added maintained `jszip` dependency for collection ZIP generation with controlled concurrency, progress, cancellation, partial-failure reporting, and safe paths such as `pfps/slug.svg`.
- Added `COLLECTIONS.md` documenting the local storage schema, operations, user surfaces, ZIP behavior, security boundary, accessibility behavior, and tests.
- Added collection unit tests for storage validation, corrupt data recovery, operations, missing IDs, safe ZIP paths, concurrency, complete, partial, failed, empty, and cancelled download results.
- Added Phase 8 server-rendered search and taxonomy filters for text, type, category, tag, format, motion, derived orientation, color family, and truthful sorting.
- Added centralized search parsing, canonical URL serialization, active-filter links, reset URLs, color-family mapping, and taxonomy validation.
- Added `SEARCH_AND_TAXONOMY.md` documenting query parameters, defaults, canonicalization, matching semantics, filtering order, category compatibility, tags, orientation, color mapping, sorting, indexing, accessibility, and D1 migration.
- Added search tests for malformed/repeated parameters, canonical URLs, filter combinations, source immutability, color mapping, active-filter removal, reset URLs, result-count wording, and taxonomy validation.
- Added Phase 9 local D1 schema, seed SQL generator, server repository boundary, D1 repository implementation, seed fallback repository, and download-event endpoint foundation.
- Added `DATABASE.md` and `SERVER_ARCHITECTURE.md`.
- Added D1 tests for schema shape, seed SQL generation, seed repository search behavior, D1 row mapping, and download-event insert behavior.
- Configured Cloudflare D1 local, preview, and production environments with binding `DB`.
- Added Phase 10 Discord OAuth sign-in with `identify` scope only, D1-backed users, one-time OAuth states, opaque sessions, account identity page, server-rendered header auth state, POST logout, and safe auth errors.
- Added `AUTHENTICATION.md` documenting open sign-in policy, redirect URIs, D1 session architecture, cookie behavior, preview limitations, and future authorization work.
- Added auth tests for migration shape, redirect validation, Discord URL construction, user mapping, avatar URLs, token generation, hashing, and cookie attributes.
- Added Phase 12 signed pending submissions with authenticated `/submissions`, `/submissions/new`, and `/submissions/[submissionId]` routes.
- Added direct signed Cloudinary upload intents, server-side Cloudinary verification, SHA-256 content hashing, pending namespace checks, owner-only cancellation, and safe submission API responses.
- Added `SUBMISSIONS.md` documenting authenticated-only policy, accepted formats, file limits, metadata rules, content rules, upload flow, D1 schema, cancellation, quotas, duplicate behavior, privacy model, tests, and deferred moderation.
- Added submission tests for metadata validation, source URL safety, allowed formats, file limits, dimension limits, status validation, migration shape, upload namespace checks, ownership, quota enforcement, duplicate handling, upload-intent expiry/replay prevention, cancellation removal, and SVG rejection.
- Added Phase 13 protected moderation routes, moderator/owner authorization, server-side owner bootstrap, durable moderator memberships, moderation event history, taxonomy management, submission metadata correction, approval/publication, rejection, owner-only archive API, and publication cleanup handling.
- Added `MODERATION.md` documenting the Phase 13 access model, lifecycle, publication, rejection, archive, database, and deferred reports.
- Added moderation tests for migration shape, route protection, server-only bootstrap boundaries, Cloudinary publication ordering, no report routes/tables, and submitter-facing lifecycle rendering.

### Changed

- Updated `PROJECT_AUDIT.md`, `ARCHITECTURE.md`, `IMPLEMENTATION_PLAN.md`, and `MIGRATION_NOTES.md` to reflect the current Phase 3 shell state.
- Updated project documentation for the Phase 5 seed-gallery checkpoint and corrected remaining stale Phase 4 audit statements.
- Updated project documentation for the Phase 6 detail-page checkpoint.
- Updated FAQ and privacy copy to describe anonymous browser-local collections.
- Updated gallery and category pages to use the shared search pipeline without client-only filtering.
- Updated detail-page tag links to exact `/search?tag=...` filters.
- Updated gallery, category, search, and detail routes to read assets through the server repository boundary.
- Updated database scripts to use explicit Wrangler preview and production environments.
- Updated CI to use Node 22 and run formatting checks.
- Replaced deprecated `typescript-eslint` flat-config helper usage with a plain exported config array.
- Normalized active brand references to `.pfseeker®`.
- Updated FAQ, Privacy, database, server architecture, migration, audit, and implementation-plan docs for Phase 10 authentication.
- Recorded Phase 10 production verification for Cloudflare Pages SSR, Discord OAuth callback, `/account`, session persistence, and logout.
- Documented the deployed Pages advanced-mode `_worker.js` compatibility layer, `pages_build_output_dir = "./dist/client"`, and Node `24.16.0` Cloudflare build pin.
- Added Phase 11 authenticated multiple collections with private D1 collections, collection items, owner-scoped repository methods, authenticated mutation endpoints, signed-out save prompts, and collection detail management.
- Removed production use of anonymous localStorage collection behavior and documented the no-import product decision.
- Applied `0003_synced_collections.sql` locally, to preview, and to production with repeat migration checks showing no pending migrations.
- Recorded Phase 11 production verification for authenticated-only access, multiple private collections, D1-backed persistence, duplicate prevention, rename, add/remove, reorder, ZIP download, deletion, and signed-out Save sign-in prompts.
- Added `0004_signed_submissions.sql` for pending submissions, submission tags, suggested tags, upload intents, and future-compatible asset content hashes.
- Updated README, architecture, server architecture, database, migration, audit, FAQ, privacy, and terms documentation for Phase 12 pending-only submissions.
- Recorded successful signed-out Cloudflare preview verification for Phase 12 submission route protection.
- Added `0005_optional_submission_taxonomy.sql` so Phase 12 submissions can be created when production category and tag tables are empty.
- Made submission taxonomy optional: category is 0 or 1, existing tags are 0 to 5, and suggested tags are 0 to 3.
- Recorded Phase 12 production runtime verification for signed upload completion, pending persistence, private list and detail rendering, runtime Cloudinary previews, optional taxonomy behavior, suggested-tag rendering, owner-only cancellation, D1 and Cloudinary cleanup, inaccessible cancelled detail URLs, and private collection non-regression.
- Expanded submission status handling from pending-only to the Phase 13 private lifecycle: pending, approved, published, and rejected.
- Updated submitter submission list and detail pages to render lifecycle state, public published links, public rejection reasons, and pending-only cancellation.
