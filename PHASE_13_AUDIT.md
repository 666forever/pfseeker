# Phase 13 Pre-Merge Audit

Audit branch: `phase-13-moderation-audit`  
Implementation commit audited: `96f2e7c11d63107e9f8f05c82b4cebdb4392ddaa`  
Main baseline: `5c6019ebb44e50492e94ea415a8126cf2474dc06`  
Audit fix commit: `da78c9b fix: harden Phase 13 moderation workflows`

## 1. Executive Verdict

Phase 13 is directionally correct but the original implementation commit had merge-blocking defects in owner bootstrap/revocation and publication/rejection atomicity. Those confirmed blockers were fixed on this audit branch.

After the audit fix, no known merge blocker remains in source, migration, authorization, or generated browser output. Production rollout is not recommended until this audit branch is reviewed, merged back into the implementation branch, preview is revalidated, production bootstrap configuration is set outside Git, and the production migration is applied during an approved rollout window.

Phase 14 has not started.

## 2. Merge Blockers

Fixed:

- Revoked allowlisted owner could regain owner access while another active owner existed.
- Last active owner membership could be revoked with no safeguard.
- Publication changed `submissions.status` before the D1 batch that inserted the asset, taxonomy, and events.
- Rejection changed `submissions.status` before writing the rejection event.
- Metadata edits could delete and rewrite submission tags after a concurrent status transition.

Remaining:

- None known after `da78c9b`.

## 3. High-Risk Findings

Fixed high-risk findings:

- Bootstrap/revocation ambiguity: the explicit rule is now that a revoked allowlisted user cannot bootstrap again while at least one active owner exists. Break-glass bootstrap remains available only when there are zero active owners.
- Last-owner protection: revoking an owner now fails when it would remove the final active owner.
- Publication atomicity: publication now performs the conditional submission transition, asset insert, taxonomy inserts, and publish events in one D1 batch with conditional inserts. The copied Cloudinary resource is rolled back when D1 publication fails.
- Rejection event atomicity: rejection transition and event insert now run in one D1 batch.
- Metadata concurrency: metadata updates, tag rewrites, and events are conditional on the submission still being `pending` or `approved`.

## 4. Medium-Risk Findings

- `src/server/repositories/moderation.ts` is oversized at 1,507 lines after the audit fix. It combines memberships, authorization support, submission review, taxonomy, publication persistence, archive, and event persistence. This is not a merge blocker after the audit fixes, but it should be decomposed before Phase 14 into narrower repository modules:
  - moderation memberships
  - moderation submissions
  - taxonomy
  - moderation events
  - publication persistence
  - asset archival
- Authenticated moderation preview verification is still blocked by arbitrary preview OAuth limitations. Signed-out preview protection is verifiable; authenticated role behavior is covered locally and by repository tests.
- Cloudinary failure combinations are audited by control-flow review and source tests, but not all combinations have network-level integration tests because production Cloudinary must not be mutated by the audit.

## 5. Low-Risk Findings

- The first Git-triggered Cloudflare preview URL for `96f2e7c1` appeared as Active in Wrangler but returned Cloudflare "Deployment Not Found" immediately after creation. A manual Pages deploy initially behaved the same, then propagated to `200 OK`. Evidence points to Pages preview hostname propagation rather than an app-level routing failure.
- Full repository formatting still fails on the known baseline. Targeted Prettier checks pass for files changed by Phase 13.

## 6. Diff Inventory

Compared `5c6019ebb44e50492e94ea415a8126cf2474dc06` to audit branch `HEAD`:

- 47 files changed.
- 4,469 lines added, 132 lines deleted.
- Production code and migration lines added: 3,771.
- Test lines added: 511.

Source files added or modified:

- `.env.example`
- `migrations/0006_moderation_and_publishing.sql`
- `src/lib/submissions.ts`
- `src/pages/api/moderation/assets/[assetId]/archive.ts`
- `src/pages/api/moderation/bootstrap.ts`
- `src/pages/api/moderation/members.ts`
- `src/pages/api/moderation/members/[membershipId]/revoke.ts`
- `src/pages/api/moderation/submissions/[submissionId]/approve.ts`
- `src/pages/api/moderation/submissions/[submissionId]/metadata.ts`
- `src/pages/api/moderation/submissions/[submissionId]/reject.ts`
- `src/pages/api/moderation/taxonomy/categories.ts`
- `src/pages/api/moderation/taxonomy/categories/[categoryId].ts`
- `src/pages/api/moderation/taxonomy/tags.ts`
- `src/pages/api/moderation/taxonomy/tags/[tagId].ts`
- `src/pages/api/submissions/[submissionId].ts`
- `src/pages/faq.astro`
- `src/pages/moderation/history.astro`
- `src/pages/moderation/index.astro`
- `src/pages/moderation/members.astro`
- `src/pages/moderation/submissions/[submissionId].astro`
- `src/pages/moderation/submissions/index.astro`
- `src/pages/moderation/taxonomy.astro`
- `src/pages/privacy.astro`
- `src/pages/submissions/[submissionId].astro`
- `src/pages/submissions/index.astro`
- `src/pages/terms.astro`
- `src/server/auth/moderation.ts`
- `src/server/db/d1.ts`
- `src/server/repositories/auth.ts`
- `src/server/repositories/moderation.ts`
- `src/server/repositories/submissions.ts`
- `src/server/services/cloudinary.ts`
- `src/server/services/moderation-api.ts`
- `src/server/services/publication.ts`
- `tests/moderation.test.ts`
- `tests/moderation-behavior.test.ts`
- `tests/submissions.test.ts`

API endpoints added:

- `POST /api/moderation/bootstrap`
- `POST /api/moderation/members`
- `POST /api/moderation/members/[membershipId]/revoke`
- `POST /api/moderation/submissions/[submissionId]/metadata`
- `POST /api/moderation/submissions/[submissionId]/approve`
- `POST /api/moderation/submissions/[submissionId]/reject`
- `POST /api/moderation/taxonomy/categories`
- `POST /api/moderation/taxonomy/categories/[categoryId]`
- `POST /api/moderation/taxonomy/tags`
- `POST /api/moderation/taxonomy/tags/[tagId]`
- `POST /api/moderation/assets/[assetId]/archive`

Privileged routes added:

- `/moderation`
- `/moderation/submissions`
- `/moderation/submissions/[submissionId]`
- `/moderation/taxonomy`
- `/moderation/history`
- `/moderation/members`

D1 changes:

- Added `moderator_memberships`.
- Added `moderation_events`.
- Rebuilt `submissions` to support `pending`, `approved`, `published`, `rejected`.
- Added review, publication, rejection, cleanup, and version columns to `submissions`.
- Added submitted-asset metadata and archive columns to `assets`.
- Added taxonomy actor columns to `categories` and `tags`.
- Recreated submission indexes, including user/status and published-asset indexes.
- Added membership and moderation-event indexes.

Cloudinary operations added:

- Published namespace creation: `pfseeker/published/{kind}/{assetId}`.
- Published namespace validation.
- Pending-to-published copy through Cloudinary upload API using server-side signature.
- Pending-media deletion after successful publication.
- Copied-resource rollback deletion when D1 publication fails.
- Pending-media deletion after rejection.

## 7. Migration Audit

`migrations/0006_moderation_and_publishing.sql` preserves existing users, sessions, collections, collection items, upload intents, submissions, submission tags, and suggested tags.

The migration:

- does not seed production data
- keeps `submissions.category_id` nullable
- keeps `cloudinary_public_id` nullable after review cleanup
- recreates submission indexes
- preserves unique `cloudinary_public_id`
- expands submission status checks to `pending`, `approved`, `published`, `rejected`
- adds explicit cleanup-state checks
- runs `PRAGMA foreign_key_check`
- drops the old `submissions` table and renames `submissions_new`, leaving no `submissions_new` table

Isolated fixture proof:

- Applied migrations 0001 through 0005 to a temporary SQLite database.
- Inserted one user, one active session, one collection, one collection item, two upload intents, two pending submissions, one taxonomy-backed submission, one zero-taxonomy submission, one submission tag, and one suggested tag.
- Applied 0006.
- Verified pre/post counts matched:
  - users: 1
  - sessions: 1
  - collections: 1
  - collection_items: 1
  - submission_upload_intents: 2
  - submissions: 2
  - submission_tags: 1
  - submission_suggested_tags: 1
- Verified `PRAGMA foreign_key_check` returned no rows.
- Verified zero-taxonomy submission remained `pending` with `category_id = NULL`.
- Verified taxonomy-backed submission preserved its category.
- Verified `moderator_memberships` and `moderation_events` exist.
- Verified no `submissions_new` table remains.

Rollback/recovery:

- Before applying 0006 remotely, export D1 schema and data with Wrangler.
- If migration fails before completion, do not run production traffic on the partially migrated DB; restore from export or use a cloned recovery database.
- If application deployment fails after migration, roll back the Pages deployment while keeping 0006; the schema is backward compatible for Phase 12 owner reads because new columns have defaults/nulls and existing rows are preserved.

## 8. Authorization Audit

Moderation pages and APIs call `requireModerator` or `requireOwner` server-side. Role values come only from active D1 memberships or the server-only bootstrap allowlist. Forms and JSON bodies cannot set actor IDs or roles for the current request.

Verified:

- signed-out HTML moderation routes redirect to Discord auth
- unauthorized moderation access returns generic not-found or generic JSON errors
- ordinary users are denied unless they have active membership or eligible bootstrap status
- disabled accounts cannot bootstrap because `requireModerator` requires `accountStatus === "active"` for bootstrap
- revoked memberships are ignored by `findActiveMembership`
- mutation endpoints call `assertSameOriginMutation`
- request bodies are bounded by shared `readRequestBody`
- unsupported methods return 405
- target owner IDs are not accepted from clients

Owner-only APIs:

- bootstrap
- membership create
- membership revoke
- taxonomy create/update/delete
- archive

Moderator APIs:

- submission metadata edit
- approval/publication
- rejection
- history/read queues

## 9. Bootstrap Audit

`MODERATOR_BOOTSTRAP_DISCORD_IDS` is read only through `getCloudflareRuntimeEnv` in server code. Parsing trims whitespace and accepts only exact `17` to `20` digit Discord IDs. Empty or malformed values grant nothing. Substring matching is impossible because values are split on commas and matched through a `Set`.

Safe rule implemented in `da78c9b`:

- Active durable membership always wins.
- Allowlisted bootstrap can create an owner membership only if the user has no revoked membership, or if there are zero active owners.
- If an allowlisted owner membership is revoked while another owner remains, the allowlist does not immediately restore access.
- If all active owners are lost, the allowlist remains break-glass recovery.
- Repeated bootstrap with an active membership is idempotent and does not write duplicate events.

## 10. Membership And Session-Revocation Audit

Only owners can create or revoke memberships. Duplicate active memberships are blocked by the partial unique index `idx_moderator_memberships_active_user`.

Fixed:

- Last active owner revocation is blocked.
- Revocation retains the membership row and writes `membership.revoke`.
- Revocation endpoint deletes active sessions for the revoked user through `AuthRepository.revokeActiveSessionsForUser`.

Current request behavior:

- If an owner revokes another user's membership, the target loses access on the next request because sessions are revoked.
- If a user self-revokes while another owner exists, the current response can finish, but all active sessions for that user are revoked before the next request.

## 11. Moderation-Event Audit

Events are append-only by API design. There are no update/delete event endpoints.

Covered events:

- `membership.bootstrap_owner`
- `membership.create`
- `membership.revoke`
- `submission.metadata_update`
- `category.create`
- `category.update`
- `category.delete`
- `tag.create`
- `tag.update`
- `tag.delete`
- `submission.approve`
- `submission.publish`
- `publication.pending_cleanup_deleted`
- `publication.pending_cleanup_failed`
- `publication.copied_resource_cleanup_failed`
- `submission.reject`
- `rejection.pending_cleanup_deleted`
- `rejection.pending_cleanup_failed`
- `asset.archive`

Actor IDs come from the authenticated session. Event filters are parameterized. History rendering uses Astro escaping. The submitter pages do not render moderation events, moderator identity, or internal notes.

Remaining quality issue:

- Metadata diff currently stores before/after snapshots, not a minimal changed-field diff. This is acceptable for merge but should be reduced when repository modules are split.

## 12. Taxonomy Audit

Owner-only taxonomy operations validate names, slugs, collision handling, and supported kinds. Category kinds are restricted to `pfp`, `banner`, and `icon`; empty supported kind sets are rejected. Tag/category slugs are generated server-side and collision-handled.

Referenced category/tag deletion is blocked by counting references from assets and submissions. Client input cannot set actor IDs.

Publication requires:

- one valid category
- category supports submission kind
- at least one valid tag
- no fake taxonomy creation

## 13. Metadata-Edit Audit

Moderators may edit only:

- title
- description
- category
- tags
- creator credit
- source URL

They cannot edit owner, asset type, content hash, media metadata, Cloudinary public IDs, suggested-tag originals, status directly, review actor, or publication linkage.

Text validation uses the same normalization and control-character rejection helpers as intake. Source URLs must be HTTP or HTTPS.

Fixed:

- Metadata update, tag rewrite, and event insert are now conditional on the submission still being `pending` or `approved`.

## 14. Publication Failure Matrix

The system cannot make D1 and Cloudinary one atomic transaction. The service now uses a safe copy-then-commit-then-cleanup model.

| Case                                      | Final D1 state                                        | Final Cloudinary state                           | User/moderator result                | Retry/recovery                                               |
| ----------------------------------------- | ----------------------------------------------------- | ------------------------------------------------ | ------------------------------------ | ------------------------------------------------------------ |
| A. Copy fails before D1                   | submission remains pending                            | pending remains, no published copy               | safe error                           | retry approve                                                |
| B. D1 write fails after copy              | submission remains pending after rollback path        | copied resource deletion attempted               | safe error                           | retry after cleanup                                          |
| C. Copied rollback deletion fails         | pending unchanged, cleanup event recorded             | pending plus orphan copied resource              | safe error, event visible            | operator cleanup                                             |
| D. D1 succeeds but pending deletion fails | submission published, cleanup status `cleanup_failed` | published copy plus pending original             | success path returns, recovery event | operator cleanup                                             |
| E. Event insert fails                     | D1 batch fails and rolls back publication             | copied resource deletion attempted               | safe error                           | retry approve                                                |
| F. Asset taxonomy insert fails            | D1 batch fails and rolls back publication             | copied resource deletion attempted               | safe error                           | fix taxonomy/retry                                           |
| G. Submission transition/link fails       | conditional inserts do not create asset/events        | copied resource deletion attempted               | safe error                           | reload/retry if still pending                                |
| H. Response fails after success           | submission published                                  | published copy exists; pending cleanup attempted | user may see network error           | idempotency via status/asset link prevents duplicate publish |

Publication now conditionally prevents duplicate published content hash and uses unique asset slug constraints for slug collision safety. If a concurrent publish wins, the losing request fails safely and rolls back the copied Cloudinary resource where possible.

## 15. Rejection Failure Matrix

| Case                                      | Final D1 state                                    | Final Cloudinary state          | Result                              | Recovery                        |
| ----------------------------------------- | ------------------------------------------------- | ------------------------------- | ----------------------------------- | ------------------------------- |
| D1 transition/event fails                 | pending                                           | pending media remains           | safe error                          | retry reject                    |
| Cloudinary deletion fails after D1 reject | rejected, cleanup failed                          | pending media may remain        | safe completion with recovery event | operator cleanup                |
| two moderators reject                     | one transition wins                               | pending deletion attempted once | loser gets safe changed-state error | no duplicate state              |
| reject races approve                      | one status transition wins                        | loser fails safe                | reload queue                        | no direct media leak from loser |
| reject races cancel                       | conditional status/delete paths decide one winner | failed deletion retains D1 row  | safe error or normal cancel         | reload                          |
| repeated reject                           | rejected state blocks repeat                      | no extra deletion               | safe error                          | none                            |

The implementation transitions D1 before deleting Cloudinary pending media. This avoids a pending row pointing to deleted media if D1 fails.

## 16. Concurrency Audit

Fixed:

- Publish no longer updates submission outside the publication batch.
- Reject no longer updates submission outside the event batch.
- Metadata tag rewrites are conditional.
- Last-owner revoke is blocked.

Remaining limitation:

- There is no explicit user-visible optimistic concurrency token on the moderation form. The repository uses conditional status checks; stale forms fail safely if the status has changed.

## 17. Archive And Collection Behavior

Archive is owner-only and only updates `assets.status = 'archived'` when current status is `published`. It retains Cloudinary media, taxonomy, content hash, and history. No restore endpoint exists.

Public D1 repository queries filter published assets, so galleries, search, and public detail routes exclude archived rows. Existing private collections resolve assets through the public asset repository; archived collection items therefore become unresolved/missing rather than downloadable. Existing collection ZIP behavior reports unresolved items and does not include unavailable assets.

This behavior is safe, but should be documented in `COLLECTIONS.md` before production archive usage.

## 18. Public Repository Compatibility

Published submission rows include the required public asset fields:

- `id`
- `slug`
- `kind`
- `title`
- `alt_text`
- `media_source_type = cloudinary`
- `durable_media_ref`
- `cloudinary_public_id`
- dimensions
- format
- animation
- palette JSON
- motif
- status
- timestamps
- content hash

Public gallery/search/detail routes should be able to read published assets through the existing D1 repository. The seed-only `motif`/palette values are generic placeholders for submitted assets but satisfy current public rendering requirements.

## 19. UI And Accessibility Audit

Manual source inspection found:

- moderation pages are real protected pages, not placeholder dashboards
- pages are marked `noindex`
- queue filters exist for status, kind, and duplicate flag
- empty states are distinct from auth redirects
- suggested tags are rendered separately from assigned tags
- internal rejection note and public reason labels are explicit
- history values are rendered through Astro escaping

Not fully verified in this audit:

- authenticated browser moderation UI with real Discord OAuth, because arbitrary preview OAuth remains unsupported
- mobile visual overlap via screenshot tooling
- keyboard focus restoration after mutations, because current forms navigate rather than dialog-confirm

## 20. Test-Quality Classification

Before audit fixes:

- Phase 13 source-text/schema assertions: 10
- Behavioral tests specific to Phase 13 authorization/membership: 0
- Migration execution tests in the automated suite: 0
- UI/E2E tests: 0

After audit fixes:

- Phase 13 source-text/schema assertions: 10
- Behavioral repository tests: 5
- Migration execution proof: 1 isolated fixture script run during audit, not part of `npm run test`
- UI/E2E tests: 0

Final suite after the audit fix:

- 10 test files
- 110 tests

Coverage is meaningfully better than the implementation commit, but future work should add integration tests for publication/rejection with a D1-compatible harness and Cloudinary failure simulation.

## 21. Secret-Boundary Audit

Generated browser asset scan found no matches for:

- `CLOUDINARY_API_SECRET`
- `DISCORD_CLIENT_SECRET`
- `SESSION_SECRET`
- `MODERATOR_BOOTSTRAP_DISCORD_IDS`
- `pfseeker_session`
- `client_secret`
- `api_secret`

Server bundle chunks contain expected environment variable names and server code paths. No values were found or printed.

No source maps containing secrets were generated for browser assets.

## 22. Preview Findings

Git-triggered preview for `96f2e7c1` was listed Active but initially returned Cloudflare "Deployment Not Found" on the short deployment hostname. A manual Pages deploy produced `https://06f48a33.pfseeker.pages.dev`, which also returned 404 immediately and then propagated to `200 OK`.

Verified after propagation:

- `/`: 200
- `/pfps`: 200
- `/submissions`: 302 to Discord auth
- `/submissions/new`: 302 to Discord auth
- `/moderation`: 302 to Discord auth
- `/moderation/submissions`: 302 to Discord auth
- `/moderation/taxonomy`: 302 to Discord auth
- `/moderation/history`: 302 to Discord auth
- `/moderation/members`: 302 to Discord auth

Conclusion: the observed 404 was consistent with Pages preview hostname propagation, not an Astro routing or SSR packaging failure.

## 23. Exact Fixes Made

Commit `da78c9b`:

- Added `ModerationRepository.canBootstrapOwner`.
- Updated `requireModerator` to allow bootstrap owner access only when `canBootstrapOwner` passes.
- Blocked revoked allowlisted users from bootstrapping while an active owner exists.
- Preserved break-glass bootstrap when no active owners exist.
- Blocked final active owner revocation.
- Moved publication status/link update into the D1 batch.
- Added conditional asset, taxonomy, submission-tag, and event inserts for publication.
- Added duplicate published content-hash protection at publication time.
- Moved rejection transition and event insert into one D1 batch.
- Made metadata tag rewrites/events conditional on editable status.
- Added behavioral tests for bootstrap idempotency, revoked allowlist behavior, break-glass recovery, last-owner protection, and owner revocation history.

## 24. Remaining Manual Production Steps

Do not start these until merge approval:

1. Merge the audited branch changes into the Phase 13 implementation branch or replace the implementation branch with the audit branch.
2. Re-run validation on the final merge candidate.
3. Configure `MODERATOR_BOOTSTRAP_DISCORD_IDS` in Cloudflare production environment, outside Git.
4. Apply production migration `0006_moderation_and_publishing.sql`.
5. Verify production schema and no report tables.
6. Sign in as the bootstrap owner and create the durable owner membership.
7. Remove or retain bootstrap allowlist according to the operational recovery policy.
8. Manually verify owner, moderator, ordinary, disabled, and revoked-user behavior in production.
9. Manually verify approve/publish, reject, archive, and submitter-facing lifecycle behavior.

## 25. Production Rollout Recommendation

Recommended only after:

- the audit fix commit is included in the merge candidate
- final validation passes
- production bootstrap value is configured out of band
- an owner is available to run bootstrap immediately after deployment
- production migration and rollback plan are accepted

No production migration was applied during this audit.
