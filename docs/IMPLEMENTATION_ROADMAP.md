# Implementation roadmap

Codex must refine this roadmap after auditing the actual repository. Each phase must end in a working, testable state.

## Phase 0 — Audit and architecture

- Inspect every file and dependency.
- Map current behavior and missing resources.
- Inspect Git, Cloudflare, and Cloudinary state.
- Produce the audit and migration documents.
- Do not delete working code.

## Phase 1 — Engineering foundation

- Initialize or normalize Astro.
- Enable strict TypeScript.
- Configure compiled Tailwind.
- Add formatting, linting, type checking, unit tests, and Playwright.
- Configure the Cloudflare adapter and environment validation.
- Create error pages and base layout.

Required commands must pass:

```bash
npm install
npm run dev
npm run build
npm run preview
npm run lint
npm run typecheck
npm run test
```

## Phase 2 — Design system

Define tokens for:

- backgrounds
- panels
- text hierarchy
- borders
- accents
- radii
- shadows
- spacing
- typography
- motion
- breakpoints
- focus states

Build reusable primitives:

- buttons
- icon buttons
- inputs
- search field
- selects
- checkboxes
- dialogs
- drawers
- dropdowns
- toasts
- cards
- skeletons
- badges
- tooltips
- empty states

## Phase 3 — Global application shell

- Responsive header.
- Desktop and mobile search entry.
- Mobile drawer.
- Category navigation.
- Collection control.
- Account state.
- Footer.
- Skip link.
- Privacy and cookie controls where required.

All overlay behavior must include Escape handling, accurate ARIA state, focus trapping, and focus restoration.

## Phase 4 — Cloudinary abstraction

- Central media model.
- Responsive image URL builder.
- PFP, banner, and icon transformations.
- AVIF/WebP delivery.
- Animated asset behavior.
- Blur placeholders.
- Original download links.
- Signed upload architecture.

## Phase 5 — Read-only galleries

Build one reusable gallery engine for:

- PFPs
- banners
- icons
- search results
- creator pages
- collections

Include stable responsive grids, incremental loading, lazy loading, URL-backed filters, sorting, skeletons, empty states, retry states, keyboard-accessible cards, save actions, downloads, and an accessible lightbox.

Prefer CSS Grid over masonry unless varied source ratios demonstrate that masonry is actually needed.

## Phase 6 — Search and taxonomy

Support:

- free-text search
- content type
- categories
- tags
- animated/static
- orientation
- format
- color metadata where available
- newest
- popular
- most downloaded
- trending

Represent state in the URL, for example:

```text
/search?q=dark&type=pfp&animated=true&sort=popular
```

## Phase 7 — Asset pages

Each asset page must expose crawlable primary content and include:

- large preview
- title
- creator
- format
- dimensions
- tags
- categories
- download count
- download action
- collection action
- copy link
- related assets
- report action
- canonical URL
- structured metadata
- social metadata

## Phase 8 — Anonymous local collections

Implement:

- add
- remove
- duplicate prevention
- reorder
- clear
- name
- preview
- persistence
- ZIP download
- progress
- cancellation
- partial-failure reporting
- safe memory behavior

Use controlled concurrency and settle every fetch. A failed file must never leave ZIP generation permanently incomplete.

## Phase 9 — Database and server layer

- Create D1 migrations.
- Add validated repositories/services.
- Add environment bindings.
- Implement public asset queries.
- Implement download event aggregation.
- Add rate limiting where required.

## Phase 10 — Discord authentication

- OAuth state validation.
- Secure callback.
- HTTP-only sessions.
- Secure cookies.
- Expiry and logout.
- Account creation/update.
- Safe redirect allowlist.
- Role checks.

Roles:

- user
- trusted_creator
- moderator
- administrator

## Phase 11 — Synced accounts and collections

- Account overview.
- Sync anonymous collection after sign-in with explicit conflict handling.
- Create, edit, reorder, publish, and delete user collections.
- Privacy controls.

## Phase 12 — Signed submissions

Workflow:

```text
upload → validate → pending → moderation → approved/rejected
```

Implement PFP, banner, icon, and collection submissions. Validate MIME type, dimensions, file size, account permissions, and metadata.

## Phase 13 — Moderation and reports

- Pending queue.
- Preview.
- Metadata edits.
- Category/tag assignment.
- Duplicate detection.
- Approval.
- Rejection reason.
- Report handling.
- Removal and archival.
- Audit trail.

## Phase 14 — Creators and leaderboards

- Creator profile.
- Approved upload count.
- Total downloads.
- Collections.
- Recent submissions.
- Rank.
- Weekly, monthly, and all-time leaderboards where data supports them.

## Phase 15 — SEO and editorial surfaces

- Canonicals.
- Unique titles and descriptions.
- Open Graph and Twitter metadata.
- 1200×630 social images.
- XML sitemap.
- robots.txt.
- JSON-LD.
- Breadcrumbs.
- Semantic headings.
- Descriptive alt text.
- Crawlable internal navigation.

## Phase 16 — Security hardening

- Input validation.
- Output escaping.
- CSRF protection where applicable.
- Secure OAuth state.
- Rate limiting.
- Upload validation.
- Signature protection.
- Role authorization.
- Redirect allowlists.
- Content Security Policy.
- Referrer Policy.
- Permissions Policy.
- Stored and reflected XSS protection.

## Phase 17 — Performance and accessibility audit

- Remove unnecessary hydration.
- Verify responsive image sizes.
- Verify layout stability.
- Verify keyboard-only operation.
- Verify reduced-motion behavior.
- Verify zoom and touch layouts.
- Audit representative Lighthouse routes.

Targets:

- Performance: 90+
- Accessibility: 95+
- Best Practices: 95+
- SEO: 95+

## Phase 18 — Complete automated testing

Unit tests:

- Cloudinary URLs
- slugs
- validation
- collection state
- query parsing
- ZIP failures
- authentication helpers

Integration tests:

- asset retrieval
- submissions
- moderation
- counters
- collection sync
- OAuth callback state

End-to-end tests:

- galleries
- search
- filters
- lightbox
- single download
- collection ZIP
- sign-in
- submission
- moderation
- mobile navigation
- keyboard navigation
- loading, error, and empty states

## Phase 19 — Deployment and final verification

- GitHub checks.
- Cloudflare preview and production environments.
- D1 bindings and migrations.
- Secrets configuration.
- Custom domain.
- Redirects.
- Security headers.
- Cache behavior.
- Full link audit.
- Full responsive audit.
- Production smoke tests.
- Documentation reconciliation.
