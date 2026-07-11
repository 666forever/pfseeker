import type { AssetKind } from "@/lib/media";
import {
  MAX_ACTIVE_UPLOAD_INTENTS,
  MAX_COMPLETED_SUBMISSIONS_PER_24_HOURS,
  MAX_PENDING_SUBMISSIONS,
  SUBMISSION_STATUS,
  validateSubmissionStatus,
  type SubmissionFormat,
  type SubmissionMetadata,
  type SubmissionStatus,
} from "@/lib/submissions";
import type { D1DatabaseLike } from "@/server/db/d1";
import {
  DatabaseRowError,
  InvalidRepositoryInputError,
  NotFoundError,
} from "@/server/repositories/errors";

export interface UploadIntent {
  id: string;
  userId: string;
  assetType: AssetKind;
  publicId: string;
  expiresAt: string;
  consumedAt: string | null;
  createdAt: string;
}

export interface PendingSubmission {
  id: string;
  userId: string;
  status: SubmissionStatus;
  assetType: AssetKind;
  title: string;
  description: string | null;
  creatorCredit: string | null;
  sourceUrl: string | null;
  reviewedAt: string | null;
  publishedAssetId: string | null;
  publishedAssetSlug: string | null;
  rejectionReasonPublic: string | null;
  mediaCleanupStatus:
    "pending_media_present" | "pending_media_deleted" | "cleanup_failed";
  category: {
    id: string;
    slug: string;
    name: string;
  } | null;
  tags: {
    id: string;
    slug: string;
    displayName: string;
  }[];
  suggestedTags: string[];
  cloudinaryPublicId: string | null;
  cloudinaryResourceType: "image";
  cloudinaryFormat: SubmissionFormat;
  bytes: number;
  width: number;
  height: number;
  contentHash: string;
  duplicatePendingFlag: boolean;
  createdAt: string;
}

export interface CreateSubmissionInput {
  userId: string;
  intentId: string;
  publicId: string;
  metadata: SubmissionMetadata;
  cloudinary: {
    resourceType: "image";
    format: SubmissionFormat;
    bytes: number;
    width: number;
    height: number;
    contentHash: string;
  };
}

interface UploadIntentRow {
  id: string;
  user_id: string;
  asset_type: string;
  public_id: string;
  expires_at: string;
  consumed_at: string | null;
  created_at: string;
}

interface SubmissionRow {
  id: string;
  user_id: string;
  status: string;
  asset_type: string;
  submitted_title: string;
  description: string | null;
  creator_credit: string | null;
  source_url: string | null;
  category_id: string | null;
  category_slug: string | null;
  category_name: string | null;
  cloudinary_public_id: string | null;
  cloudinary_resource_type: string;
  cloudinary_format: string;
  bytes: number;
  width: number;
  height: number;
  content_hash: string;
  duplicate_pending_flag: number;
  reviewed_at: string | null;
  published_asset_id: string | null;
  published_asset_slug: string | null;
  rejection_reason_public: string | null;
  media_cleanup_status: string;
  created_at: string;
}

interface TagRow {
  id: string;
  slug: string;
  display_name: string;
}

function assertAssetKind(value: string): AssetKind {
  if (value === "pfp" || value === "banner" || value === "icon") return value;
  throw new DatabaseRowError("D1 submission row has invalid asset type.");
}

function assertStatus(value: string): SubmissionStatus {
  if (validateSubmissionStatus(value)) return value;
  throw new DatabaseRowError("D1 submission row has invalid status.");
}

function assertCleanupStatus(
  value: string,
): PendingSubmission["mediaCleanupStatus"] {
  if (
    value === "pending_media_present" ||
    value === "pending_media_deleted" ||
    value === "cleanup_failed"
  ) {
    return value;
  }
  throw new DatabaseRowError("D1 submission row has invalid cleanup status.");
}

function assertFormat(value: string): SubmissionFormat {
  if (
    value === "jpg" ||
    value === "jpeg" ||
    value === "png" ||
    value === "webp" ||
    value === "gif"
  ) {
    return value;
  }
  throw new DatabaseRowError("D1 submission row has invalid format.");
}

function assertId(value: string, label: string): void {
  if (!/^[0-9a-fA-F-]{36}$/.test(value)) {
    throw new InvalidRepositoryInputError(`${label} is malformed.`);
  }
}

function mapIntent(row: UploadIntentRow): UploadIntent {
  return {
    id: row.id,
    userId: row.user_id,
    assetType: assertAssetKind(row.asset_type),
    publicId: row.public_id,
    expiresAt: row.expires_at,
    consumedAt: row.consumed_at,
    createdAt: row.created_at,
  };
}

function mapSubmission(
  row: SubmissionRow,
  tags: TagRow[],
  suggestedTags: string[],
): PendingSubmission {
  if (row.cloudinary_resource_type !== "image") {
    throw new DatabaseRowError("D1 submission row has invalid resource type.");
  }
  return {
    id: row.id,
    userId: row.user_id,
    status: assertStatus(row.status),
    assetType: assertAssetKind(row.asset_type),
    title: row.submitted_title,
    description: row.description,
    creatorCredit: row.creator_credit,
    sourceUrl: row.source_url,
    reviewedAt: row.reviewed_at,
    publishedAssetId: row.published_asset_id,
    publishedAssetSlug: row.published_asset_slug,
    rejectionReasonPublic: row.rejection_reason_public,
    mediaCleanupStatus: assertCleanupStatus(row.media_cleanup_status),
    category:
      row.category_id && row.category_slug && row.category_name
        ? {
            id: row.category_id,
            slug: row.category_slug,
            name: row.category_name,
          }
        : null,
    tags: tags.map((tag) => ({
      id: tag.id,
      slug: tag.slug,
      displayName: tag.display_name,
    })),
    suggestedTags,
    cloudinaryPublicId: row.cloudinary_public_id,
    cloudinaryResourceType: "image",
    cloudinaryFormat: assertFormat(row.cloudinary_format),
    bytes: Number(row.bytes),
    width: Number(row.width),
    height: Number(row.height),
    contentHash: row.content_hash,
    duplicatePendingFlag: row.duplicate_pending_flag === 1,
    createdAt: row.created_at,
  };
}

export class SubmissionRepository {
  constructor(private readonly db: D1DatabaseLike) {}

  async createUploadIntent(input: {
    id?: string;
    userId: string;
    assetType: AssetKind;
    publicId: string;
    expiresAt: string;
  }): Promise<UploadIntent> {
    const id = input.id ?? crypto.randomUUID();
    const now = new Date().toISOString();
    await this.db
      .prepare(
        `INSERT INTO submission_upload_intents (
          id, user_id, asset_type, public_id, expires_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        id,
        input.userId,
        input.assetType,
        input.publicId,
        input.expiresAt,
        now,
      )
      .run();
    return {
      id,
      userId: input.userId,
      assetType: input.assetType,
      publicId: input.publicId,
      expiresAt: input.expiresAt,
      consumedAt: null,
      createdAt: now,
    };
  }

  async findUploadIntent(
    userId: string,
    intentId: string,
  ): Promise<UploadIntent | null> {
    assertId(intentId, "Upload intent ID");
    const row = await this.db
      .prepare(
        `SELECT id, user_id, asset_type, public_id, expires_at, consumed_at, created_at
         FROM submission_upload_intents
         WHERE id = ? AND user_id = ?`,
      )
      .bind(intentId, userId)
      .first<UploadIntentRow>();
    return row ? mapIntent(row) : null;
  }

  async consumeUploadIntent(userId: string, intentId: string): Promise<void> {
    assertId(intentId, "Upload intent ID");
    await this.db
      .prepare(
        `UPDATE submission_upload_intents
         SET consumed_at = ?
         WHERE id = ? AND user_id = ? AND consumed_at IS NULL`,
      )
      .bind(new Date().toISOString(), intentId, userId)
      .run();
  }

  async countActiveUploadIntents(userId: string): Promise<number> {
    const row = await this.db
      .prepare(
        `SELECT COUNT(*) AS count
         FROM submission_upload_intents
         WHERE user_id = ?
           AND consumed_at IS NULL
           AND expires_at > ?`,
      )
      .bind(userId, new Date().toISOString())
      .first<{ count: number }>();
    return Number(row?.count ?? 0);
  }

  async countCompletedInRollingDay(userId: string): Promise<number> {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const row = await this.db
      .prepare(
        `SELECT COUNT(*) AS count
         FROM submissions
         WHERE user_id = ? AND created_at >= ?`,
      )
      .bind(userId, since)
      .first<{ count: number }>();
    return Number(row?.count ?? 0);
  }

  async nextCompletedSubmissionRetryAt(userId: string): Promise<string | null> {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { results } = await this.db
      .prepare(
        `SELECT created_at
         FROM submissions
         WHERE user_id = ? AND created_at >= ?
         ORDER BY created_at ASC
         LIMIT 1`,
      )
      .bind(userId, since)
      .all<{ created_at: string }>();
    const first = results[0]?.created_at;
    return first
      ? new Date(Date.parse(first) + 24 * 60 * 60 * 1000).toISOString()
      : null;
  }

  async countPendingSubmissions(userId: string): Promise<number> {
    const row = await this.db
      .prepare(
        `SELECT COUNT(*) AS count
         FROM submissions
         WHERE user_id = ? AND status = 'pending'`,
      )
      .bind(userId)
      .first<{ count: number }>();
    return Number(row?.count ?? 0);
  }

  async assertCanCreateIntent(userId: string): Promise<void> {
    const activeIntents = await this.countActiveUploadIntents(userId);
    if (activeIntents >= MAX_ACTIVE_UPLOAD_INTENTS) {
      throw new InvalidRepositoryInputError(
        "Too many upload flows are active. Wait a few minutes and try again.",
      );
    }
  }

  async assertCanCompleteSubmission(userId: string): Promise<void> {
    const [dailyCount, pendingCount] = await Promise.all([
      this.countCompletedInRollingDay(userId),
      this.countPendingSubmissions(userId),
    ]);
    if (dailyCount >= MAX_COMPLETED_SUBMISSIONS_PER_24_HOURS) {
      const retryAt = await this.nextCompletedSubmissionRetryAt(userId);
      throw new InvalidRepositoryInputError(
        retryAt
          ? `Daily submission limit reached. Try again after ${retryAt}.`
          : "Daily submission limit reached. Try again later.",
      );
    }
    if (pendingCount >= MAX_PENDING_SUBMISSIONS) {
      throw new InvalidRepositoryInputError(
        "You already have 50 pending submissions.",
      );
    }
  }

  async hasUserDuplicate(
    userId: string,
    contentHash: string,
  ): Promise<boolean> {
    const row = await this.db
      .prepare(
        `SELECT id FROM submissions
         WHERE user_id = ? AND content_hash = ?
         LIMIT 1`,
      )
      .bind(userId, contentHash)
      .first<{ id: string }>();
    return !!row;
  }

  async findPublishedDuplicate(
    contentHash: string,
  ): Promise<{ kind: AssetKind; slug: string } | null> {
    const row = await this.db
      .prepare(
        `SELECT kind, slug
         FROM assets
         WHERE content_hash = ? AND status = 'published'
         LIMIT 1`,
      )
      .bind(contentHash)
      .first<{ kind: string; slug: string }>();
    return row ? { kind: assertAssetKind(row.kind), slug: row.slug } : null;
  }

  async hasPendingDuplicateFromOtherUser(
    userId: string,
    contentHash: string,
  ): Promise<boolean> {
    const row = await this.db
      .prepare(
        `SELECT id FROM submissions
         WHERE user_id <> ? AND content_hash = ? AND status = 'pending'
         LIMIT 1`,
      )
      .bind(userId, contentHash)
      .first<{ id: string }>();
    return !!row;
  }

  async createPendingSubmission(
    input: CreateSubmissionInput,
  ): Promise<PendingSubmission> {
    const intent = await this.findUploadIntent(input.userId, input.intentId);
    if (!intent) throw new NotFoundError("Upload intent was not found.");
    if (intent.consumedAt) {
      throw new InvalidRepositoryInputError("Upload intent was already used.");
    }
    if (Date.parse(intent.expiresAt) <= Date.now()) {
      throw new InvalidRepositoryInputError("Upload intent expired.");
    }
    if (
      intent.assetType !== input.metadata.assetType ||
      intent.publicId !== input.publicId
    ) {
      throw new InvalidRepositoryInputError(
        "Upload does not match its intent.",
      );
    }

    await this.assertCanCompleteSubmission(input.userId);
    if (
      await this.hasUserDuplicate(input.userId, input.cloudinary.contentHash)
    ) {
      throw new InvalidRepositoryInputError(
        "You already submitted this exact image.",
      );
    }
    const publishedDuplicate = await this.findPublishedDuplicate(
      input.cloudinary.contentHash,
    );
    if (publishedDuplicate) {
      throw new InvalidRepositoryInputError(
        `This exact image is already published at /${publishedDuplicate.kind}/${publishedDuplicate.slug}.`,
      );
    }

    const categoryId = await this.categoryIdFor(
      input.metadata.assetType,
      input.metadata.category,
    );
    const tagIds = await this.tagIdsFor(input.metadata.tags);
    const duplicatePendingFlag = await this.hasPendingDuplicateFromOtherUser(
      input.userId,
      input.cloudinary.contentHash,
    );
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    const statements = [
      this.db
        .prepare(
          `INSERT INTO submissions (
            id, user_id, status, asset_type, submitted_title, description,
            creator_credit, source_url, category_id, cloudinary_public_id,
            cloudinary_resource_type, cloudinary_format, bytes, width, height,
            content_hash, duplicate_pending_flag, created_at
          ) VALUES (?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          id,
          input.userId,
          input.metadata.assetType,
          input.metadata.title,
          input.metadata.description,
          input.metadata.creatorCredit,
          input.metadata.sourceUrl,
          categoryId,
          input.publicId,
          input.cloudinary.resourceType,
          input.cloudinary.format,
          input.cloudinary.bytes,
          input.cloudinary.width,
          input.cloudinary.height,
          input.cloudinary.contentHash,
          duplicatePendingFlag ? 1 : 0,
          now,
        ),
      this.db
        .prepare(
          `UPDATE submission_upload_intents
           SET consumed_at = ?
           WHERE id = ? AND user_id = ? AND consumed_at IS NULL`,
        )
        .bind(now, input.intentId, input.userId),
      ...tagIds.map((tagId) =>
        this.db
          .prepare(
            `INSERT INTO submission_tags (submission_id, tag_id)
             VALUES (?, ?)`,
          )
          .bind(id, tagId),
      ),
      ...input.metadata.suggestedTags.map((tag) =>
        this.db
          .prepare(
            `INSERT INTO submission_suggested_tags (submission_id, suggested_tag)
             VALUES (?, ?)`,
          )
          .bind(id, tag),
      ),
    ];

    await this.db.batch(statements);
    return this.readOwnedSubmission(input.userId, id);
  }

  async listOwnedPendingSubmissions(
    userId: string,
  ): Promise<PendingSubmission[]> {
    const { results } = await this.db
      .prepare(
        `${this.submissionSelect()}
         WHERE submissions.user_id = ? AND submissions.status = 'pending'
         ORDER BY submissions.created_at DESC`,
      )
      .bind(userId)
      .all<SubmissionRow>();
    return Promise.all(results.map((row) => this.hydrateSubmission(row)));
  }

  async listOwnedSubmissions(userId: string): Promise<PendingSubmission[]> {
    const { results } = await this.db
      .prepare(
        `${this.submissionSelect()}
         WHERE submissions.user_id = ?
         ORDER BY submissions.created_at DESC`,
      )
      .bind(userId)
      .all<SubmissionRow>();
    return Promise.all(results.map((row) => this.hydrateSubmission(row)));
  }

  async readOwnedSubmission(
    userId: string,
    submissionId: string,
  ): Promise<PendingSubmission> {
    assertId(submissionId, "Submission ID");
    const row = await this.db
      .prepare(
        `${this.submissionSelect()}
         WHERE submissions.id = ? AND submissions.user_id = ?`,
      )
      .bind(submissionId, userId)
      .first<SubmissionRow>();
    if (!row) throw new NotFoundError("Submission was not found.");
    return this.hydrateSubmission(row);
  }

  async deleteOwnedSubmission(input: {
    userId: string;
    submissionId: string;
  }): Promise<PendingSubmission> {
    const submission = await this.readOwnedSubmission(
      input.userId,
      input.submissionId,
    );
    if (submission.status !== SUBMISSION_STATUS) {
      throw new InvalidRepositoryInputError(
        "Only pending submissions can be cancelled.",
      );
    }
    await this.db
      .prepare(
        "DELETE FROM submissions WHERE id = ? AND user_id = ? AND status = 'pending'",
      )
      .bind(input.submissionId, input.userId)
      .run();
    return submission;
  }

  private async hydrateSubmission(
    row: SubmissionRow,
  ): Promise<PendingSubmission> {
    const [tags, suggestedTags] = await Promise.all([
      this.db
        .prepare(
          `SELECT tags.id, tags.slug, tags.display_name
           FROM submission_tags
           JOIN tags ON tags.id = submission_tags.tag_id
           WHERE submission_tags.submission_id = ?
           ORDER BY tags.display_name ASC`,
        )
        .bind(row.id)
        .all<TagRow>(),
      this.db
        .prepare(
          `SELECT suggested_tag
           FROM submission_suggested_tags
           WHERE submission_id = ?
           ORDER BY suggested_tag ASC`,
        )
        .bind(row.id)
        .all<{ suggested_tag: string }>(),
    ]);
    return mapSubmission(
      row,
      tags.results,
      suggestedTags.results.map((entry) => entry.suggested_tag),
    );
  }

  private submissionSelect(): string {
    return `SELECT
      submissions.id,
      submissions.user_id,
      submissions.status,
      submissions.asset_type,
      submissions.submitted_title,
      submissions.description,
      submissions.creator_credit,
      submissions.source_url,
      submissions.category_id,
      categories.slug AS category_slug,
      categories.name AS category_name,
      submissions.cloudinary_public_id,
      submissions.cloudinary_resource_type,
      submissions.cloudinary_format,
      submissions.bytes,
      submissions.width,
      submissions.height,
      submissions.content_hash,
      submissions.duplicate_pending_flag,
      submissions.reviewed_at,
      submissions.published_asset_id,
      published_assets.slug AS published_asset_slug,
      submissions.rejection_reason_public,
      submissions.media_cleanup_status,
      submissions.created_at
     FROM submissions
     LEFT JOIN categories ON categories.id = submissions.category_id
     LEFT JOIN assets AS published_assets ON published_assets.id = submissions.published_asset_id`;
  }

  private async categoryIdFor(
    assetType: AssetKind,
    categorySlug: string | null,
  ): Promise<string | null> {
    if (!categorySlug) return null;
    const row = await this.db
      .prepare(
        `SELECT id, supported_kinds
         FROM categories
         WHERE slug = ?`,
      )
      .bind(categorySlug)
      .first<{ id: string; supported_kinds: string }>();
    if (!row || !row.supported_kinds.split(",").includes(assetType)) {
      throw new InvalidRepositoryInputError(
        "Category does not match the asset type.",
      );
    }
    return row.id;
  }

  private async tagIdsFor(tagSlugs: string[]): Promise<string[]> {
    const ids: string[] = [];
    for (const slug of tagSlugs) {
      const row = await this.db
        .prepare("SELECT id FROM tags WHERE slug = ?")
        .bind(slug)
        .first<{ id: string }>();
      if (!row) throw new InvalidRepositoryInputError("Unknown tag selected.");
      ids.push(row.id);
    }
    return ids;
  }
}
