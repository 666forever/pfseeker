import type { AssetKind } from "@/lib/media";
import {
  includesControlCharacter,
  MAX_SELECTED_TAGS,
  normalizeSubmissionText,
  validateSourceUrl,
  type SubmissionStatus,
} from "@/lib/submissions";
import type { D1DatabaseLike } from "@/server/db/d1";
import {
  InvalidRepositoryInputError,
  NotFoundError,
} from "@/server/repositories/errors";
import type { PendingSubmission } from "@/server/repositories/submissions";
import { SubmissionRepository } from "@/server/repositories/submissions";

export type ModeratorRole = "owner" | "moderator";
export type MembershipStatus = "active" | "revoked";
export type ModerationTargetType =
  "submission" | "asset" | "category" | "tag" | "moderator_membership";

export interface ModeratorMembership {
  id: string;
  userId: string;
  role: ModeratorRole;
  status: MembershipStatus;
  createdByUserId: string | null;
  createdAt: string;
  revokedByUserId: string | null;
  revokedAt: string | null;
  reason: string | null;
}

export interface ModerationEvent {
  id: string;
  actorUserId: string | null;
  targetType: ModerationTargetType;
  targetId: string;
  action: string;
  previousState: string | null;
  newState: string | null;
  metadataJson: string;
  reason: string | null;
  createdAt: string;
}

export interface ModerationSubmission extends PendingSubmission {
  submitter: {
    id: string;
    username: string;
    globalName: string | null;
  };
}

export interface ModerationCategory {
  id: string;
  slug: string;
  name: string;
  description: string;
  kinds: AssetKind[];
}

export interface ModerationTag {
  id: string;
  slug: string;
  displayName: string;
}

export interface ModeratedMetadataInput {
  title: unknown;
  description: unknown;
  category: unknown;
  tags: unknown;
  creatorCredit: unknown;
  sourceUrl: unknown;
}

export interface ModeratedMetadata {
  title: string;
  description: string | null;
  categoryId: string;
  categorySlug: string;
  tagIds: string[];
  tagSlugs: string[];
  creatorCredit: string | null;
  sourceUrl: string | null;
}

interface MembershipRow {
  id: string;
  user_id: string;
  role: string;
  status: string;
  created_by_user_id: string | null;
  created_at: string;
  revoked_by_user_id: string | null;
  revoked_at: string | null;
  reason: string | null;
}

interface EventRow {
  id: string;
  actor_user_id: string | null;
  target_type: ModerationTargetType;
  target_id: string;
  action: string;
  previous_state: string | null;
  new_state: string | null;
  metadata_json: string;
  reason: string | null;
  created_at: string;
}

interface CategoryRow {
  id: string;
  slug: string;
  name: string;
  description: string;
  supported_kinds: string;
}

interface TagRow {
  id: string;
  slug: string;
  display_name: string;
}

function assertId(value: string, label: string): void {
  if (!/^[0-9a-fA-F-]{36}$/.test(value)) {
    throw new InvalidRepositoryInputError(`${label} is malformed.`);
  }
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

function parseAssetKind(value: string): AssetKind {
  if (value === "pfp" || value === "banner" || value === "icon") return value;
  throw new InvalidRepositoryInputError("Unsupported asset type.");
}

function parseKinds(value: string): AssetKind[] {
  const kinds = value
    .split(",")
    .map((entry) => parseAssetKind(entry.trim()))
    .filter(Boolean);
  return Array.from(new Set(kinds));
}

function optionalText(
  value: unknown,
  maxLength: number,
  label: string,
): string | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") {
    throw new InvalidRepositoryInputError(`${label} must be text.`);
  }
  const normalized = normalizeSubmissionText(value);
  if (!normalized) return null;
  if (normalized.length > maxLength || includesControlCharacter(normalized)) {
    throw new InvalidRepositoryInputError(
      `${label} is too long or contains unsupported characters.`,
    );
  }
  return normalized;
}

function requiredText(
  value: unknown,
  minLength: number,
  maxLength: number,
  label: string,
): string {
  const text = optionalText(value, maxLength, label);
  if (!text || text.length < minLength) {
    throw new InvalidRepositoryInputError(
      `${label} must be ${minLength} to ${maxLength} characters.`,
    );
  }
  return text;
}

function normalizeStringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    if (!value.every((entry) => typeof entry === "string")) {
      throw new InvalidRepositoryInputError("Expected text values.");
    }
    return value.map(normalizeSubmissionText).filter(Boolean);
  }
  if (typeof value === "string") {
    return value.split(",").map(normalizeSubmissionText).filter(Boolean);
  }
  return [];
}

function mapMembership(row: MembershipRow): ModeratorMembership {
  if (row.role !== "owner" && row.role !== "moderator") {
    throw new InvalidRepositoryInputError("Invalid moderator role.");
  }
  if (row.status !== "active" && row.status !== "revoked") {
    throw new InvalidRepositoryInputError("Invalid membership status.");
  }
  return {
    id: row.id,
    userId: row.user_id,
    role: row.role,
    status: row.status,
    createdByUserId: row.created_by_user_id,
    createdAt: row.created_at,
    revokedByUserId: row.revoked_by_user_id,
    revokedAt: row.revoked_at,
    reason: row.reason,
  };
}

function mapEvent(row: EventRow): ModerationEvent {
  return {
    id: row.id,
    actorUserId: row.actor_user_id,
    targetType: row.target_type,
    targetId: row.target_id,
    action: row.action,
    previousState: row.previous_state,
    newState: row.new_state,
    metadataJson: row.metadata_json,
    reason: row.reason,
    createdAt: row.created_at,
  };
}

function mapCategory(row: CategoryRow): ModerationCategory {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    kinds: parseKinds(row.supported_kinds),
  };
}

function mapTag(row: TagRow): ModerationTag {
  return {
    id: row.id,
    slug: row.slug,
    displayName: row.display_name,
  };
}

export class ModerationRepository {
  private readonly submissions: SubmissionRepository;

  constructor(private readonly db: D1DatabaseLike) {
    this.submissions = new SubmissionRepository(db);
  }

  async findActiveMembership(
    userId: string,
  ): Promise<ModeratorMembership | null> {
    const row = await this.db
      .prepare(
        `SELECT id, user_id, role, status, created_by_user_id, created_at,
          revoked_by_user_id, revoked_at, reason
         FROM moderator_memberships
         WHERE user_id = ? AND status = 'active'`,
      )
      .bind(userId)
      .first<MembershipRow>();
    return row ? mapMembership(row) : null;
  }

  async canBootstrapOwner(userId: string): Promise<boolean> {
    const [activeOwnerCount, revokedSelf] = await Promise.all([
      this.countActiveOwners(),
      this.hasRevokedMembership(userId),
    ]);
    return activeOwnerCount === 0 || !revokedSelf;
  }

  async listMemberships(): Promise<ModeratorMembership[]> {
    const { results } = await this.db
      .prepare(
        `SELECT id, user_id, role, status, created_by_user_id, created_at,
          revoked_by_user_id, revoked_at, reason
         FROM moderator_memberships
         ORDER BY status ASC, role ASC, created_at DESC`,
      )
      .all<MembershipRow>();
    return results.map(mapMembership);
  }

  async createMembership(input: {
    actorUserId: string;
    userId: string;
    role: ModeratorRole;
    reason?: string | null;
  }): Promise<ModeratorMembership> {
    assertId(input.userId, "User ID");
    const existing = await this.findActiveMembership(input.userId);
    if (existing) {
      throw new InvalidRepositoryInputError("User already has an active role.");
    }
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const reason = optionalText(input.reason ?? null, 500, "Reason");
    await this.db.batch([
      this.db
        .prepare(
          `INSERT INTO moderator_memberships (
            id, user_id, role, status, created_by_user_id, created_at, reason
          ) VALUES (?, ?, ?, 'active', ?, ?, ?)`,
        )
        .bind(id, input.userId, input.role, input.actorUserId, now, reason),
      this.eventStatement({
        actorUserId: input.actorUserId,
        targetType: "moderator_membership",
        targetId: id,
        action: "membership.create",
        previousState: null,
        newState: input.role,
        metadata: { userId: input.userId },
        reason,
        createdAt: now,
      }),
    ]);
    return (await this.findActiveMembership(input.userId))!;
  }

  async bootstrapOwner(userId: string): Promise<ModeratorMembership> {
    const existing = await this.findActiveMembership(userId);
    if (existing) return existing;
    if (!(await this.canBootstrapOwner(userId))) {
      throw new InvalidRepositoryInputError(
        "Bootstrap is unavailable for this account.",
      );
    }
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    await this.db.batch([
      this.db
        .prepare(
          `INSERT INTO moderator_memberships (
            id, user_id, role, status, created_by_user_id, created_at, reason
          ) VALUES (?, ?, 'owner', 'active', ?, ?, ?)`,
        )
        .bind(id, userId, userId, now, "Owner bootstrap allowlist"),
      this.eventStatement({
        actorUserId: userId,
        targetType: "moderator_membership",
        targetId: id,
        action: "membership.bootstrap_owner",
        previousState: null,
        newState: "owner",
        metadata: {},
        reason: "Owner bootstrap allowlist",
        createdAt: now,
      }),
    ]);
    return (await this.findActiveMembership(userId))!;
  }

  async revokeMembership(input: {
    actorUserId: string;
    membershipId: string;
    reason: unknown;
  }): Promise<ModeratorMembership> {
    assertId(input.membershipId, "Membership ID");
    const reason = requiredText(input.reason, 2, 500, "Revocation reason");
    const membership = await this.readMembership(input.membershipId);
    if (membership.status === "revoked") return membership;
    if (membership.role === "owner" && (await this.countActiveOwners()) <= 1) {
      throw new InvalidRepositoryInputError(
        "At least one active owner membership must remain.",
      );
    }
    const now = new Date().toISOString();
    await this.db.batch([
      this.db
        .prepare(
          `UPDATE moderator_memberships
           SET status = 'revoked', revoked_by_user_id = ?, revoked_at = ?, reason = ?
           WHERE id = ? AND status = 'active'`,
        )
        .bind(input.actorUserId, now, reason, input.membershipId),
      this.eventStatement({
        actorUserId: input.actorUserId,
        targetType: "moderator_membership",
        targetId: input.membershipId,
        action: "membership.revoke",
        previousState: membership.role,
        newState: "revoked",
        metadata: { userId: membership.userId },
        reason,
        createdAt: now,
      }),
    ]);
    return this.readMembership(input.membershipId);
  }

  async readMembership(membershipId: string): Promise<ModeratorMembership> {
    const row = await this.db
      .prepare(
        `SELECT id, user_id, role, status, created_by_user_id, created_at,
          revoked_by_user_id, revoked_at, reason
         FROM moderator_memberships
         WHERE id = ?`,
      )
      .bind(membershipId)
      .first<MembershipRow>();
    if (!row) throw new NotFoundError("Membership was not found.");
    return mapMembership(row);
  }

  async listSubmissions(input: {
    status?: SubmissionStatus | "all";
    kind?: AssetKind | "all";
    duplicate?: "all" | "yes" | "no";
    limit?: number;
  }): Promise<ModerationSubmission[]> {
    const clauses: string[] = [];
    const values: unknown[] = [];
    if (input.status && input.status !== "all") {
      clauses.push("submissions.status = ?");
      values.push(input.status);
    }
    if (input.kind && input.kind !== "all") {
      clauses.push("submissions.asset_type = ?");
      values.push(input.kind);
    }
    if (input.duplicate === "yes") clauses.push("duplicate_pending_flag = 1");
    if (input.duplicate === "no") clauses.push("duplicate_pending_flag = 0");
    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    const limit = Math.min(Math.max(input.limit ?? 50, 1), 100);
    const { results } = await this.db
      .prepare(
        `${this.moderationSubmissionSelect()}
         ${where}
         ORDER BY submissions.created_at DESC, submissions.id DESC
         LIMIT ${limit}`,
      )
      .bind(...values)
      .all<ModerationSubmissionRow>();
    return Promise.all(results.map((row) => this.hydrateModerationRow(row)));
  }

  async readSubmission(submissionId: string): Promise<ModerationSubmission> {
    assertId(submissionId, "Submission ID");
    const row = await this.db
      .prepare(
        `${this.moderationSubmissionSelect()}
         WHERE submissions.id = ?`,
      )
      .bind(submissionId)
      .first<ModerationSubmissionRow>();
    if (!row) throw new NotFoundError("Submission was not found.");
    return this.hydrateModerationRow(row);
  }

  async validateModeratedMetadata(
    assetType: AssetKind,
    input: ModeratedMetadataInput,
    options: { requireTags?: boolean } = {},
  ): Promise<ModeratedMetadata> {
    const title = requiredText(input.title, 2, 80, "Title");
    const description = optionalText(input.description, 100, "Description");
    const creatorCredit = optionalText(
      input.creatorCredit,
      80,
      "Creator or credit",
    );
    const sourceUrl = validateSourceUrl(input.sourceUrl);
    if (!sourceUrl.ok) {
      throw new InvalidRepositoryInputError(sourceUrl.message);
    }
    if (typeof input.category !== "string" || !input.category.trim()) {
      throw new InvalidRepositoryInputError("Choose a category.");
    }
    const category = await this.categoryBySlug(input.category.trim());
    if (!category.kinds.includes(assetType)) {
      throw new InvalidRepositoryInputError(
        "Category does not match the asset type.",
      );
    }

    const tagSlugs = Array.from(new Set(normalizeStringList(input.tags)));
    if (tagSlugs.length === 0 && options.requireTags !== false) {
      throw new InvalidRepositoryInputError("Choose at least one tag.");
    }
    if (tagSlugs.length > MAX_SELECTED_TAGS) {
      throw new InvalidRepositoryInputError("Choose no more than 5 tags.");
    }
    const tags = await Promise.all(
      tagSlugs.map((slug) => this.tagBySlug(slug)),
    );
    return {
      title,
      description,
      categoryId: category.id,
      categorySlug: category.slug,
      tagIds: tags.map((tag) => tag.id),
      tagSlugs: tags.map((tag) => tag.slug),
      creatorCredit,
      sourceUrl: sourceUrl.value,
    };
  }

  async updateSubmissionMetadata(input: {
    actorUserId: string;
    submissionId: string;
    metadata: ModeratedMetadata;
  }): Promise<ModerationSubmission> {
    const before = await this.readSubmission(input.submissionId);
    if (before.status !== "pending" && before.status !== "approved") {
      throw new InvalidRepositoryInputError(
        "Only pending or approved submissions can be edited.",
      );
    }
    const now = new Date().toISOString();
    const targetIsEditable = `EXISTS (
      SELECT 1 FROM submissions
      WHERE id = ? AND status IN ('pending', 'approved')
    )`;
    await this.db.batch([
      this.db
        .prepare(
          `UPDATE submissions
           SET submitted_title = ?, description = ?, creator_credit = ?,
             source_url = ?, category_id = ?, review_version = review_version + 1
           WHERE id = ? AND status IN ('pending', 'approved')`,
        )
        .bind(
          input.metadata.title,
          input.metadata.description,
          input.metadata.creatorCredit,
          input.metadata.sourceUrl,
          input.metadata.categoryId,
          input.submissionId,
        ),
      this.db
        .prepare(
          `DELETE FROM submission_tags
           WHERE submission_id = ? AND ${targetIsEditable}`,
        )
        .bind(input.submissionId, input.submissionId),
      ...input.metadata.tagIds.map((tagId) =>
        this.db
          .prepare(
            `INSERT INTO submission_tags (submission_id, tag_id)
             SELECT ?, ?
             WHERE ${targetIsEditable}`,
          )
          .bind(input.submissionId, tagId, input.submissionId),
      ),
      this.conditionalEventStatement({
        actorUserId: input.actorUserId,
        targetType: "submission",
        targetId: input.submissionId,
        action: "submission.metadata_update",
        previousState: before.status,
        newState: before.status,
        metadata: {
          before: metadataSnapshot(before),
          after: input.metadata,
        },
        reason: null,
        createdAt: now,
        conditionSql: targetIsEditable,
        conditionValues: [input.submissionId],
      }),
    ]);
    const after = await this.readSubmission(input.submissionId);
    if (after.status !== "pending" && after.status !== "approved") {
      throw new InvalidRepositoryInputError(
        "Submission changed before metadata could be saved.",
      );
    }
    return after;
  }

  async publishSubmission(input: {
    actorUserId: string;
    submission: ModerationSubmission;
    metadata: ModeratedMetadata;
    assetId: string;
    slug: string;
    publishedPublicId: string;
  }): Promise<void> {
    const now = new Date().toISOString();
    const animation =
      input.submission.cloudinaryFormat === "gif" ? "animated" : "static";
    const assetFormat =
      input.submission.cloudinaryFormat === "jpeg"
        ? "jpg"
        : input.submission.cloudinaryFormat;
    const publishedCondition = `EXISTS (
      SELECT 1 FROM submissions
      WHERE id = ? AND status = 'published' AND published_asset_id = ?
    )`;

    await this.db.batch([
      this.db
        .prepare(
          `UPDATE submissions
           SET status = 'published',
             submitted_title = ?,
             description = ?,
             creator_credit = ?,
             source_url = ?,
             category_id = ?,
             reviewed_by_user_id = ?,
             reviewed_at = ?,
             published_asset_id = ?,
             media_cleanup_status = 'pending_media_present',
             review_version = review_version + 1
           WHERE id = ?
             AND status = 'pending'
             AND NOT EXISTS (
               SELECT 1 FROM assets
               WHERE content_hash = ? AND status = 'published'
             )`,
        )
        .bind(
          input.metadata.title,
          input.metadata.description,
          input.metadata.creatorCredit,
          input.metadata.sourceUrl,
          input.metadata.categoryId,
          input.actorUserId,
          now,
          input.assetId,
          input.submission.id,
          input.submission.contentHash,
        ),
      this.db
        .prepare(
          `DELETE FROM submission_tags
           WHERE submission_id = ? AND ${publishedCondition}`,
        )
        .bind(input.submission.id, input.submission.id, input.assetId),
      ...input.metadata.tagIds.map((tagId) =>
        this.db
          .prepare(
            `INSERT INTO submission_tags (submission_id, tag_id)
             SELECT ?, ?
             WHERE ${publishedCondition}`,
          )
          .bind(input.submission.id, tagId, input.submission.id, input.assetId),
      ),
      this.db
        .prepare(
          `INSERT INTO assets (
            id, slug, kind, title, alt_text, media_source_type, durable_media_ref,
            cloudinary_public_id, width, height, format, animation, palette_json,
            motif, status, published_at, created_at, updated_at, content_hash,
            description, creator_credit, source_url, submitted_by_user_id,
            submission_id
          )
          SELECT ?, ?, ?, ?, ?, 'cloudinary', ?, ?, ?, ?, ?, ?, ?, ?, 'published',
            ?, ?, ?, ?, ?, ?, ?, ?, ?
          WHERE ${publishedCondition}`,
        )
        .bind(
          input.assetId,
          input.slug,
          input.submission.assetType,
          input.metadata.title,
          input.metadata.title,
          input.publishedPublicId,
          input.publishedPublicId,
          input.submission.width,
          input.submission.height,
          assetFormat,
          animation,
          JSON.stringify(["#111111", "#444444", "#d7d7d7"]),
          "submitted",
          now,
          now,
          now,
          input.submission.contentHash,
          input.metadata.description,
          input.metadata.creatorCredit,
          input.metadata.sourceUrl,
          input.submission.userId,
          input.submission.id,
          input.submission.id,
          input.assetId,
        ),
      this.db
        .prepare(
          `INSERT INTO asset_categories (asset_id, category_id)
           SELECT ?, ?
           WHERE ${publishedCondition}`,
        )
        .bind(
          input.assetId,
          input.metadata.categoryId,
          input.submission.id,
          input.assetId,
        ),
      ...input.metadata.tagIds.map((tagId) =>
        this.db
          .prepare(
            `INSERT INTO asset_tags (asset_id, tag_id)
             SELECT ?, ?
             WHERE ${publishedCondition}`,
          )
          .bind(input.assetId, tagId, input.submission.id, input.assetId),
      ),
      this.conditionalEventStatement({
        actorUserId: input.actorUserId,
        targetType: "submission",
        targetId: input.submission.id,
        action: "submission.approve",
        previousState: "pending",
        newState: "approved",
        metadata: { assetId: input.assetId },
        reason: null,
        createdAt: now,
        conditionSql: publishedCondition,
        conditionValues: [input.submission.id, input.assetId],
      }),
      this.conditionalEventStatement({
        actorUserId: input.actorUserId,
        targetType: "submission",
        targetId: input.submission.id,
        action: "submission.publish",
        previousState: "approved",
        newState: "published",
        metadata: { assetId: input.assetId, slug: input.slug },
        reason: null,
        createdAt: now,
        conditionSql: publishedCondition,
        conditionValues: [input.submission.id, input.assetId],
      }),
    ]);
    const asset = await this.db
      .prepare(
        `SELECT id FROM assets
         WHERE id = ? AND submission_id = ? AND status = 'published'`,
      )
      .bind(input.assetId, input.submission.id)
      .first<{ id: string }>();
    if (!asset) {
      throw new InvalidRepositoryInputError(
        "Submission changed before it could be published.",
      );
    }
  }

  async markPublishedPendingCleanupDeleted(input: {
    actorUserId: string;
    submissionId: string;
    assetId: string;
  }): Promise<void> {
    const now = new Date().toISOString();
    await this.db.batch([
      this.db
        .prepare(
          `UPDATE submissions
           SET cloudinary_public_id = NULL,
             media_cleanup_status = 'pending_media_deleted'
           WHERE id = ? AND status = 'published'`,
        )
        .bind(input.submissionId),
      this.eventStatement({
        actorUserId: input.actorUserId,
        targetType: "asset",
        targetId: input.assetId,
        action: "publication.pending_cleanup_deleted",
        previousState: "pending_media_present",
        newState: "pending_media_deleted",
        metadata: { submissionId: input.submissionId },
        reason: null,
        createdAt: now,
      }),
    ]);
  }

  async markCleanupFailed(input: {
    actorUserId: string;
    targetType: ModerationTargetType;
    targetId: string;
    submissionId?: string;
    action: string;
  }): Promise<void> {
    const now = new Date().toISOString();
    const statements = [
      this.eventStatement({
        actorUserId: input.actorUserId,
        targetType: input.targetType,
        targetId: input.targetId,
        action: input.action,
        previousState: null,
        newState: "cleanup_failed",
        metadata: input.submissionId
          ? { submissionId: input.submissionId }
          : {},
        reason: "Cloudinary cleanup failed.",
        createdAt: now,
      }),
    ];
    if (input.submissionId) {
      statements.unshift(
        this.db
          .prepare(
            `UPDATE submissions
             SET media_cleanup_status = 'cleanup_failed'
             WHERE id = ?`,
          )
          .bind(input.submissionId),
      );
    }
    await this.db.batch(statements);
  }

  async rejectSubmission(input: {
    actorUserId: string;
    submissionId: string;
    internalNote: unknown;
    publicReason: unknown;
  }): Promise<ModerationSubmission> {
    const internalNote = requiredText(
      input.internalNote,
      2,
      1000,
      "Internal note",
    );
    const publicReason = optionalText(
      input.publicReason,
      500,
      "Public rejection reason",
    );
    const before = await this.readSubmission(input.submissionId);
    if (before.status !== "pending") {
      throw new InvalidRepositoryInputError(
        "Only pending submissions can be rejected.",
      );
    }
    const now = new Date().toISOString();
    const rejectedCondition = `EXISTS (
      SELECT 1 FROM submissions
      WHERE id = ? AND status = 'rejected' AND reviewed_at = ?
    )`;
    await this.db.batch([
      this.db
        .prepare(
          `UPDATE submissions
           SET status = 'rejected',
             reviewed_by_user_id = ?,
             reviewed_at = ?,
             rejection_reason_public = ?,
             rejection_note_internal = ?,
             review_version = review_version + 1
           WHERE id = ? AND status = 'pending'`,
        )
        .bind(
          input.actorUserId,
          now,
          publicReason,
          internalNote,
          input.submissionId,
        ),
      this.conditionalEventStatement({
        actorUserId: input.actorUserId,
        targetType: "submission",
        targetId: input.submissionId,
        action: "submission.reject",
        previousState: "pending",
        newState: "rejected",
        metadata: { publicReasonPresent: !!publicReason },
        reason: internalNote,
        createdAt: now,
        conditionSql: rejectedCondition,
        conditionValues: [input.submissionId, now],
      }),
    ]);
    const rejected = await this.readSubmission(input.submissionId);
    if (rejected.status !== "rejected" || rejected.reviewedAt !== now) {
      throw new InvalidRepositoryInputError(
        "Submission changed before it could be rejected.",
      );
    }
    return rejected;
  }

  async markRejectedCleanupDeleted(input: {
    actorUserId: string;
    submissionId: string;
  }): Promise<void> {
    const now = new Date().toISOString();
    await this.db.batch([
      this.db
        .prepare(
          `UPDATE submissions
           SET cloudinary_public_id = NULL,
             media_cleanup_status = 'pending_media_deleted'
           WHERE id = ? AND status = 'rejected'`,
        )
        .bind(input.submissionId),
      this.eventStatement({
        actorUserId: input.actorUserId,
        targetType: "submission",
        targetId: input.submissionId,
        action: "rejection.pending_cleanup_deleted",
        previousState: "pending_media_present",
        newState: "pending_media_deleted",
        metadata: {},
        reason: null,
        createdAt: now,
      }),
    ]);
  }

  async archiveAsset(input: {
    actorUserId: string;
    assetId: string;
    reason: unknown;
  }): Promise<void> {
    assertId(input.assetId, "Asset ID");
    const reason = requiredText(input.reason, 2, 500, "Archive reason");
    const now = new Date().toISOString();
    const row = await this.db
      .prepare(
        `UPDATE assets
         SET status = 'archived', archived_at = ?, archived_by_user_id = ?,
           archive_reason = ?, updated_at = ?
         WHERE id = ? AND status = 'published'
         RETURNING id`,
      )
      .bind(now, input.actorUserId, reason, now, input.assetId)
      .first<{ id: string }>();
    if (!row) {
      throw new NotFoundError("Published asset was not found.");
    }
    await this.recordEvent({
      actorUserId: input.actorUserId,
      targetType: "asset",
      targetId: input.assetId,
      action: "asset.archive",
      previousState: "published",
      newState: "archived",
      metadata: {},
      reason,
    });
  }

  async listCategories(): Promise<ModerationCategory[]> {
    const { results } = await this.db
      .prepare(
        `SELECT id, slug, name, description, supported_kinds
         FROM categories
         ORDER BY name ASC`,
      )
      .all<CategoryRow>();
    return results.map(mapCategory);
  }

  async listTags(): Promise<ModerationTag[]> {
    const { results } = await this.db
      .prepare(
        `SELECT id, slug, display_name
         FROM tags
         ORDER BY display_name ASC`,
      )
      .all<TagRow>();
    return results.map(mapTag);
  }

  async createCategory(input: {
    actorUserId: string;
    name: unknown;
    description: unknown;
    kinds: unknown;
  }): Promise<ModerationCategory> {
    const name = requiredText(input.name, 2, 80, "Category name");
    const description = requiredText(
      input.description,
      2,
      200,
      "Category description",
    );
    const kinds = this.parseKindInput(input.kinds);
    const id = crypto.randomUUID();
    const slug = await this.uniqueSlug("categories", slugify(name));
    const now = new Date().toISOString();
    await this.db.batch([
      this.db
        .prepare(
          `INSERT INTO categories (
            id, slug, name, description, supported_kinds, created_at,
            updated_at, created_by_user_id, updated_by_user_id
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          id,
          slug,
          name,
          description,
          kinds.join(","),
          now,
          now,
          input.actorUserId,
          input.actorUserId,
        ),
      this.eventStatement({
        actorUserId: input.actorUserId,
        targetType: "category",
        targetId: id,
        action: "category.create",
        previousState: null,
        newState: "active",
        metadata: { slug, kinds },
        reason: null,
        createdAt: now,
      }),
    ]);
    return this.categoryBySlug(slug);
  }

  async updateCategory(input: {
    actorUserId: string;
    categoryId: string;
    name: unknown;
    description: unknown;
    kinds: unknown;
  }): Promise<ModerationCategory> {
    const before = await this.categoryById(input.categoryId);
    const name = requiredText(input.name, 2, 80, "Category name");
    const description = requiredText(
      input.description,
      2,
      200,
      "Category description",
    );
    const kinds = this.parseKindInput(input.kinds);
    const now = new Date().toISOString();
    await this.db.batch([
      this.db
        .prepare(
          `UPDATE categories
           SET name = ?, description = ?, supported_kinds = ?,
             updated_at = ?, updated_by_user_id = ?
           WHERE id = ?`,
        )
        .bind(
          name,
          description,
          kinds.join(","),
          now,
          input.actorUserId,
          input.categoryId,
        ),
      this.eventStatement({
        actorUserId: input.actorUserId,
        targetType: "category",
        targetId: input.categoryId,
        action: "category.update",
        previousState: before.slug,
        newState: before.slug,
        metadata: { before, after: { name, description, kinds } },
        reason: null,
        createdAt: now,
      }),
    ]);
    return this.categoryById(input.categoryId);
  }

  async deleteCategory(input: {
    actorUserId: string;
    categoryId: string;
  }): Promise<void> {
    const refs = await this.referenceCount("category", input.categoryId);
    if (refs > 0) {
      throw new InvalidRepositoryInputError(
        "Category cannot be deleted while referenced.",
      );
    }
    const before = await this.categoryById(input.categoryId);
    const now = new Date().toISOString();
    await this.db.batch([
      this.db
        .prepare("DELETE FROM categories WHERE id = ?")
        .bind(input.categoryId),
      this.eventStatement({
        actorUserId: input.actorUserId,
        targetType: "category",
        targetId: input.categoryId,
        action: "category.delete",
        previousState: before.slug,
        newState: "deleted",
        metadata: {},
        reason: null,
        createdAt: now,
      }),
    ]);
  }

  async createTag(input: {
    actorUserId: string;
    displayName: unknown;
  }): Promise<ModerationTag> {
    const displayName = requiredText(input.displayName, 2, 50, "Tag name");
    const id = crypto.randomUUID();
    const slug = await this.uniqueSlug("tags", slugify(displayName));
    const now = new Date().toISOString();
    await this.db.batch([
      this.db
        .prepare(
          `INSERT INTO tags (
            id, slug, display_name, created_at, updated_at,
            created_by_user_id, updated_by_user_id
          ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          id,
          slug,
          displayName,
          now,
          now,
          input.actorUserId,
          input.actorUserId,
        ),
      this.eventStatement({
        actorUserId: input.actorUserId,
        targetType: "tag",
        targetId: id,
        action: "tag.create",
        previousState: null,
        newState: "active",
        metadata: { slug },
        reason: null,
        createdAt: now,
      }),
    ]);
    return this.tagBySlug(slug);
  }

  async updateTag(input: {
    actorUserId: string;
    tagId: string;
    displayName: unknown;
  }): Promise<ModerationTag> {
    const before = await this.tagById(input.tagId);
    const displayName = requiredText(input.displayName, 2, 50, "Tag name");
    const now = new Date().toISOString();
    await this.db.batch([
      this.db
        .prepare(
          `UPDATE tags
           SET display_name = ?, updated_at = ?, updated_by_user_id = ?
           WHERE id = ?`,
        )
        .bind(displayName, now, input.actorUserId, input.tagId),
      this.eventStatement({
        actorUserId: input.actorUserId,
        targetType: "tag",
        targetId: input.tagId,
        action: "tag.update",
        previousState: before.slug,
        newState: before.slug,
        metadata: { before, after: { displayName } },
        reason: null,
        createdAt: now,
      }),
    ]);
    return this.tagById(input.tagId);
  }

  async deleteTag(input: {
    actorUserId: string;
    tagId: string;
  }): Promise<void> {
    const refs = await this.referenceCount("tag", input.tagId);
    if (refs > 0) {
      throw new InvalidRepositoryInputError(
        "Tag cannot be deleted while referenced.",
      );
    }
    const before = await this.tagById(input.tagId);
    const now = new Date().toISOString();
    await this.db.batch([
      this.db.prepare("DELETE FROM tags WHERE id = ?").bind(input.tagId),
      this.eventStatement({
        actorUserId: input.actorUserId,
        targetType: "tag",
        targetId: input.tagId,
        action: "tag.delete",
        previousState: before.slug,
        newState: "deleted",
        metadata: {},
        reason: null,
        createdAt: now,
      }),
    ]);
  }

  async recordEvent(input: {
    actorUserId: string | null;
    targetType: ModerationTargetType;
    targetId: string;
    action: string;
    previousState: string | null;
    newState: string | null;
    metadata: Record<string, unknown>;
    reason: string | null;
  }): Promise<void> {
    await this.eventStatement({
      ...input,
      createdAt: new Date().toISOString(),
    }).run();
  }

  async listEvents(input: {
    targetType?: ModerationTargetType;
    targetId?: string;
    action?: string;
    actorUserId?: string;
    limit?: number;
  }): Promise<ModerationEvent[]> {
    const clauses: string[] = [];
    const values: unknown[] = [];
    if (input.targetType) {
      clauses.push("target_type = ?");
      values.push(input.targetType);
    }
    if (input.targetId) {
      clauses.push("target_id = ?");
      values.push(input.targetId);
    }
    if (input.action) {
      clauses.push("action = ?");
      values.push(input.action);
    }
    if (input.actorUserId) {
      clauses.push("actor_user_id = ?");
      values.push(input.actorUserId);
    }
    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    const limit = Math.min(Math.max(input.limit ?? 100, 1), 200);
    const { results } = await this.db
      .prepare(
        `SELECT id, actor_user_id, target_type, target_id, action,
          previous_state, new_state, metadata_json, reason, created_at
         FROM moderation_events
         ${where}
         ORDER BY created_at DESC, id DESC
         LIMIT ${limit}`,
      )
      .bind(...values)
      .all<EventRow>();
    return results.map(mapEvent);
  }

  private async countActiveOwners(): Promise<number> {
    const row = await this.db
      .prepare(
        `SELECT COUNT(*) AS count
         FROM moderator_memberships
         WHERE role = 'owner' AND status = 'active'`,
      )
      .first<{ count: number }>();
    return Number(row?.count ?? 0);
  }

  private async hasRevokedMembership(userId: string): Promise<boolean> {
    const row = await this.db
      .prepare(
        `SELECT id
         FROM moderator_memberships
         WHERE user_id = ? AND status = 'revoked'
         LIMIT 1`,
      )
      .bind(userId)
      .first<{ id: string }>();
    return !!row;
  }

  async uniqueAssetSlug(title: string, kind: AssetKind): Promise<string> {
    return this.uniqueSlug("assets", slugify(title), kind);
  }

  private eventStatement(input: {
    actorUserId: string | null;
    targetType: ModerationTargetType;
    targetId: string;
    action: string;
    previousState: string | null;
    newState: string | null;
    metadata: Record<string, unknown>;
    reason: string | null;
    createdAt: string;
  }) {
    return this.db
      .prepare(
        `INSERT INTO moderation_events (
          id, actor_user_id, target_type, target_id, action, previous_state,
          new_state, metadata_json, reason, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        crypto.randomUUID(),
        input.actorUserId,
        input.targetType,
        input.targetId,
        input.action,
        input.previousState,
        input.newState,
        JSON.stringify(input.metadata),
        input.reason,
        input.createdAt,
      );
  }

  private conditionalEventStatement(input: {
    actorUserId: string | null;
    targetType: ModerationTargetType;
    targetId: string;
    action: string;
    previousState: string | null;
    newState: string | null;
    metadata: Record<string, unknown>;
    reason: string | null;
    createdAt: string;
    conditionSql: string;
    conditionValues: unknown[];
  }) {
    return this.db
      .prepare(
        `INSERT INTO moderation_events (
          id, actor_user_id, target_type, target_id, action, previous_state,
          new_state, metadata_json, reason, created_at
        )
        SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
        WHERE ${input.conditionSql}`,
      )
      .bind(
        crypto.randomUUID(),
        input.actorUserId,
        input.targetType,
        input.targetId,
        input.action,
        input.previousState,
        input.newState,
        JSON.stringify(input.metadata),
        input.reason,
        input.createdAt,
        ...input.conditionValues,
      );
  }

  private async hydrateModerationRow(
    row: ModerationSubmissionRow,
  ): Promise<ModerationSubmission> {
    const submission = await this.submissions.readOwnedSubmission(
      row.user_id,
      row.id,
    );
    return {
      ...submission,
      submitter: {
        id: row.user_id,
        username: row.username,
        globalName: row.global_name,
      },
    };
  }

  private moderationSubmissionSelect(): string {
    return `SELECT
      submissions.id,
      submissions.user_id,
      users.username,
      users.global_name
     FROM submissions
     JOIN users ON users.id = submissions.user_id`;
  }

  private async categoryBySlug(slug: string): Promise<ModerationCategory> {
    const row = await this.db
      .prepare(
        `SELECT id, slug, name, description, supported_kinds
         FROM categories
         WHERE slug = ?`,
      )
      .bind(slug)
      .first<CategoryRow>();
    if (!row) throw new InvalidRepositoryInputError("Choose a category.");
    return mapCategory(row);
  }

  private async categoryById(id: string): Promise<ModerationCategory> {
    assertId(id, "Category ID");
    const row = await this.db
      .prepare(
        `SELECT id, slug, name, description, supported_kinds
         FROM categories
         WHERE id = ?`,
      )
      .bind(id)
      .first<CategoryRow>();
    if (!row) throw new NotFoundError("Category was not found.");
    return mapCategory(row);
  }

  private async tagBySlug(slug: string): Promise<ModerationTag> {
    const row = await this.db
      .prepare("SELECT id, slug, display_name FROM tags WHERE slug = ?")
      .bind(slug)
      .first<TagRow>();
    if (!row)
      throw new InvalidRepositoryInputError("Choose only existing tags.");
    return mapTag(row);
  }

  private async tagById(id: string): Promise<ModerationTag> {
    assertId(id, "Tag ID");
    const row = await this.db
      .prepare("SELECT id, slug, display_name FROM tags WHERE id = ?")
      .bind(id)
      .first<TagRow>();
    if (!row) throw new NotFoundError("Tag was not found.");
    return mapTag(row);
  }

  private parseKindInput(value: unknown): AssetKind[] {
    const kinds = Array.from(new Set(normalizeStringList(value))).map((kind) =>
      parseAssetKind(kind),
    );
    if (kinds.length === 0) {
      throw new InvalidRepositoryInputError("Choose at least one asset type.");
    }
    return kinds;
  }

  private async uniqueSlug(
    table: "assets" | "categories" | "tags",
    baseSlug: string,
    kind?: AssetKind,
  ): Promise<string> {
    const base = baseSlug || "item";
    for (let index = 0; index < 100; index += 1) {
      const slug = index === 0 ? base : `${base}-${index + 1}`;
      const row =
        table === "assets"
          ? await this.db
              .prepare("SELECT id FROM assets WHERE kind = ? AND slug = ?")
              .bind(kind, slug)
              .first<{ id: string }>()
          : await this.db
              .prepare(`SELECT id FROM ${table} WHERE slug = ?`)
              .bind(slug)
              .first<{ id: string }>();
      if (!row) return slug;
    }
    return `${base}-${crypto.randomUUID().slice(0, 8)}`;
  }

  private async referenceCount(
    target: "category" | "tag",
    id: string,
  ): Promise<number> {
    assertId(id, `${target} ID`);
    const statements =
      target === "category"
        ? [
            "SELECT COUNT(*) AS count FROM asset_categories WHERE category_id = ?",
            "SELECT COUNT(*) AS count FROM submissions WHERE category_id = ?",
          ]
        : [
            "SELECT COUNT(*) AS count FROM asset_tags WHERE tag_id = ?",
            "SELECT COUNT(*) AS count FROM submission_tags WHERE tag_id = ?",
          ];
    let total = 0;
    for (const statement of statements) {
      const row = await this.db
        .prepare(statement)
        .bind(id)
        .first<{ count: number }>();
      total += Number(row?.count ?? 0);
    }
    return total;
  }
}

interface ModerationSubmissionRow {
  id: string;
  user_id: string;
  username: string;
  global_name: string | null;
}

function metadataSnapshot(submission: PendingSubmission) {
  return {
    title: submission.title,
    description: submission.description,
    category: submission.category?.slug ?? null,
    tags: submission.tags.map((tag) => tag.slug),
    creatorCredit: submission.creatorCredit,
    sourceUrl: submission.sourceUrl,
  };
}
