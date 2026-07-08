# pfseeker Database

## Current status

Phase 10 extends the Cloudflare D1 layer with authentication tables:

- migration: `migrations/0001_initial_schema.sql`
- migration: `migrations/0002_auth_and_sessions.sql`
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

It intentionally does not create synced collections, submissions, reports, moderation events, creator tables, guild-role fields, Discord token storage, password fields, or fake administrator flags. Those belong to later phases.

## Data rules

- Store stable media references, not transformed Cloudinary URLs.
- Seed imports use `media_source_type = 'local_seed'` and local generated SVG paths.
- Production imports should use `media_source_type = 'cloudinary'` with stable Cloudinary public IDs.
- Download rows are event records. Do not seed fake download counts.

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

## Cloudflare Pages binding status

Wrangler can see the existing Pages project `pfseeker`. Pages dashboard bindings were manually confirmed after Phase 9 remote provisioning:

- Preview environment binding: `DB` -> `pfseeker-preview`
- Production environment binding: `DB` -> `pfseeker-production`

Dashboard path: Cloudflare Dashboard -> Workers & Pages -> `pfseeker` -> Settings -> Functions -> D1 database bindings.

The active Cloudflare Pages deployment uses `pages_build_output_dir = "./dist/client"` and the generated Pages advanced-mode `_worker.js` to run the Astro SSR entrypoint while preserving the `DB` binding.
