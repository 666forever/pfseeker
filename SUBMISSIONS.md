# pfseeker Submissions

## Current status

Phase 12 adds authenticated signed submissions on the `phase-12-signed-submissions` feature branch. Any signed-in Discord user can submit one PFP, banner, or icon image into a private `pending` state. Signed-out users may browse the site normally, but `/submissions`, `/submissions/new`, `/submissions/[submissionId]`, and submission mutation APIs require authentication.

Migration `0004_signed_submissions.sql` has been applied locally, to preview, and to production. Signed-out Cloudflare preview verification passed for `/submissions`, `/submissions/new`, and protected detail-route behavior. Production runtime upload verification remains pending until the branch is reviewed, merged, and configured with Cloudinary server credentials.

Moderation is not implemented in Phase 12. Pending submissions are not public, are not added to galleries, and cannot be approved, rejected, edited, replaced, restored, or published by any hidden endpoint.

## Supported media

Allowed formats:

- JPG
- JPEG
- PNG
- WebP
- GIF

SVG, video, archives, documents, and other formats are rejected. The browser performs usability checks, but the server verifies the uploaded Cloudinary resource before writing D1 rows.

File limits:

- PFP: 256 x 256 minimum, 2048 x 2048 maximum, 10 MB maximum.
- Banner: 256 x 256 minimum, 2048 x 2048 maximum, 10 MB maximum.
- Icon: 20 x 20 minimum, 512 x 512 maximum, 4 MB maximum.

Animated GIFs are allowed. Phase 12 rejects GIFs whose decoded workload exceeds `2048 * 2048 * 100` pixels across frames when frame count metadata is available to the verifier, and always enforces byte and dimension limits.

## Metadata

Required:

- image
- asset type
- title, 2 to 80 characters
- existing category valid for the selected asset type
- 1 to 5 existing tags
- content-rules confirmation

Optional:

- description, maximum 100 characters
- creator or credit name, maximum 80 characters
- source URL, HTTP or HTTPS only
- up to 3 suggested tags, 2 to 30 characters each

Text is trimmed, repeated whitespace is normalized, and control characters are rejected. User text is rendered through Astro escaping. Markdown and HTML input are not interpreted.

Source and creator fields are optional. Users do not need to provide proof of ownership, proof of permission, license details, source URL, creator name, attribution, or copyright documentation for Phase 12 submission intake.

## Content rules

The submitter must confirm that the image does not contain:

- obvious nudity
- gore or graphic injury
- hateful imagery

General dark, horror, suggestive, or violent-themed imagery remains eligible when it does not cross those boundaries. Publication is never guaranteed.

## Upload flow

Phase 12 uses direct signed uploads to Cloudinary:

1. The authenticated user fills out `/submissions/new`.
2. The browser asks `/api/submissions/upload-intent` for a short-lived signed upload intent.
3. The server validates authentication, same-origin request headers, active intent limits, and the requested asset type.
4. The server creates a D1 `submission_upload_intents` row and signs a Cloudinary upload for a generated public ID under `pfseeker/pending-submissions`.
5. The browser uploads the image directly to Cloudinary.
6. The browser posts `/api/submissions/complete`.
7. The server validates metadata, reads the upload intent, verifies the Cloudinary resource through the Admin API, fetches the verified resource bytes to compute a SHA-256 content hash, checks quotas and duplicates, and inserts a `pending` submission row.
8. The browser redirects to the private submission detail page.

Cloudinary API secrets stay server-only. The client cannot choose arbitrary folders, public IDs, transformations, moderation state, or ownership. Failed completion attempts try to delete the uploaded Cloudinary resource.

## D1 schema

Phase 12 adds:

- `submission_upload_intents`
- `submissions`
- `submission_tags`
- `submission_suggested_tags`
- nullable `assets.content_hash` for future exact duplicate checks against published Cloudinary assets

Submissions reference `users` and `categories`. Submission tags reference existing `tags`. Submission tag and suggested-tag rows cascade when a submission is deleted. No moderator IDs, approval notes, rejection notes, public slug, audit rows, Discord token copies, or fake moderation records are created.

## Quotas and duplicates

Server-enforced limits:

- maximum 10 completed submissions per user per rolling 24 hours
- maximum 3 simultaneous active upload intents per user
- maximum 50 pending submissions per user

Successful pending submissions consume the rolling daily quota. Failed validation attempts do not. Cancellation does not restore the daily quota.

Duplicate behavior:

- exact duplicate by the same user is blocked
- exact duplicate of a published asset is blocked when the published asset has a stored content hash
- exact duplicate already pending from another user is allowed and marked internally for future moderation review
- similar but non-identical files are allowed
- filenames are not duplicate identifiers

## Cancellation

Pending submissions are read-only. The only owner action is `Cancel submission`.

Cancellation requires confirmation, verifies ownership, deletes the Cloudinary resource, then deletes the D1 submission row. Related tag and suggested-tag rows cascade. No audit record is retained, and cancellation is unrecoverable. If Cloudinary deletion fails, the D1 row is retained so there is not a silent orphan without a retry path.

## Privacy model

Pending submissions are shown only on authenticated owner routes and are marked `noindex`. They are not linked from public pages, not included in public galleries, and not exposed through unauthenticated detail routes.

The current Cloudinary pending-media model uses unpredictable public IDs under a dedicated pending namespace and does not expose pending media from public pfseeker pages. It should not be described as cryptographically private unless Cloudinary authenticated delivery is configured in a later hardening phase.

Discord identity is stored only through the existing `users` ownership relationship. Future public publication must not show Discord username, user ID, avatar, or imply that "submitted by" means "created by".

## Deferred

Phase 12 deliberately defers:

- approval and rejection
- moderator tools
- reports and appeal handling
- public collection publishing
- public submission visibility
- notifications
- drafts, edit routes, image replacement, and restore behavior
- broader rate limiting and abuse investigation tooling
- advanced perceptual duplicate detection
- full malware scanning if unavailable through the current stack

## Tests

Automated coverage includes metadata normalization, title and optional-field limits, source URL safety, category/type compatibility, tag and suggested-tag limits, allowed formats, file size and dimensions, pending status validation, upload-intent namespace checks, duplicate handling, quota calculations, owner-only reads, cancellation removal, upload-intent expiry and replay prevention, migration shape, and SVG rejection.

Cloudinary network calls are isolated behind server modules and are not exercised against production Cloudinary in ordinary unit tests.
