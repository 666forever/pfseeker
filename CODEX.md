# Codex project instructions

You are responsible for planning, building, testing, documenting, and finishing the production website **pfseeker**, visually branded as **.pfseeker®**, for deployment at `https://pfseeker.com/`.

This is not a prototype, mock-up, experiment, or temporary demo. Build a complete, maintainable, production-grade product. Do not leave placeholders, fake controls, dead links, unfinished user flows, silent failures, unexplained TODOs, or partially implemented features.

## Product purpose

pfseeker is a curated discovery platform for:

- profile pictures
- banners
- icons
- aesthetic image collections

Users must be able to browse, search, filter, preview, save, organize, and download assets. Authenticated users must eventually be able to submit content, manage submissions, create synced collections, and have creator profiles. Moderators must be able to review and manage submissions.

## Infrastructure requirements

Use:

- GitHub as the source of truth
- Cloudflare Pages for frontend deployment
- Cloudflare Pages Functions or Workers for secure server-side functionality
- Cloudflare D1 for relational application data when dynamic features are implemented
- Cloudinary for media storage, transformation, responsive delivery, and original downloads
- Discord OAuth for authentication when the account system is implemented

Never expose Cloudinary API secrets, Discord secrets, session secrets, signing keys, or privileged credentials to browser code.

## Preferred frontend architecture

Use:

- Astro
- TypeScript with strict mode
- compiled Tailwind CSS
- native browser APIs
- framework islands only where interaction genuinely requires them

Do not use:

- jQuery
- runtime Tailwind CDN
- copied minified third-party scripts as application architecture
- giant global JavaScript namespaces
- a client-rendered SPA for content that should be crawlable
- hover-only essential controls
- placeholder links such as `href="#"`
- duplicate analytics or tracking initialization

## Brand rules

Primary visual branding:

`.pfseeker®`

Standard written branding:

`pfseeker`

The design must be original. The assessed website may be used only as a functional reference. Do not reproduce its layout, copy, branding, visual identity, or code line-for-line.

The pfseeker visual identity should feel:

- dark
- precise
- curated
- premium
- image-first
- editorial
- restrained
- intentional
- recognizably pfseeker

Avoid generic dashboard styling, generic Tailwind templates, excessive decorative gradients, random glass effects, and AI-generated visual clutter.

## Mandatory working method

Before modifying production code:

1. Inspect the entire repository and every relevant subfolder.
2. Determine the actual current architecture and project state.
3. Identify reusable assets, manifests, components, scripts, and styles.
4. Identify broken, obsolete, duplicated, unsafe, or inaccessible code.
5. Identify missing files and unresolved references.
6. Inspect Git status and configuration.
7. Inspect Cloudflare and Cloudinary-related files.
8. Create or update:
   - `PROJECT_AUDIT.md`
   - `ARCHITECTURE.md`
   - `IMPLEMENTATION_PLAN.md`
   - `MIGRATION_NOTES.md`

Do not delete working code during the audit stage.

## Engineering standards

- Use clear module boundaries.
- Keep TypeScript strict.
- Prefer semantic HTML.
- Treat accessibility as a core product requirement.
- Keep mobile behavior first-class.
- Keep client JavaScript intentionally small.
- Centralize configuration and Cloudinary URL generation.
- Validate all inputs server-side.
- Escape all untrusted output.
- Protect every privileged action server-side.
- Never trust hidden UI as authorization.
- Do not commit secrets or `.env` files.
- Do not add dependencies that merely save a few lines.
- Remove obsolete code only after its replacement is verified.
- Every internal route and control must have a real purpose.
- Every loading, error, empty, and success state must be designed.

## Completion standard

A feature is not complete merely because its UI exists. It is complete only when the full flow works, including:

- validation
- persistence
- server behavior where required
- accessibility
- responsive behavior
- loading states
- empty states
- failure recovery
- automated tests
- documentation

For each phase:

1. State the goal.
2. Inspect relevant existing code.
3. Implement the smallest complete architectural slice.
4. Run formatting, linting, type checking, tests, and production build.
5. Fix all resulting errors.
6. Verify manually where automation is insufficient.
7. Update documentation.
8. Create a clear checkpoint commit when Git access is available.

When a decision is ambiguous, choose the approach expected from a senior engineering and product team building a long-lived production platform.
