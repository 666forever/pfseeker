# Asset Detail Pages

Phase 6 adds crawlable, route-safe detail pages for every local seed asset.

## Route Patterns

- PFP details: `/pfp/[slug]`
- Banner details: `/banner/[slug]`
- Icon details: `/icon/[slug]`

Every seed asset maps to exactly one detail route through `getAssetRoute()`.

## Lookup Behavior

Detail routes use `getAssetByKindAndSlug(kind, slug)` so the route family and asset kind must match.

Examples:

- `/pfp/ember-orbit` resolves.
- `/banner/slate-horizon` resolves.
- `/icon/north-mark` resolves.
- `/banner/ember-orbit` returns 404 because the slug belongs to a PFP.
- `/pfp/not-real` returns 404 because the slug is unknown.

404 pages set the HTTP status and use `noindex`.

## Page Content

Each detail page renders:

- semantic breadcrumbs
- large responsive media preview
- heading and alt text
- asset type
- intrinsic dimensions
- format
- animated/static state
- published date
- category links
- exact tag-filter search links
- browser-local collection save action
- copy-link action
- development preview download
- link back to the parent gallery
- deterministic related assets

The page does not render fake creators, download counts, likes, rankings, ownership, or licensing claims.

## Metadata

Each valid detail route receives a unique page title and description from the seed asset metadata. The shared base layout generates canonical URLs, Open Graph title, Open Graph description, and Open Graph URL from the current route.

Seed SVG media is not advertised as final production social imagery.

## Related Assets

`getRelatedAssets()` selects a small related set deterministically:

1. same asset kind
2. shared categories
3. shared tags
4. newest publication date
5. stable title and ID fallback

The current asset is excluded and duplicates are not returned.

## Actions

Copy link:

- copies the canonical current page URL when the Clipboard API is available
- works from a keyboard-operable button
- provides visible live-region feedback
- degrades by showing the canonical URL as a regular link
- reports failure without hiding the URL

Download preview:

- downloads the generated local seed SVG directly
- is labelled as a preview
- does not claim to be a production original
- does not increment fake counts or call nonexistent tracking

Save to collection:

- adds or removes the asset from the anonymous browser-local collection
- stores only the seed asset ID in `pfseeker.collection.v1`
- stays disabled until the client collection script initializes
- syncs state with matching controls on the current page and with other tabs through storage events where supported

Report actions are intentionally absent until a real report workflow exists.

Tag links:

- point to `/search?tag={normalized-tag}`
- use URL-safe encoding
- match exact normalized seed tags
- render the active tag in the search filter interface
- can be removed through the active-filter link without JavaScript

## Migration Path

When D1-backed assets replace local seed data:

- keep route generation centralized
- preserve kind/slug validation
- use stable Cloudinary public IDs instead of local development sources
- keep media rendering behind the descriptor helper boundary
- add real creator, licensing, moderation, download, save, and report data only when backed by server behavior
