# pfseeker Database

## Current status

Phase 13 extends the Cloudflare D1 layer with authenticated private collections, signed submissions, moderation memberships, moderation events, and publishing metadata:

- migration: `migrations/0001_initial_schema.sql`
- migration: `migrations/0002_auth_and_sessions.sql`
- migration: `migrations/0003_synced_collections.sql`
- migration: `migrations/0004_signed_submissions.sql`
- migration: `migrations/0005_optional_submission_taxonomy.sql`
- migration: `migrations/0006_moderation_and_publishing.sql`
- seed SQL generator: `scripts/seed-d1.ts`
- binding name: `DB`
- approved remote database names: `pfseeker-preview`, `pfseeker-production`

Remote provisioning is configured:

- preview: `pfseeker-preview`, `4418e176-f912-4de8-b8d2-75dd531a80e4`, region verified as `WEUR`
- production: `pfseeker-production`, `be2bcba3-2857-4c32-84f5-64010c8a23a3`, region verified as `WEUR`
- binding name in every environment: `DB`

## Schema

The content schema contains:

- `assets`
- `categories`
- `tags`
- `asset_categories`
- `asset_tags`
- `downloads`

The Phase 10 authentication schema contains:

- `users`
- `sessions`
- `oauth_states`

The Phase 11 collection schema contains:

- `collections`
- `collection_items`

The Phase 12 submission schema contains:

- `submission_upload_intents`
- `submissions`
- `submission_tags`
- `submission_suggested_tags`
- nullable `assets.content_hash`

The Phase 13 moderation and publishing schema contains:

- `moderator_memberships`
- `moderation_events`
- submission lifecycle columns for review, publication, rejection, cleanup state, and versioning
- submitted-asset metadata and archive columns on `assets`
- taxonomy actor columns on `categories` and `tags`

Collections are private by default, owned by `users`, and cascade on user deletion. Collection items reference existing assets, prevent duplicate collection/asset pairs, and store deterministic positions.

Submissions are private by default, owned by `users`, and support `pending`, `approved`, `published`, and `rejected` lifecycle states. `submissions.category_id` is nullable at intake, existing submission tags are optional at intake, and suggested tags cascade on submission deletion. Moderator publication requires real taxonomy before public asset creation. Upload intents bind a short-lived generated Cloudinary public ID to an authenticated user and asset type. The schema intentionally does not create reports, creator tables, guild-role fields, Discord token storage, password fields, public collection publishing, fake taxonomy rows, or fake administrator flags. Those belong to later phases.

## Data rules

- Store stable media references, not transformed Cloudinary URLs.
- Seed imports use `media_source_type = 'local_seed'` and local generated SVG paths.
- Production imports should use `media_source_type = 'cloudinary'` with stable Cloudinary public IDs.
- Download rows are event records. Do not seed fake download counts.
- Collection rows store names, ownership, visibility, timestamps, and ordered asset IDs only. Do not store transformed media URLs in collection rows.
- Submission rows store stable Cloudinary public IDs, verified file metadata, SHA-256 content hashes, optional taxonomy IDs, optional short metadata, and ownership. Do not store transformed Cloudinary URLs, Discord identity copies, moderation notes, or public slugs in submission rows.

## Local commands

Generate seed SQL:

```sh
npm run db:seed:sql -- --out .wrangler/tmp/pfseeker-seed.sql
```

Apply local migrations:

```sh
npm run db:migrate:local
```

Seed local D1 after migrations:

```sh
npm run db:seed:local
```

Local verification on 2026-07-05:

- migration applied successfully, then repeated with `No migrations to apply`.
- seed applied successfully, then repeated idempotently.
- local seed counts: 24 assets, 10 PFPs, 7 banners, 7 icons, 12 categories, 65 tags, 47 asset-category rows, 72 asset-tag rows.
- local seed media rows use `media_source_type = 'local_seed'` and `/seed-media/*.svg` references.

## Remote provisioning

Remote commands:

```sh
npm run db:migrate:preview
npm run db:seed:preview
npm run db:migrate:production
```

Production seed import is intentionally not scripted as a default command. Production content should be imported only after the production media source and Cloudinary ID policy are approved.

Remote verification on 2026-07-05:

- preview migration applied successfully, then repeated with `No migrations to apply`.
- preview seed applied successfully with transaction-free remote SQL, then repeated idempotently.
- preview seed counts: 24 assets, 10 PFPs, 7 banners, 7 icons, 12 categories, 65 tags, 47 asset-category rows, 72 asset-tag rows.
- preview seed media rows are development seed media, not production Cloudinary inventory.
- production migration applied successfully, then repeated with `No migrations to apply`.
- production was not seeded: 0 assets, 0 categories, 0 tags, 0 downloads, 0 `local_seed` rows.

Authentication migration verification on 2026-07-06:

- `migrations/0002_auth_and_sessions.sql` was applied locally, to preview, and to production.
- Repeat migration execution reported `No migrations to apply` in all three environments.
- Local auth tables contained 0 users, 0 sessions, and 0 OAuth state rows after controlled test cleanup.
- Preview auth tables contained 0 users, 0 sessions, and 0 OAuth state rows.
- Production auth tables contained 0 users, 0 sessions, and 0 OAuth state rows.
- Production asset/download data remained unchanged: 0 assets and 0 downloads.
- Session foreign keys cascade on user deletion, token hashes are unique, and lookup/expiry indexes exist.

Production auth runtime verification on 2026-07-08:

- Production Astro SSR deployment works on Cloudflare Pages.
- Production Discord OAuth callback works at `https://pfseeker.com/auth/discord/callback`.
- D1-backed session persistence and logout were manually verified through `/account`.
- No Discord tokens or secrets are stored in D1 by Phase 10.

Collection migration verification:

- `migrations/0003_synced_collections.sql` adds private collections and collection items.
- Applied locally, to preview, and to production on 2026-07-08.
- Repeat migration execution reported `No migrations to apply` in all three environments.
- Local collection tables started empty after migration verification.
- Preview collection tables started empty; preview retained 24 development seed assets.
- Production collection tables started empty; production retained existing auth data with 1 user and 1 session and remained intentionally unseeded with asset records.
- Foreign keys and indexes were verified through `PRAGMA foreign_key_list` and `PRAGMA index_list` locally, in preview, and in production.
- Local integrity checks confirmed deleting a collection deletes its items, deleting a user deletes owned collections and items, and invalid asset references are rejected.
- No fake production collections were seeded.

Production collection runtime verification:

- Phase 11 collection behavior was manually verified on `https://pfseeker.com`.
- Authenticated users can create multiple private D1-backed collections, rename collections, add/remove/reorder items, delete collections, and download collection ZIP files.
- Collection data persists after refresh and after sign-out/sign-in.
- Signed-out users cannot access collection management.
- No anonymous localStorage collection is created.
- Public collection publishing remains deferred.

Signed-submission migration status:

- `migrations/0004_signed_submissions.sql` adds pending submissions and upload intents without resetting existing users, sessions, collections, collection items, or assets.
- `migrations/0005_optional_submission_taxonomy.sql` makes `submissions.category_id` nullable so Phase 12 submissions can be created while production taxonomy is intentionally empty.
- Applied locally, to preview, and to production on 2026-07-09.
- Repeat migration execution reported `No migrations to apply` in all three environments.
- Local submission tables started empty: 0 submissions and 0 upload intents.
- Preview submission tables started empty: 0 submissions and 0 upload intents. Preview retained 24 development seed assets.
- Production submission tables started empty before Phase 12 runtime testing: 0 submissions and 0 upload intents. Production retained existing auth data with 1 user and remained intentionally unseeded with asset, category, and tag records.
- The migration does not seed fake submissions, fake moderator users, fake production assets, fake categories, or fake tags.
- Exact duplicate detection uses the Phase 12 submission `content_hash` and future `assets.content_hash` values. Existing production assets without stored hashes cannot be matched as exact published duplicates until their hash metadata is backfilled or they are created through the submission pipeline.
- Phase 12 production runtime verification is complete. Manual testing confirmed signed upload completion, pending submission persistence, private list and detail rendering, runtime Cloudinary previews, optional taxonomy behavior, suggested tags, owner-only cancellation, D1 and Cloudinary cleanup, inaccessible cancelled detail URLs, and no regression to private collections.

Moderation migration status:

- `migrations/0006_moderation_and_publishing.sql` is applied locally, to preview, and to production.
- Phase 13 is deployed and production-verified in solo-owner mode.
- The migration adds durable moderator memberships and append-only moderation events.
- It expands submission states to `pending`, `approved`, `published`, and `rejected`.
- It adds published asset linkage, rejection note fields, cleanup tracking, archive fields, and taxonomy actor columns.
- It does not add report tables, fake taxonomy, fake submissions, fake moderator users, or fake published assets.
- Production verification confirmed taxonomy creation/update, approval/publication, public Cloudinary media rendering, rejection, archive, duplicate bootstrap behavior, last-owner protection, signed-out moderation route protection, and solo-owner membership UI hardening.
- Production currently has one active owner membership, zero active moderator memberships, one rejected submission, one published submission linked to an archived asset, three categories, and four tags from Phase 13 verification. No cleanup of production test records has been performed yet.
- Multi-user moderator add/revoke testing is intentionally deferred by user choice.

## Cloudflare Pages binding status

Wrangler can see the existing Pages project `pfseeker`. Pages dashboard bindings were manually confirmed after Phase 9 remote provisioning:

- Preview environment binding: `DB` -> `pfseeker-preview`
- Production environment binding: `DB` -> `pfseeker-production`

Dashboard path: Cloudflare Dashboard -> Workers & Pages -> `pfseeker` -> Settings -> Functions -> D1 database bindings.

The active Cloudflare Pages deployment uses `pages_build_output_dir = "./dist/client"` and the generated Pages advanced-mode `_worker.js` to run the Astro SSR entrypoint while preserving the `DB` binding.
