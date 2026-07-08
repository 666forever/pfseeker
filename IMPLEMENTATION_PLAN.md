# pfseeker Implementation Plan

This plan refines `docs/IMPLEMENTATION_ROADMAP.md` against the audited repository state. Each phase must end in a testable checkpoint and update documentation before moving on.

## Phase 0: Audit and Architecture

Goal: Establish the current repository baseline and implementation direction.

Status: Complete when `PROJECT_AUDIT.md`, `ARCHITECTURE.md`, `IMPLEMENTATION_PLAN.md`, and `MIGRATION_NOTES.md` exist and record validation results.

Dependencies: Existing instruction and planning documents.

Completion criteria:

- Entire workspace inspected.
- Reference material assessed as non-production.
- Git, Cloudflare, Cloudinary, dependencies, source folders, and tests recorded.
- Safe validation commands run or marked not applicable with exact failure reasons.

## Phase 1: Engineering Foundation

Goal: Create the smallest production-ready application foundation.

Dependencies: Phase 0.

Status: Started and foundation checkpoint complete.

Work:

- Add `package.json` and lockfile.
- Add Astro with strict TypeScript.
- Add compiled Tailwind and PostCSS.
- Add Cloudflare adapter and `wrangler.toml`.
- Add base layout, global CSS, homepage, 404 page, and 500 page.
- Add initial environment/config helper.
- Add lint, typecheck, test, build, preview scripts.
- Add focused unit test for foundation utilities.
- Add CI workflow skeleton for install, lint, typecheck, test, and build.

Completion criteria:

- `npm install` succeeds. Completed.
- `npm run build` succeeds. Completed.
- `npm run lint` succeeds. Completed.
- `npm run typecheck` succeeds. Completed with one non-failing TypeScript deprecation hint in ESLint config usage.
- `npm run test` succeeds. Completed.
- `npm run dev` starts and serves `/` successfully. Completed.
- `npm run preview` starts and serves `/` successfully. Completed.
- No reference code or assets are imported. Completed.

Remaining Phase 1 follow-up:

- Add a formatter if the team wants formatting enforcement separate from ESLint. A formatting check is already configured in CI.

Resolved later:

- Phase 10 chose D1-backed opaque sessions and does not use the Cloudflare adapter's auto-provisioned `SESSION` KV binding.

## Phase 2: Design Tokens and Primitives

Goal: Establish pfseeker's original visual language and reusable UI primitives.

Dependencies: Phase 1.

Status: Complete.

Work:

- Define color, typography, spacing, border, radius, shadow, motion, and focus tokens.
- Build buttons, icon buttons, inputs, selects, checkboxes, badges, cards, skeletons, empty states, dialogs, drawers, dropdowns, tooltips, and toasts.
- Verify mobile, keyboard, high zoom, and reduced motion behavior.

Completion criteria:

- Component examples render in real pages or a documented internal route. Implemented at `/dev/design-system`.
- Keyboard and focus behavior manually verified. Completed for dialog, drawer, dropdown, Escape handling, focus entry, focus trap, focus restoration, mobile layout, noindex metadata, and reduced-motion CSS.
- Lint, typecheck, tests, and build pass. Completed.

## Phase 3: Global Application Shell

Goal: Implement the shared public shell.

Dependencies: Phase 2.

Status: Complete.

Work:

- Header, navigation, search entry, mobile drawer, collection entry point, account entry point, footer, skip link.
- Legal/support routes: `/about`, `/faq`, `/privacy`, `/terms`.
- Accessible overlay behavior.

Completion criteria:

- All shell controls have real routes, implemented behavior, or are disabled until backing behavior exists. Completed.
- No `href="#"`. Completed.
- Mobile and desktop layouts verified. Completed against local preview with browser checks.
- Lint, typecheck, tests, and build pass. Completed.

## Phase 4: Cloudinary Media Abstraction

Goal: Centralize media modeling and URL generation before gallery work.

Dependencies: Phases 1 and 3.

Status: Complete.

Work:

- Define asset/media types.
- Implement Cloudinary URL builder.
- Support responsive variants, crops, DPR, format/quality, placeholders, and original download URLs.
- Add tests for URL generation.

Completion criteria:

- Unit tests cover representative PFP, banner, icon preset behavior, animated, responsive, placeholder, invalid-input, and original-download URLs. Completed.
- No Cloudinary secrets exposed to browser bundles. Completed.
- Build and typecheck pass. Completed.

## Phase 5: Seed Content and Read-only Galleries

Goal: Build crawlable public gallery surfaces with local seed data until D1 is introduced.

Dependencies: Phases 2, 3, and 4.

Status: Complete.

Work:

- Add a small original seed asset manifest using clearly documented generated local development media. Completed.
- Build `/pfps`, `/banners`, `/icons`, category pages, search results, and reusable gallery components. Completed.
- Include truthful sorting URL state, category filtering, result counts, empty states, and server-rendered gallery HTML. Completed.

Completion criteria:

- Public gallery pages are crawlable without client rendering. Completed.
- Cards are keyboard accessible and do not link to missing Phase 6 detail routes. Completed.
- Responsive images use stable dimensions. Completed.
- Lint, typecheck, tests, build, and selected manual checks pass. Completed.

## Phase 6: Asset Detail Pages

Goal: Add crawlable individual asset pages.

Dependencies: Phase 5.

Status: Complete.

Work:

- `/pfp/[slug]`, `/banner/[slug]`, `/icon/[slug]`. Completed.
- Large preview, durable metadata, tags, category links, copy link, preview download, and related assets. Completed.
- Canonical and social metadata. Completed through the shared base layout.

Completion criteria:

- Every linked seed asset has a detail route. Completed.
- Metadata is unique and valid. Completed.
- No unintended 404s from gallery cards. Completed.
- Build and tests pass. Completed.

## Phase 7: Anonymous Local Collections

Goal: Implement useful anonymous collection behavior.

Dependencies: Phases 4, 5, and 6.

Status: Complete.

Work:

- Add/remove, duplicate prevention, rename, clear, reorder, persistence, preview. Completed.
- ZIP download with progress, cancellation, controlled concurrency, and partial-failure reporting. Completed.
- Local-only privacy/FAQ documentation. Completed.
- Dedicated collection behavior documentation. Completed in `COLLECTIONS.md`.

Completion criteria:

- Collection state works across refreshes. Completed in browser checks.
- Failed ZIP file fetches settle and report partial failure. Completed.
- Unit tests cover collection state and ZIP failure behavior. Completed.
- Browser smoke test covers add/remove/rename/reorder/clear/download paths. Completed.

## Phase 8: Search and Taxonomy Expansion

Goal: Make discovery scalable and URL-addressable.

Dependencies: Phase 5.

Status: Complete.

Work:

- Free-text search. Completed.
- Content type, category, tag, animated/static, orientation, format, color, sort filters. Completed for current seed data.
- Shareable URLs. Completed through centralized canonical serialization.
- Server-rendered filter forms for `/search`, kind galleries, and category pages. Completed.
- Active-filter removal and reset URLs. Completed.
- Taxonomy and color-family documentation. Completed in `SEARCH_AND_TAXONOMY.md`.

Completion criteria:

- Filter state round-trips through URLs. Completed.
- Empty and error states are accessible. Completed.
- Tests cover query parsing and filter behavior. Completed.

## Phase 9: Database and Server Layer

Goal: Introduce D1-backed persistence and server data access.

Dependencies: Phase 8.

Status: Complete for Phase 9 provisioning. Local, preview, and production D1 environments are configured with binding `DB`; preview is seeded with development seed media; production schema is migrated but intentionally unseeded.

Work:

- D1 schema migrations. Completed in `migrations/0001_initial_schema.sql` and applied locally, to preview, and to production.
- Repository/service modules. Completed in `src/server/db/`, `src/server/repositories/`, and `src/server/services/`.
- Public asset queries. Completed for gallery, category, search, and detail routes through the repository boundary.
- Seed import SQL generator. Completed in `scripts/seed-d1.ts`.
- Download event aggregation. Started with durable event inserts through `POST /api/downloads`; aggregate counters and public ranking surfaces remain future work.
- Rate limiting where required. Deferred until authenticated/abuse-prone server workflows are wired in later phases.

Completion criteria:

- Migrations are repeatable. Confirmed locally, in preview, and in production.
- Local D1 workflow documented. Completed in `DATABASE.md`.
- Integration tests cover basic asset retrieval and download recording. Completed through repository tests using a fake D1 boundary.
- Remote D1 preview and production migrations. Completed.
- Preview seed import. Completed with development seed media only.
- Production seed import. Intentionally not run; production remains empty until real Cloudinary inventory is approved.

## Phase 10: Discord Authentication and Sessions

Goal: Add secure account identity.

Dependencies: Phase 9.

Status: Complete for open Discord identity and D1-backed sessions, including production verification on 2026-07-08.

Work:

- OAuth state validation. Completed with D1-backed one-time state hashes and a short-lived HTTP-only state cookie.
- Secure callback. Completed for Discord authorization-code exchange and `identify` user fetch.
- HTTP-only sessions. Completed with D1-backed opaque sessions storing only token hashes.
- Secure cookies. Completed with `HttpOnly`, `SameSite=Lax`, `Path=/`, finite max age, and production `Secure`.
- Logout. Completed as POST-only revocation plus cookie clearing.
- Account create/update. Completed for Discord ID, username, global name, avatar hash, account status, and timestamps.
- Redirect allowlist. Completed for safe same-origin relative return paths.
- Role checks. Not implemented by policy; all Phase 10 authenticated users are ordinary users.

Completion criteria:

- Auth flow works locally with configured secrets and in production. OAuth initiation and route behavior were verified locally; production Discord sign-in, callback, `/account`, refresh persistence, and logout were manually verified on `https://pfseeker.com`.
- Unauthorized users cannot access protected routes. `/account` redirects unauthenticated requests to Discord sign-in.
- Tests cover OAuth state and session helpers. Completed through auth utility tests, migration shape tests, controlled local D1 session smoke checks, and route smoke checks.
- Cloudflare Pages SSR deployment works in production through the Pages advanced-mode `_worker.js` compatibility layer from commit `f41c81a9`.

## Phase 11: Authenticated Multiple Collections

Goal: Let authenticated users create and manage multiple private collections synced through D1.

Dependencies: Phases 7 and 10.

Status: Implemented on feature branch `phase-11-synced-collections` pending Cloudflare preview deployment verification. Phase 12 has not started.

Work:

- Remove production use of anonymous localStorage collection state. Completed in source by replacing `pfseeker.collection.v1` runtime code.
- Add D1 schema for `collections` and `collection_items`. Completed in `migrations/0003_synced_collections.sql`.
- Add server-only collection repository. Completed in `src/server/repositories/collections.ts`.
- Add authenticated collection mutation endpoints with same-origin mutation checks. Completed under `src/pages/api/collections/`.
- Replace `/collections` with authenticated list and detail routes. Completed.
- Add multi-collection save picker for gallery cards and asset detail pages. Completed.
- Keep collections private only. Public publishing is deferred.
- Adapt ZIP downloads for owner-only collection detail pages using server-resolved asset metadata. Completed.

Completion criteria:

- Signed-out users are prompted to sign in and return to the originating page before saving.
- Signed-in users can create multiple named private collections, add/remove assets, rename, reorder, delete, and download ZIPs.
- Ownership is enforced server-side on every mutation.
- Local, preview, and production D1 migrations are applied and repeated with no pending migrations. Completed on 2026-07-08.
- No anonymous collection import is retained by product decision.
- Public publishing remains deferred and no nonfunctional toggle is shown.

## Phase 12: Signed Submissions

Goal: Implement controlled content submissions.

Dependencies: Phases 4, 9, and 10.

Completion criteria:

- Upload parameters are signed server-side.
- MIME, dimensions, file size, metadata, and account permissions are validated.
- Submitted items enter a pending state.

## Phase 13: Moderation and Reports

Goal: Add protected moderation operations.

Dependencies: Phase 12.

Completion criteria:

- Moderators can review, edit metadata, approve, reject, archive, and handle reports.
- Every action writes a moderation event.
- Role authorization is tested.

## Phase 14: Creators and Leaderboards

Goal: Add creator-facing public discovery.

Dependencies: Phases 9 and 13.

Completion criteria:

- Creator profiles show approved uploads, downloads, collections, and recent submissions.
- Leaderboards are based on real aggregated data.

## Phase 15: SEO and Editorial Surfaces

Goal: Complete crawlability and editorial discovery.

Dependencies: Public route phases.

Completion criteria:

- Sitemap, robots, canonicals, JSON-LD, Open Graph, Twitter metadata, breadcrumbs, headings, and alt text are complete.
- Representative pages meet SEO target or exceptions are documented.

## Phase 16: Security Hardening

Goal: Verify and harden all public and privileged behavior.

Dependencies: Dynamic/server phases.

Completion criteria:

- CSP, Referrer Policy, Permissions Policy, secure cookies, CSRF where applicable, rate limits, input validation, output escaping, redirect allowlists, upload validation, and role checks are tested.

## Phase 17: Performance and Accessibility Audit

Goal: Verify production-quality UX.

Dependencies: Feature-complete public surfaces.

Completion criteria:

- Lighthouse targets: Performance 90+, Accessibility 95+, Best Practices 95+, SEO 95+ or documented exceptions.
- Keyboard-only, mobile touch, high zoom, reduced motion, responsive media, and layout stability verified.

## Phase 18: Complete Automated Testing

Goal: Raise coverage across critical flows.

Dependencies: Feature-complete application.

Completion criteria:

- Unit, integration, and E2E tests cover galleries, search, filters, lightbox, downloads, collections, auth, submissions, moderation, mobile navigation, keyboard navigation, and loading/error/empty states.

## Phase 19: Deployment and Final Verification

Goal: Ship pfseeker to production.

Dependencies: All prior phases.

Completion criteria:

- GitHub checks pass.
- Cloudflare preview and production deployments work.
- D1 bindings and migrations are configured.
- Secrets are configured outside source control.
- `pfseeker.com` is canonical and `www` redirects.
- Security headers, cache behavior, error pages, and smoke tests pass.
- Documentation matches production behavior.
