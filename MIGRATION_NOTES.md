# pfseeker Migration Notes

## Migration baseline

The current project is not migrating from an existing pfseeker application. It is migrating from an instruction/reference package into an original production implementation.

The directory `reference/assessed-site/` is an assessed capture of another website. It is not a pfseeker codebase.

## Non-negotiable boundary

Do not copy from the assessed reference:

- branding
- logos
- icons
- page copy
- metadata text
- category prose
- legal text
- analytics IDs
- advertising IDs or scripts
- OAuth routes or configuration
- API endpoint paths
- CSS classes as a visual system
- JavaScript architecture
- vendor files
- media URLs
- proprietary content

Reference files should remain isolated and unmodified unless the user explicitly asks to update reference documentation.

## Useful concepts to redesign

The following concepts are worth implementing independently for pfseeker:

- PFP, banner, and icon galleries.
- Category and tag discovery.
- Search with shareable URLs.
- Asset cards with preview, metadata, save, and download actions.
- Individual asset detail pages.
- Anonymous local collections.
- ZIP download for multiple assets.
- Creator profiles and leaderboards.
- Discord OAuth for identity. Completed in Phase 10 for open `identify` sign-in only.
- Submissions with moderation.
- SEO category and editorial surfaces.
- Incremental loading.

## Reference implementation lessons

Avoid these observed reference patterns:

- Runtime Tailwind CDN.
- jQuery and global app namespaces.
- Async dependency loading that can race the app script.
- Copied minified vendor files as application architecture.
- Duplicate analytics and ad initialization.
- Placeholder `href="#"` links.
- Unsanitized `innerHTML`.
- Hover-only essential controls.
- Client-composed privileged endpoint paths.
- ZIP generation that never completes after failed file downloads.
- Inline scripts that weaken CSP.
- Persisting or constructing raw media URLs without validation.

## Current missing migration inputs

The following will be needed before production content migration can happen:

- Original pfseeker brand assets.
- Cloudinary cloud name and folder/public ID conventions.
- Production media inventory or import source.
- Creator attribution rules.
- License and content ownership policy.
- Moderation policy.
- Cloudflare account/project details.
- D1 database IDs for the approved `pfseeker-preview` and `pfseeker-production` databases.
- Discord application credentials. Configured outside source control for Phase 10.
- Production analytics/privacy decision.

## Proposed migration approach

1. Build the Astro foundation with no imported reference code. Completed.
2. Establish the original design system before creating many pages. Completed.
3. Add the global public shell, honest pre-gallery routes, search entry route, and support/legal routes without fake protected workflows. Completed.
4. Build Cloudinary helpers before gallery components. Completed.
5. Add a small original seed manifest to validate pages and UI. Completed with generated local development media.
6. Build read-only public discovery. Completed for seed PFPs, banners, icons, categories, search, and sorting.
7. Add crawlable asset detail pages for every seed asset. Completed.
8. Add local collections and downloads. Completed for anonymous browser-local seed collections.
9. Expand search and taxonomy filtering. Completed for server-rendered seed-data search.
10. Introduce D1 and server behavior. Completed for Phase 9: local, preview, and production D1 bindings are configured as `DB`; preview is seeded with development seed media; production schema is migrated and intentionally unseeded.
11. Add Discord auth and D1-backed sessions. Completed for Phase 10 with open ordinary-user sign-in.
12. Add submissions, moderation, and creator surfaces in later approved phases.
13. Replace seed data with D1-backed production content through documented import scripts.

## Data migration risks

- Public IDs may change if Cloudinary folder conventions are not defined early.
- Category slugs should be stable before SEO pages are indexed.
- Asset slugs require collision handling and redirects if changed later.
- Download counts and leaderboards need clear aggregation rules.
- Anonymous collections must not be automatically trusted as authenticated data.
- Phase 7 local collections store only browser-local ordered seed asset IDs; later account sync needs explicit conflict handling and server-side validation.
- Phase 8 seed-data search defines the URL contract and filtering semantics; later D1-backed search should preserve canonicalization, category compatibility, tag normalization, and truthful sort behavior.
- Phase 9 preserves that URL contract by applying the same search/filter functions to D1 repository results while the dataset is small. If filtering moves into SQL later, it must preserve the same canonical URL and matching semantics.
- The `downloads` table stores event rows, not fake aggregate counts. Public counts and leaderboards should be derived only from real events.
- Phase 10 `users`, `sessions`, and `oauth_states` support identity and session state only. They do not include guild membership, Discord roles, bot behavior, email, passwords, synced collections, submissions, reports, or admin flags.
- Discord access tokens and refresh tokens are not stored. Only the local opaque session token hash is persisted.
- Arbitrary Cloudflare preview URLs are not registered Discord callbacks; stable preview OAuth needs its own registered redirect before it can be enabled.
- Submission metadata must be validated before publishing.

## Route migration risks

- The reference uses `pfps.gg` routes that must not leak into pfseeker.
- pfseeker canonical URLs must use `https://pfseeker.com/`.
- `www.pfseeker.com` should redirect to the canonical host.
- Placeholder routes should not be published.
- Account, submission, and admin routes should not appear as working surfaces until server-side behavior and authorization exist.
- `/account` now appears as a working authenticated identity surface only. It does not imply synced collections, uploads, creator status, moderation, or admin behavior.

## Asset migration risks

- Reference logos are prohibited.
- Reference CDN media URLs are prohibited.
- Cloudinary transformed URLs should not be stored as durable data.
- Responsive images need dimensions or aspect-ratio reservations to avoid layout shift.
- Original downloads must be controlled by validated Cloudinary public IDs.
- Phase 4 defines URL construction before galleries so routes can store stable public IDs instead of generated transformation URLs.
- Phase 5 local SVG media is development-only and must be replaced with stable Cloudinary public IDs when real inventory is available.
- Phase 6 detail routes must keep kind/slug validation when moved from seed data to D1-backed lookups.
- Phase 9 detail routes now use the repository boundary; seed media references remain development-only until real Cloudinary public IDs are imported.

## Security migration risks

- Secrets must be configured outside source control.
- Browser bundles must not expose Cloudinary API secrets, Discord secrets, session secrets, signing keys, or privileged credentials.
- Every privileged action requires server-side authorization.
- OAuth redirects need an allowlist.
- Phase 10 implements same-origin relative return-path validation and D1-backed one-time OAuth state.
- Upload signatures must be short-lived and permission-checked.

## Accessibility migration risks

- Reference hover-only controls must be redesigned.
- Drawers, dropdowns, dialogs, and lightboxes require focus management.
- Dynamic download and collection feedback requires live regions.
- Mobile and high-zoom layouts must be tested as first-class surfaces.

## Replacement strategy for the assessed website

The assessed website should remain a checklist of product capabilities and implementation pitfalls. pfseeker should replace its legacy implementation with:

- Astro pages for crawlability.
- Strict TypeScript modules.
- Compiled Tailwind.
- Original design tokens.
- Native browser APIs.
- Tested utility modules.
- Cloudinary media helpers.
- Local seed discovery helpers that migrate cleanly into D1-backed repositories.
- Cloudflare server boundaries.
- D1-backed persistence when dynamic features begin.

## Phase 9 D1 migration notes

- `migrations/0001_initial_schema.sql` creates `assets`, `categories`, `tags`, `asset_categories`, `asset_tags`, and `downloads`.
- The initial migration intentionally does not create users, sessions, collections, submissions, reports, moderation events, or creator tables. Those belong to later approved phases.
- The seed import script writes `media_source_type = 'local_seed'` and `durable_media_ref` values that point at generated local SVG routes. Production imports must switch to Cloudinary public IDs and must not persist transformed URLs.
- `POST /api/downloads` records events only when a D1 repository is available. It is not wired to the preview download link yet, so Phase 9 does not create misleading public download counts.
- `wrangler.toml` records the real Cloudflare D1 IDs returned for `pfseeker-preview` and `pfseeker-production`.

## Phase 10 authentication migration notes

- `migrations/0002_auth_and_sessions.sql` creates `users`, `sessions`, and `oauth_states`.
- Discord sign-in is open to any valid Discord account and requests only `identify`.
- No guild membership, Discord role, Discord bot, moderator, administrator, email, password, or Discord token storage was added.
- The raw session token lives only in the HTTP-only cookie; D1 stores an HMAC hash for lookup and revocation.
- The Cloudflare adapter's generated `SESSION` KV binding remains unused by pfseeker in Phase 10.
- Production OAuth was manually verified on `https://pfseeker.com` on 2026-07-08, including sign-in, callback, `/account`, refresh persistence, and logout.
- Production SSR is deployed on Cloudflare Pages through the advanced-mode `_worker.js` compatibility layer from commit `f41c81a9`; arbitrary preview OAuth remains intentionally unsupported because no arbitrary preview callback is registered.
- Phase 10 is complete. Phase 11 has not started.
