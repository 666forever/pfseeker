# Authenticated Synced Collections

Phase 11 replaces anonymous browser-local collections with private, account-owned collections stored in D1.

## Product policy

- A user must sign in with Discord before using any collection feature.
- Anonymous users may browse, search, preview, and download assets.
- Anonymous users may not save assets or create collections.
- Clicking Save while signed out opens a sign-in prompt that links to `/auth/discord` with a safe return path back to the current page.
- No anonymous local collection import is retained by product decision.
- Phase 11 production verification is complete.
- Phase 12 is complete and production-verified.
- Phase 13 moderation and publishing is awaiting merge and production rollout.

## Production verification

Manual production verification on `https://pfseeker.com` confirmed:

- signed-out users cannot use collections;
- signed-out Save prompts Discord sign-in;
- `/collections` requires authentication;
- signed-in users can create multiple named private collections;
- assets can be saved into more than one collection;
- duplicate saves are prevented;
- collections can be renamed;
- items can be reordered and removed;
- collection ZIP download works;
- collections can be deleted;
- collection data persists after refresh and after sign-out/sign-in;
- no anonymous localStorage collection is created;
- production deployment is healthy.

## Storage model

Migration `migrations/0003_synced_collections.sql` adds:

- `collections`: private user-owned collection records with `id`, `user_id`, `name`, `visibility`, `created_at`, and `updated_at`.
- `collection_items`: ordered asset membership with `collection_id`, `asset_id`, `position`, and `added_at`.

Ownership is enforced through `collections.user_id`. Deleting a user cascades to owned collections and items. Deleting a collection cascades to items. Asset foreign keys use `ON DELETE RESTRICT` so collection rows cannot silently point at deleted assets.

Collection rows do not store transformed media URLs. Current asset data is resolved from the assets table when rendering detail pages and ZIP metadata.

## Naming rules

Collection names are validated in `src/lib/collection.ts`.

- Trim surrounding whitespace.
- Normalize repeated whitespace to a single space.
- Require at least one visible character.
- Limit names to 80 characters.
- Reject control characters.
- Preserve user-facing capitalization.
- Allow duplicate names for the same user.
- Sanitize names before using them in ZIP filenames.

## Routes

- `/collections` requires authentication and lists the current user's private collections.
- `/collections/[collectionId]` requires authentication and loads only an owned collection.
- No public collection route is implemented in Phase 11.

Signed-out HTML collection routes redirect to Discord sign-in with a validated return path. Arbitrary preview OAuth remains intentionally unsupported unless a stable callback is registered.

## API behavior

Collection mutations use authenticated endpoints under `/api/collections`.

- `GET /api/collections?assetId=...` lists owned collections and identifies which contain the requested asset.
- `POST /api/collections` creates a collection.
- `PATCH` or form `POST /api/collections/[collectionId]` renames a collection.
- `DELETE /api/collections/[collectionId]` deletes an owned collection.
- `POST /api/collections/[collectionId]/items/[assetId]` adds an existing asset.
- `DELETE /api/collections/[collectionId]/items/[assetId]` removes an asset.
- `POST /api/collections/[collectionId]/reorder` persists a complete ordered asset ID list.

All mutations require a valid active session, validate request content type and request size, validate Origin or Referer for same-origin CSRF protection, and derive ownership only from the authenticated session. Missing or non-owned collections return not found behavior rather than exposing another user's data. Rate limiting remains a later hardening task.

## Multiple collection save flow

Save controls on gallery cards and asset detail pages open a collection picker.

Signed-in users can:

- see owned collections;
- see which collections already contain the asset;
- add or remove the asset from each collection;
- create a new collection without leaving the page.

Signed-out users see a prompt explaining that synced collections require Discord sign-in. The prompt returns them to the originating page after OAuth. The asset is not saved automatically after sign-in; the user clicks Save again.

## Ordering model

Items are ordered by integer `position`, then `added_at`. Reorder requests must include every current asset ID exactly once. Duplicate, missing, extra, or invalid IDs are rejected. Reorder updates positions to a deterministic zero-based sequence. Phase 11 uses last-write-wins behavior for concurrent reorder requests; conflict-version checks are deferred until collection collaboration or heavier concurrent editing exists.

## Privacy and public publishing

Collections are private by default and only private visibility is implemented. Public publishing, stable public slugs, SEO behavior, and unpublishing are deferred. No nonfunctional sharing or publishing toggle is shown.

## ZIP downloads

The existing `src/lib/collection-zip.ts` helper remains the ZIP engine. Collection detail pages provide server-resolved asset metadata to the client for owner-only ZIP downloads.

ZIP behavior includes safe deterministic paths, controlled concurrency, progress updates, cancellation, partial-failure reporting, and empty collection handling. Collection and asset names are sanitized before being used as filenames.

Archived assets are excluded from public repository reads. If an existing private collection item points to an asset that is later archived, the item resolves as unavailable rather than exposing archived media. Archived assets are not included in collection ZIP downloads, and the UI reports unavailable items instead of rendering empty labels or broken media.

## Removed local behavior

Production code no longer uses `pfseeker.collection.v1`, anonymous collection counts, anonymous add/remove, anonymous rename/reorder/clear, local collection page rendering, or localStorage persistence. No hidden migration path from anonymous local collections is retained.

## Accessibility

The collection picker uses a dialog with keyboard focus handling from the shared primitives. Collection detail controls use native buttons for remove and move actions, live-region feedback, visible focus styles, and non-hover-dependent controls. Reordering is available through Move up and Move down buttons, not drag-and-drop only.

## Testing strategy

Phase 11 coverage includes collection name validation, reorder validation, migration shape, repository ownership checks, duplicate prevention, add/remove/reorder behavior, invalid asset rejection, ZIP path safety, ZIP concurrency, partial failures, empty downloads, and cancellation. D1 migrations are applied locally, to preview, and to production. Production behavior was manually verified after deployment.
