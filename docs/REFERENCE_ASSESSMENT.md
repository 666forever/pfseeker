# Reference website assessment

## Why the reference is included

The files under `reference/assessed-site/` are included because they reveal useful product concepts and implementation lessons for a mature profile-media platform. They are not the pfseeker source code and must remain isolated from the production implementation.

## What the assessed website demonstrates

The reference represents a mature profile-picture platform with:

- PFP and banner galleries
- category navigation
- search
- individual asset routes
- creator rankings
- Discord login
- submissions
- client-side collections
- ZIP downloads
- infinite pagination
- moderation-related client functions
- SEO-oriented content and internal linking
- advertising and analytics
- a network of related Discord-oriented websites

The product is more mature than its frontend engineering architecture.

## Useful product patterns

The following concepts are relevant to pfseeker:

- Searchable galleries with category and tag discovery.
- Asset cards containing title, format, and download information.
- Individual asset detail pages.
- Temporary collections that persist locally.
- ZIP download of multiple assets.
- Creator pages and leaderboards.
- Discord OAuth for account identity.
- Submission and moderation workflows.
- SEO category pages and editorial support content.
- Incremental gallery loading.

These concepts should be redesigned and implemented independently.

## Visual observations

The reference uses:

- dark zinc surfaces
- indigo accents
- rounded panels
- dense navigation
- image-first cards
- translucent borders and occasional backdrop blur
- hover-revealed card controls

pfseeker should not copy this exact visual system. It should develop an original dark, editorial, precise, curated identity around `.pfseeker®`.

## Technology observed in the reference

- large server-rendered HTML document
- Tailwind CDN runtime
- small custom stylesheet
- jQuery 3.2.1
- jQuery Infinite AJAX Scroll
- JSZip
- JSZip Utils
- FileSaver
- Font Awesome
- Google Analytics
- Google AdSense
- a global `window.App` object

## Key implementation problems to avoid

### Unsafe script ordering

The reference marks jQuery and dependent libraries as `async`, while loading the application script synchronously. This can cause the application to run before jQuery or ZIP dependencies exist.

Use modules or ordered `defer` scripts instead. Prefer bundling through the project build system.

### Runtime Tailwind

The reference loads Tailwind from the CDN and generates styles in the browser. pfseeker must compile Tailwind during the build.

### Old and global architecture

The reference uses old jQuery, a large global application namespace, and shared functions for unrelated pages. pfseeker should use strict TypeScript modules and page-scoped interactive components.

### Fragile ZIP completion

The reference increments completion only for successful downloads. A failed file can prevent ZIP generation from completing forever. pfseeker must use controlled concurrency and `Promise.allSettled()`-style failure accounting, with progress, cancellation, and partial-failure messaging.

### Accessibility gaps

Observed weaknesses include:

- essential controls mainly revealed on hover
- links used as buttons
- incomplete dropdown state semantics
- no obvious focus trap or focus restoration in mobile overlays
- ad-block overlay without proper dialog semantics
- dynamic feedback without an accessible live region

### Dead or stale UI

The reference contains placeholder `href="#"` links, inconsistent labels, stale selectors, and at least one invalid Tailwind z-index class. pfseeker must contain no dead controls.

### Duplicate third-party initialization

Analytics and advertising appear both dynamically injected and directly present in the captured HTML. pfseeker must centralize optional analytics initialization and load it once.

### Inconsistent paths and copied deployment artifacts

The captured files use several incompatible asset path conventions. pfseeker must centralize routing and media URL construction.

### Security concerns to avoid

- API messages inserted with unsanitized `innerHTML`
- no visible explicit CSRF token flow
- client-composed privileged endpoint paths
- local-storage filenames concatenated into media URLs without validation
- inline scripts and handlers that weaken Content Security Policy

## Reference-file caveats

The reference folder includes copied vendor and advertising files because they were part of the original assessment. Do not import them into the production application. In particular:

- do not reuse its Google publisher or analytics identifiers
- do not reuse its Discord or API routes
- do not serve its copied `adsbygoogle.js`
- do not reuse its brand logos
- do not reuse its content, titles, or imagery
- do not assume the captured page is a complete source repository

## Overall conclusion

The reference is useful for understanding the breadth of a mature product, but its frontend should not be used as the technical foundation. pfseeker should preserve the strong product ideas while replacing the implementation with a modern, modular, accessible, secure, and Cloudflare-compatible architecture.
