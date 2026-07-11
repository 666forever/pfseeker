# pfseeker Moderation

## Current Status

Phase 13 moderation is implemented on the `phase-13-moderation-implementation` feature branch. It is not merged to `main` and is not production-verified.

The implementation adds protected moderator and owner workflows for pending submissions, durable D1 role memberships, taxonomy management, publication, rejection, archive, and moderation event history. Reports remain deferred and no report UI, API, or tables are implemented.

## Access Model

Roles:

- ordinary user
- moderator
- owner

There is no `admin` role.

Every privileged page and API request rechecks server-side authorization. Moderators can review submissions, edit moderation metadata, approve/publish, reject, and view history. Owners can do all moderator actions and can also manage taxonomy, manage moderator memberships, bootstrap the first owner, and archive published assets.

Bootstrap access is server-side only. `MODERATOR_BOOTSTRAP_DISCORD_IDS` contains Discord user IDs outside Git. The variable is checked on the server, is never serialized to client output, and creates a durable owner membership plus a moderation event when the bootstrap action is used.

Bootstrap recovery rule:

- If the account already has an active durable membership, that membership controls access.
- If an allowlisted account has a revoked membership and another active owner exists, bootstrap access is denied so owner revocation remains meaningful.
- If there are zero active owners, the allowlist can be used as break-glass recovery even for a previously revoked account.
- Repeated bootstrap with an active owner membership is idempotent and does not create duplicate active memberships.

## Routes

Protected pages:

- `/moderation`
- `/moderation/submissions`
- `/moderation/submissions/[submissionId]`
- `/moderation/taxonomy`
- `/moderation/history`
- `/moderation/members`

No `/moderation/reports` route exists in Phase 13.

## Submission Lifecycle

Submission states:

- `pending`
- `approved`
- `published`
- `rejected`

Asset states:

- `published`
- `archived`

There is no cancelled state, reopen flow, restore flow, media replacement, or asset-type editing.

## Publication

Approval requires real moderator-assigned taxonomy. A submission cannot be published without an existing category valid for the asset type and at least one existing tag.

The publication service copies pending Cloudinary media into `pfseeker/published/{kind}/{assetId}` before writing the published asset record. It does not destructively rename pending media. After the D1 publication write succeeds, it attempts to delete the pending Cloudinary resource. Cleanup failures keep the published asset, mark cleanup state for follow-up, and write a moderation event.

If D1 publication fails after the Cloudinary copy, the service attempts to delete the copied published resource and returns a safe error. If that cleanup also fails, it records a recovery event.

## Rejection And Archive

Rejection requires an internal note from 2 to 1000 characters and can include an optional public reason up to 500 characters. Rejection moves a pending submission to `rejected`, deletes pending Cloudinary media, retains the D1 submission record, clears the usable pending public ID after deletion, and writes moderation history.

Archiving is owner-only. Archiving moves a published asset to `archived` while retaining the asset row, taxonomy links, Cloudinary media, content hash, and event history. Phase 13 does not include restore.

## Submitter View

Submitters can see their private submissions in `pending`, `approved`, `published`, and `rejected` states. Published submissions show a public asset link when available. Rejected submissions show the optional public reason and rejection timestamp. Internal moderation notes, moderator identity, event records, and cleanup internals are never shown to submitters.

Pending submissions remain cancellable by the owner. Approved, published, and rejected submissions are not cancellable.

## Database

Phase 13 uses `migrations/0006_moderation_and_publishing.sql`.

The migration adds:

- `moderator_memberships`
- `moderation_events`
- submission lifecycle columns for review, publication, rejection, cleanup state, and versioning
- asset archive and submitted-asset metadata columns
- taxonomy actor columns

The migration intentionally does not add report tables.

## Deferred

Deferred to later phases:

- report submission and handling
- appeals
- notifications
- public creator/profile surfaces
- restore flows
- media replacement
- full browser E2E coverage for authenticated moderation flows
