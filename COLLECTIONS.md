# Anonymous Local Collections

Phase 7 adds browser-local collections for anonymous visitors. The feature is intentionally local-only and does not create accounts, synced ownership, server IDs, creator attribution, download counts, or privileged records.

## Storage Model

Collection state is centralized in `src/lib/collection.ts`.

- Storage key: `pfseeker.collection.v1`
- Schema version: `1`
- Stored fields: schema version, collection name, ordered asset IDs, created timestamp, and updated timestamp.
- Asset IDs are resolved against the current seed asset catalogue at render time.
- Unknown saved IDs are preserved so a visitor can remove them deliberately.

The client script is the only browser code that touches `localStorage`. It validates storage availability, handles corrupt JSON, unsupported versions, unavailable storage, and save failures without uncaught errors. If storage is unavailable, collection actions remain usable for the current page view only.

## Supported Operations

- Add asset.
- Remove asset.
- Prevent duplicate asset IDs.
- Clear the collection after dialog confirmation.
- Rename with trimming, whitespace normalization, maximum length, and empty-name rejection.
- Reorder saved assets with keyboard-operable move controls.
- Restore from browser storage.
- Resolve saved IDs to current assets.
- Report and remove missing saved IDs.
- Count saved IDs for header and page display.

## User Surfaces

Save controls appear on gallery cards, home/category/search/related-card surfaces that use the shared asset card, and asset detail pages. Controls render disabled before JavaScript initialization so they do not appear falsely functional.

The `/collections` page includes:

- local-only explanation
- rename form
- saved item count
- ordered saved asset list
- move up/down controls
- remove controls
- clear confirmation using the existing dialog primitive
- empty state
- missing-ID warning and removal controls
- ZIP download with progress, cancellation, and failure reporting

Cross-page state updates are handled by re-rendering every matching control on the current page and listening for browser `storage` events where supported.

## ZIP Downloads

ZIP generation is implemented in `src/lib/collection-zip.ts` using the maintained `jszip` package. No copied vendor ZIP files are used.

The ZIP helper:

- fetches only currently resolved seed SVG assets
- writes safe paths such as `pfps/ember-orbit.svg`
- limits concurrent fetches
- uses `AbortController` for cancellation
- settles all fetch attempts
- returns complete, partial, failed, or cancelled results
- reports individual failed assets
- prevents empty downloads in the UI

Missing saved IDs stay in the collection but are excluded from ZIP creation until they resolve to a current asset.

## Security and Privacy

The collection is anonymous browser data. It is not trusted for server-side authorization and must not be treated as proof of ownership in later authenticated phases. Future account sync must use explicit conflict handling and server-side validation.

The feature stores stable local seed asset IDs only. It does not store personal data, Cloudinary secrets, Discord credentials, or account identifiers.

## Accessibility

Collection controls are native buttons. Dynamic feedback uses live regions. Reordering and removal are keyboard operable. The clear action requires an accessible dialog confirmation, and ZIP progress is announced through status text.

## Validation

Phase 7 adds unit coverage for:

- default state
- schema and version validation
- corrupt stored data recovery
- add/remove/duplicate prevention
- rename validation
- clear
- reorder
- missing saved IDs
- storage key round-trip
- ZIP filename sanitization
- ZIP concurrency settling
- complete, partial, failed, empty, and cancelled ZIP results
