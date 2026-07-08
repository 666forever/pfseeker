# pfseeker Database

## Current status

Phase 11 extends the Cloudflare D1 layer with authenticated private collections:

- migration: `migrations/0001_initial_schema.sql`
- migration: `migrations/0002_auth_and_sessions.sql`
- migration: `migrations/0003_synced_collections.sql`
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

Collections are private by default, owned by `users`, and cascade on user deletion. Collection items reference existing assets, prevent duplicate collection/asset pairs, and store deterministic positions. The schema intentionally does not create submissions, reports, moderation events, creator tables, guild-role fields, Discord token storage, password fields, public collection publishing, or fake administrator flags. Those belong to later phases.

## Data rules

- Store stable media references, not transformed Cloudinary URLs.
- Seed imports use `media_source_type = 'local_seed'` and local generated SVG paths.
- Production imports should use `media_source_type = 'cloudinary'` with stable Cloudinary public IDs.
- Download rows are event records. Do not seed fake download counts.
- Collection rows store names, ownership, visibility, timestamps, and ordered asset IDs only. Do not store transformed media URLs in collection rows.

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

## Cloudflare Pages binding status

Wrangler can see the existing Pages project `pfseeker`. Pages dashboard bindings were manually confirmed after Phase 9 remote provisioning:

- Preview environment binding: `DB` -> `pfseeker-preview`
- Production environment binding: `DB` -> `pfseeker-production`

Dashboard path: Cloudflare Dashboard -> Workers & Pages -> `pfseeker` -> Settings -> Functions -> D1 database bindings.

The active Cloudflare Pages deployment uses `pages_build_output_dir = "./dist/client"` and the generated Pages advanced-mode `_worker.js` to run the Astro SSR entrypoint while preserving the `DB` binding.
