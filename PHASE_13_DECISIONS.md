# Phase 13 Moderation and Reports Decisions

## 1. Current-State Findings

Phase 12 is complete and production-verified. The active repository is `C:\Users\hk\Documents\GitHub\pfseeker` on the Phase 12 baseline. Current production behavior is:

- All authenticated users are ordinary users.
- Discord OAuth uses `identify` only. No Discord guild, role, bot token, email scope, access token storage, or refresh token storage exists.
- Sessions are D1-backed opaque cookies. Session tokens are stored only as HMAC hashes.
- Collections are private, account-owned, D1-backed, and production-verified.
- Submissions are authenticated-only, private, pending-only, noindex, owner-readable, owner-cancellable, and production-verified.
- Pending submission uploads use signed direct Cloudinary uploads into the pending namespace, then server-side Cloudinary verification and D1 insertion.
- Production remains intentionally unseeded with public assets, categories, tags, fake reports, fake moderator accounts, fake moderation events, or fake submissions.
- There are no moderation routes, APIs, services, repositories, migrations, role checks, reports, admin routes, approval paths, rejection paths, archive paths, or public submission publishing paths.

Read-only production D1 inspection found:

| Area                          | Production count |
| ----------------------------- | ---------------: |
| users                         |                1 |
| active sessions               |                1 |
| assets                        |                0 |
| categories                    |                0 |
| tags                          |                0 |
| collections                   |                1 |
| collection_items              |                0 |
| submissions                   |                0 |
| submission_upload_intents     |                2 |
| submission_tags               |                0 |
| submission_suggested_tags     |                0 |
| downloads                     |                0 |
| moderation/report/role tables |         0 tables |

The current `submissions.status` check allows only `pending`, so moderation states require a migration. `assets.status` currently allows `draft`, `published`, and `archived`; public gallery repositories only read `published` assets. `submissions.category_id` is nullable, which matches Phase 12 optional taxonomy.

## 2. Confirmed Phase 12 Boundaries

These must remain true until implementation is explicitly approved:

- Ordinary users cannot access moderation data or actions.
- Pending submissions stay private.
- Cancellation deletes the pending Cloudinary resource before deleting the D1 row.
- Cancelled submissions do not become a visible state.
- No public publishing occurs from submission intake.
- No roles, moderator memberships, reports, moderation events, or taxonomy records are fabricated.
- Cloudinary and Discord secrets remain server-only.
- Browser-visible code never receives Cloudinary API secrets, Discord secrets, session secrets, role allowlists, or privileged action details.

## 3. Recommended Phase 13 Scope

Recommended first implementation:

- Add server-side moderator authorization.
- Add a private moderation submission queue.
- Add private moderation submission detail.
- Allow moderators to edit review metadata needed for publication: title, description, creator/credit, source URL, category, and tags.
- Add taxonomy management for categories and tags because production currently has none.
- Add approval as a two-step publication operation that creates a public `assets` row and moves/copies media to a published namespace.
- Add rejection with internal note and optional submitter-visible reason.
- Add an append-only moderation event log.
- Add owner-visible post-moderation submission outcomes.
- Add reports only after at least one published asset exists, or build only the schema and defer public report UI.

The narrowest useful Phase 13 should prioritize submissions and taxonomy before reports. Reports have limited value while production has no published assets.

## 4. Explicitly Deferred Work

Defer:

- Discord guild/role/bot authorization.
- Multi-tenant admin hierarchy beyond what is needed to avoid owner lockout.
- Public collection publishing.
- Creator profiles and leaderboards.
- Moderator DMs, email notifications, and Discord notifications.
- User bans, appeals, strike systems, and trust scores.
- Media replacement.
- Perceptual duplicate detection.
- Malware scanning beyond current Cloudinary/server validation unless the current stack provides it.
- Anonymous reports until rate limiting and abuse controls are stronger.
- Full public report UI until published production assets exist.

## 5. Authorization Options and Recommendation

| Option                                                     | Security                                                                                            | Operations                                                    | Revocation                                                                                | Auditability                       | Complexity | Discord dependency              | Lockout risk                                          | Later moderators                                      |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ---------------------------------- | ---------- | ------------------------------- | ----------------------------------------------------- | ----------------------------------------------------- |
| A. Role field on `users`                                   | Simple but coarse. A single mutable field can be overused.                                          | Easy to query and render.                                     | Manual D1 update or admin UI.                                                             | Weak unless paired with events.    | Low.       | None.                           | Medium if only user with role is changed incorrectly. | Limited: cannot model multiple roles/history cleanly. |
| B. Dedicated `user_roles` or `moderator_memberships` table | Stronger least-privilege model.                                                                     | Slightly more setup, but clear.                               | Set `revoked_at`, revoke sessions.                                                        | Good with actor and reason fields. | Moderate.  | None.                           | Low with bootstrap allowlist and membership rows.     | Good.                                                 |
| C. Server-side Discord user ID allowlist                   | Strong for first-owner bootstrap if kept in Cloudflare secret/var.                                  | Easy for one owner, awkward for teams.                        | Cloudflare variable update and redeploy/restart behavior.                                 | Weak unless mirrored to D1 events. | Low.       | Uses Discord ID only, no API.   | Low if env var is correct, high if omitted.           | Poor alone.                                           |
| D. Discord guild/role verification                         | Can centralize access in Discord.                                                                   | Requires bot/API or extra OAuth scopes.                       | Discord role removal.                                                                     | Split across Discord and D1.       | High.      | Strong dependency.              | Higher if bot/API fails.                              | Good for Discord-native teams, overkill now.          |
| E. Hybrid allowlist bootstrap plus D1 memberships          | Best balance. Env allowlist prevents first-owner lockout; D1 stores durable memberships and events. | Clear first-owner setup and later moderation team management. | Revoke D1 membership and active sessions; remove env fallback after bootstrap if desired. | Strong.                            | Moderate.  | No Discord API or bot required. | Lowest.                                               | Good.                                                 |

Recommendation: use option E. Phase 13 should introduce a `moderator_memberships` table with roles and a server-side Cloudflare environment allowlist for initial owner bootstrap. The allowlist should contain Discord user IDs only in Cloudflare configuration, never in Git. Runtime authorization should require an active session and then grant access if either the local user has an active membership or their Discord user ID is in the server-side bootstrap allowlist.

## 6. Initial Moderator Assignment

Recommended process:

1. User signs in through production Discord once so the local `users` row exists.
2. User privately provides or confirms their Discord user ID out of band.
3. Operator sets a Cloudflare Pages secret or encrypted variable such as `MODERATOR_BOOTSTRAP_DISCORD_IDS` with comma-separated Discord IDs.
4. Phase 13 code recognizes the allowlisted signed-in user as `owner`.
5. The first owner opens a protected bootstrap route or runs a protected one-time CLI script that inserts an active `moderator_memberships` row and writes a `moderation_events` bootstrap event.
6. After membership exists and is verified, the bootstrap env allowlist can remain as break-glass recovery or be removed by operator policy.

Do not commit Discord IDs or role assignments to migrations. Avoid manual D1 updates as the primary process because they are easy to mistype and do not naturally write an audit event.

## 7. Permission Matrix

Recommended roles:

- ordinary user
- moderator
- owner

Skip separate `admin` for first Phase 13. `owner` can manage moderators and taxonomy; `moderator` handles review. Add `admin` later only if owner responsibilities need to be split.

| Permission                    | ordinary user                                        | moderator                         | owner                      |
| ----------------------------- | ---------------------------------------------------- | --------------------------------- | -------------------------- |
| View own submissions          | Yes                                                  | Yes                               | Yes                        |
| View moderation queue         | No                                                   | Yes                               | Yes                        |
| View full submission metadata | Own only                                             | Yes                               | Yes                        |
| Edit submission metadata      | No                                                   | Yes                               | Yes                        |
| Approve submissions           | No                                                   | Yes                               | Yes                        |
| Reject submissions            | No                                                   | Yes                               | Yes                        |
| Archive published assets      | No                                                   | No in first slice                 | Yes if archive is included |
| Restore archived assets       | No                                                   | No                                | Defer                      |
| Review reports                | No                                                   | Defer or Yes after reports launch | Yes after reports launch   |
| Resolve reports               | No                                                   | Defer or Yes after reports launch | Yes after reports launch   |
| Manage taxonomy               | No                                                   | No                                | Yes                        |
| Manage moderators             | No                                                   | No                                | Yes                        |
| View moderation history       | Own events involving own submissions only if exposed | Yes                               | Yes                        |

## 8. Submission State Machine

Recommended states:

- `pending`: submitted and waiting for review.
- `approved`: moderation accepted it, but publication may still be completing.
- `published`: public asset exists and is linked.
- `rejected`: moderation declined it.
- `archived`: a published asset was removed from public browsing but retained.

Do not add `cancelled` as a submission state. Owner cancellation remains hard deletion of the pending submission row after Cloudinary cleanup.

Allowed transitions:

- `pending -> rejected`
- `pending -> approved`
- `approved -> published`
- `published -> archived`
- `archived -> published` only if restore is explicitly approved
- `rejected -> pending` only if reopen is explicitly approved; defer by default

Forbidden transitions:

- any transition after the user cancels, because the row no longer exists
- `rejected -> published` without reopening and re-review
- `pending -> archived`; archive should apply to published assets, not queue triage
- ordinary user initiated moderation transitions

Concurrency:

- Store `review_version` or use conditional updates: `UPDATE submissions SET status = ? WHERE id = ? AND status = ?`.
- If zero rows are changed, return a conflict response and reload current state.
- Every action writes one event in the same D1 transaction/batch where possible.

## 9. Approval and Publishing Architecture

Approval should not be treated as a simple status flip. It affects Cloudinary, public asset rows, taxonomy, duplicates, and rollback.

Recommended model:

- Approval creates a public `assets` row.
- Published asset slug is generated from moderated title plus a collision-resistant suffix when needed.
- Public asset ID is a new UUID.
- Published Cloudinary public ID is under a durable namespace such as `pfseeker/published/{kind}/{assetId}`.
- Use Cloudinary copy/upload-by-source or rename only after confirming Cloudinary behavior in a preview. Copy-then-insert-then-delete-pending is safer than destructive rename because recovery is easier if D1 insertion fails.
- Retain only the published Cloudinary resource after successful publication unless retention policy is separately approved.
- Transfer `content_hash`, width, height, format, animation, title, description, creator credit, source URL, category, tags, and timestamps into public asset/taxonomy rows.
- Category and tags should be moderator-assigned during approval. With production taxonomy empty, taxonomy management is required before meaningful publishing.
- Duplicate checks should block exact duplicates against both pending submissions and published assets by `content_hash`.

Recommended transaction pattern:

1. Read submission and assert `pending`.
2. Validate moderated metadata and taxonomy.
3. Copy pending Cloudinary media to published namespace.
4. In one D1 batch: insert asset, asset taxonomy rows, update submission status/link, insert moderation event.
5. Delete pending Cloudinary media.
6. If pending deletion fails, keep D1 publication and write a cleanup-needed event.

If Cloudinary copy succeeds but D1 fails, delete the copied published Cloudinary resource and return a safe error. If cleanup also fails, write a recovery task once a recovery table exists or report exact operator action without exposing secrets.

## 10. Metadata Editing

Moderators may edit:

- title
- description
- category
- existing tags
- creator/credit
- source URL

Moderators may convert suggested tags into real tags only through taxonomy assignment. Suggested tags should remain preserved as submitter-provided review hints.

Do not allow Phase 13 moderators to edit:

- asset type, unless the media already satisfies the target type limits and the state machine explicitly supports revalidation
- content-rules confirmation
- media file
- submitter identity
- content hash
- Cloudinary public IDs directly

Recommendation: media replacement remains prohibited. The submitter can cancel and resubmit if the image is wrong.

Original submitter values should be preserved in `moderation_events.metadata_json` as structured diffs when edits happen. Do not store raw Discord identity snapshots in the event metadata.

## 11. Rejection and Retention Policy Options

Options:

- Delete rejected media immediately and retain a minimal rejected row. Lower storage risk, weaker appeal/debug ability.
- Retain rejected media for a short period, then scheduled cleanup. Better recovery, needs retention tooling.
- Retain rejected media indefinitely. Strong audit trail, higher privacy and storage risk.

Recommendation for Phase 13: rejection requires an internal note, may include an optional submitter-visible reason, changes status to `rejected`, deletes the pending Cloudinary resource, and retains the D1 submission row without public media. The retained row should keep text metadata, content hash, dimensions, format, timestamps, and moderation event references, but no usable Cloudinary public ID after deletion. If Cloudinary deletion fails, keep the row in `rejected_cleanup_pending` or record cleanup metadata rather than hiding the failure.

Suggested fields:

- internal note required, 2 to 1000 characters
- submitter-visible reason optional, 0 to 500 characters
- reason is plain text only
- submitters may view the visible reason if present
- resubmission is allowed, but exact same hash by the same user should remain blocked unless owner policy changes

## 12. Archival Recommendation

Archive is overloaded. It can mean queue hiding, rejected retention, public unpublishing, report preservation, or soft deletion.

Recommendation: defer archive for pending submissions. In Phase 13, define archive only for already published assets:

- `published -> archived` removes the asset from public gallery queries.
- Keep asset row, taxonomy rows, content hash, and moderation event history.
- Do not delete published Cloudinary media automatically unless a separate takedown/delete action is approved.

If public publishing is not included in the first Phase 13 implementation, archive should be deferred entirely.

## 13. Report-System Recommendation

Reports are most useful against public assets. Production currently has zero public assets, so reports can be staged.

Recommended first report scope after publishing exists:

- Reportable target: published assets only.
- Reporter: signed-in users only for Phase 13.
- Reasons: copyright/ownership concern, harmful content, incorrect metadata, broken media, other.
- Explanation: optional, max 1000 characters.
- Duplicate prevention: one open report per reporter and target.
- Rate limit: small rolling limit per reporter.
- Reporter privacy: never visible to public or target owner.
- Target-owner visibility: no reporter identity; visible report status only if product policy approves it.
- States: `open`, `reviewing`, `resolved`, `dismissed`.
- Outcomes: no action, metadata fixed, asset archived, escalated.

Recommendation: document and schema-plan reports now, but implement report UI after at least one published-asset approval path exists. Do not build reports for private pending submissions in Phase 13 because that would expose private pending content and has no user-facing need.

## 14. Taxonomy-Management Recommendation

Production has zero categories and zero tags. Moderation cannot publish useful assets without real taxonomy assignment unless public galleries accept uncategorized assets.

Recommended Phase 13 taxonomy scope:

- Owner-only category creation/editing.
- Owner-only tag creation/editing.
- Category `supported_kinds` compatibility checks.
- Slug generation with collision handling.
- Deletion only when unused.
- Tag merge can be deferred.
- Category delete can be deferred if any references exist.

Do not seed fake taxonomy. The owner should create real production categories and tags before approving public assets.

## 15. Proposed Routes

Use `/moderation` instead of `/admin` for Phase 13. It is narrower and avoids implying general administration exists.

| Route                                    | Purpose                                 | Authorization      | noindex | Notes                                                           |
| ---------------------------------------- | --------------------------------------- | ------------------ | ------- | --------------------------------------------------------------- |
| `/moderation`                            | Moderation landing/summary              | moderator or owner | Yes     | Link to queue and taxonomy.                                     |
| `/moderation/submissions`                | Pending/rejected/published review queue | moderator or owner | Yes     | Filters by status, kind, duplicate flag, newest first.          |
| `/moderation/submissions/[submissionId]` | Review detail                           | moderator or owner | Yes     | Server-confirmed actions only; confirmation for approve/reject. |
| `/moderation/taxonomy`                   | Category/tag management                 | owner              | Yes     | Needed because production taxonomy is empty.                    |
| `/moderation/reports`                    | Report queue                            | moderator or owner | Yes     | Defer until published reports exist.                            |
| `/moderation/history`                    | Event log                               | moderator or owner | Yes     | Filter by target, actor, action, date.                          |

UX requirements:

- No generic dashboard shell. Use dense review-focused pages.
- Show private pending media with clear private/pending labels.
- Avoid optimistic moderation actions; require server success before changing UI.
- Provide keyboard-accessible queues, forms, confirmations, and error summaries.
- Mobile layouts must keep primary action, media preview, metadata, and event history usable without overlap.
- Pagination should be cursor or created-at/id based before queues can grow.
- Empty states must distinguish "no pending submissions" from "not authorized".

## 16. Proposed Schema

Do not create these migrations during planning. Proposed smallest normalized schema:

### `moderator_memberships`

- `id TEXT PRIMARY KEY`
- `user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE`
- `role TEXT NOT NULL CHECK (role IN ('owner','moderator'))`
- `status TEXT NOT NULL CHECK (status IN ('active','revoked'))`
- `created_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL`
- `created_at TEXT NOT NULL DEFAULT now`
- `revoked_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL`
- `revoked_at TEXT`
- `reason TEXT`
- unique active membership per user: partial unique index on `user_id WHERE status='active'`
- indexes: `(status, role)`, `(user_id, status)`

### `moderation_events`

- `id TEXT PRIMARY KEY`
- `actor_user_id TEXT REFERENCES users(id) ON DELETE SET NULL`
- `target_type TEXT NOT NULL CHECK target in ('submission','asset','report','category','tag','moderator_membership')`
- `target_id TEXT NOT NULL`
- `action TEXT NOT NULL`
- `previous_state TEXT`
- `new_state TEXT`
- `metadata_json TEXT NOT NULL DEFAULT '{}'`
- `reason TEXT`
- `created_at TEXT NOT NULL DEFAULT now`
- indexes: `(target_type, target_id, created_at)`, `(actor_user_id, created_at)`, `(action, created_at)`
- no cascade delete from targets; events are append-only

### `submissions` changes

- expand `status` check to include `pending`, `approved`, `published`, `rejected`
- `reviewed_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL`
- `reviewed_at TEXT`
- `published_asset_id TEXT REFERENCES assets(id) ON DELETE SET NULL`
- `rejection_reason_public TEXT`
- `rejection_note_internal TEXT`
- `media_cleanup_status TEXT CHECK IN ('pending_media_present','pending_media_deleted','cleanup_failed')`
- `review_version INTEGER NOT NULL DEFAULT 0`
- indexes: `(status, created_at DESC)`, `(reviewed_by_user_id, reviewed_at DESC)`, `(published_asset_id)`

### `assets` changes

- Existing table may support publication, but public metadata is thin. Consider adding:
- `description TEXT`
- `creator_credit TEXT`
- `source_url TEXT`
- `submitted_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL`
- `submission_id TEXT REFERENCES submissions(id) ON DELETE SET NULL`
- `archived_at TEXT`
- `archived_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL`
- `archive_reason TEXT`
- ensure `status CHECK (status IN ('draft','published','archived'))` remains compatible

### `reports`

- `id TEXT PRIMARY KEY`
- `target_type TEXT NOT NULL CHECK (target_type='asset')`
- `target_id TEXT NOT NULL REFERENCES assets(id) ON DELETE CASCADE`
- `reporter_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE`
- `reason TEXT NOT NULL CHECK reason in approved list`
- `details TEXT`
- `status TEXT NOT NULL CHECK status in ('open','reviewing','resolved','dismissed')`
- `resolution TEXT`
- `resolved_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL`
- `resolved_at TEXT`
- `created_at TEXT NOT NULL DEFAULT now`
- unique open duplicate guard: `(target_type, target_id, reporter_user_id, status)` or application-managed partial index
- indexes: `(status, created_at)`, `(target_type, target_id)`, `(reporter_user_id, created_at)`

### Taxonomy changes

Existing `categories` and `tags` are adequate for first creation/editing if owner routes enforce validation. Add fields only if needed:

- `created_by_user_id`
- `updated_by_user_id`
- optional `status` if taxonomy archiving is required

Migration risks:

- SQLite check constraints require table rebuilds for `submissions.status`.
- Cloudflare D1 migrations must preserve existing auth, collection, and upload-intent rows.
- Existing public asset query code expects `assets.status='published'` and `published_at NOT NULL`.
- Foreign key rebuilds must run `PRAGMA foreign_key_check`.

## 17. Security Threat Analysis

Required controls:

- Every moderation page and API must call a server-side `requireModerator` or `requireOwner`.
- Never trust client-provided role, owner ID, actor ID, status, Cloudinary folder, or public ID.
- Ordinary users must receive 404/403 without target metadata for moderation resources.
- Mutation endpoints must enforce Origin/Referer same-origin checks and JSON/form body size limits.
- Use conditional updates for state transitions to prevent double approve/reject.
- Never serialize Cloudinary API secrets, Discord secrets, session secrets, bootstrap allowlists, session token hashes, OAuth state hashes, or private Discord identifiers into HTML or client JavaScript.
- Event metadata must not include raw session tokens, OAuth codes, Cloudinary API credentials, full request headers, IP addresses unless a policy is approved, or Discord access tokens.
- Role removal should revoke active sessions or force re-check on every request so stale sessions do not retain privileges.
- Reports need reporter rate limits before anonymous reports are allowed.
- Cloudinary copy/delete operations must verify namespace and target public ID before action.
- Errors should be safe and generic for users; logs can include opaque IDs but not secrets.

## 18. Testing Plan

Required automated tests:

- Migration shape for role, event, report, submission-state, asset-link, and taxonomy changes.
- Auth helper tests for ordinary user, moderator, owner, revoked membership, disabled account, and bootstrap allowlist.
- Negative route/API tests proving ordinary users and signed-out users cannot view queues, detail pages, reports, history, or mutate moderation state.
- Repository tests for queue listing, detail reads, metadata edits, approval, rejection, taxonomy creation, role revocation, and event inserts.
- State-transition tests for every allowed and forbidden transition.
- Concurrency tests proving two moderators cannot both approve/reject the same submission.
- Cloudinary service tests for safe pending-to-published namespace behavior and cleanup failures.
- Event-log tests proving append-only behavior and structured diffs.
- Report tests once reports are implemented: duplicate prevention, rate limits, owner privacy, resolution outcomes.
- UI/source tests proving no secrets or bootstrap allowlists are serialized to client code.
- Production manual verification for owner bootstrap, moderator queue access, ordinary-user denial, taxonomy creation, approval, rejection, and cleanup.

## 19. Production Rollout and Recovery Plan

Rollout:

1. Approve Phase 13 decisions.
2. Implement migrations locally and run repeat migration checks.
3. Deploy preview and verify signed-out and ordinary-user denial.
4. Apply preview migration and test with preview-compatible auth only where possible.
5. Apply production migration.
6. Set bootstrap moderator allowlist in Cloudflare without printing values.
7. Deploy production.
8. Sign in as owner, create durable owner membership, and verify access.
9. Create real taxonomy.
10. Submit a test image, approve it, verify public asset appears, then test rejection on a second harmless image.

Recovery:

- D1 success and Cloudinary failure: keep current state, write cleanup event, expose retry to owner.
- Cloudinary success and D1 failure: delete copied published resource; if deletion fails, record operator cleanup target without exposing secrets.
- Duplicate moderator action: return conflict and reload state.
- Accidental approval: archive the published asset; do not delete event history.
- Accidental rejection: allow owner-only reopen only if media still exists; otherwise require resubmission.
- Incorrect taxonomy: owner edits taxonomy assignment and writes event.
- Compromised moderator: revoke membership, revoke active sessions for that user, review event history.
- Role revocation: set membership `revoked_at`, write event, clear/revoke sessions.
- Orphaned pending or published media: owner cleanup tool lists D1/Cloudinary mismatches by namespace.
- Incomplete deployment: keep routes hidden until migration and env bootstrap are present; fail closed.

## 20. USER DECISIONS REQUIRED

1. Approve or reject the hybrid authorization model: Cloudflare server-side bootstrap allowlist plus D1 `moderator_memberships`.
2. Decide whether Phase 13 roles should be only `owner` and `moderator`, or whether a separate `admin` role is needed immediately.
3. Decide whether the bootstrap allowlist should remain as break-glass recovery after owner membership is created.
4. Approve the initial moderator assignment process that avoids committing Discord IDs to Git.
5. Decide whether approval should immediately publish public assets or stop at an internal `approved` state for a later publishing phase.
6. Approve the Cloudinary publish strategy: copy to published namespace, insert D1 asset, then delete pending media.
7. Choose whether rejected media is deleted immediately or retained for a defined review period.
8. Decide whether submitters can see rejection reasons in Phase 13.
9. Decide whether rejected submissions can ever be reopened or must require resubmission.
10. Decide whether archive is included in Phase 13 or deferred until after public publishing exists.
11. Decide whether reports are implemented now or deferred until published assets exist.
12. Decide whether reports are signed-in only for Phase 13.
13. Approve owner-only taxonomy management as part of Phase 13.
14. Define the first real production categories and tags, or approve publishing uncategorized assets.
15. Decide whether moderators may edit asset type, or whether asset type is immutable after submission.
16. Confirm media replacement remains prohibited.
17. Approve append-only moderation events with no delete path.
18. Decide whether role revocation should revoke all active sessions for that user.
19. Decide whether moderation history is visible to submitters for their own submissions or moderator-only.
20. Approve the production rollout order, including preview limitations and manual owner bootstrap verification.
