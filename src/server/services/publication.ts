import {
  cloudinaryResourceExists,
  copyCloudinaryResource,
  createPublishedPublicId,
  deleteCloudinaryResource,
  type CloudinaryConfig,
} from "@/server/services/cloudinary";
import type {
  ModeratedMetadataInput,
  ModerationRepository,
} from "@/server/repositories/moderation";
import { InvalidRepositoryInputError } from "@/server/repositories/errors";

export type PublicationFailureCategory =
  | "publication_cloudinary_copy_failed"
  | "publication_d1_write_failed"
  | "publication_orphan_target_exists"
  | "publication_invalid_taxonomy"
  | "publication_duplicate_asset"
  | "publication_stale_submission_state"
  | "publication_cleanup_failed";

export class PublicationError extends InvalidRepositoryInputError {
  readonly category: PublicationFailureCategory;

  constructor(category: PublicationFailureCategory) {
    super(category);
    this.name = "PublicationError";
    this.category = category;
  }
}

export async function approveAndPublishSubmission(input: {
  repository: ModerationRepository;
  config: CloudinaryConfig;
  actorUserId: string;
  submissionId: string;
  metadataInput: ModeratedMetadataInput;
}): Promise<{ assetId: string; slug: string }> {
  const submission = await input.repository.readSubmission(input.submissionId);
  const metadata = await input.repository.validateModeratedMetadata(
    submission.assetType,
    input.metadataInput,
  );
  const slug = await input.repository.uniqueAssetSlug(
    metadata.title,
    submission.assetType,
  );
  let assetId = "";
  let publishedPublicId = "";
  for (let attempt = 0; attempt < 3; attempt += 1) {
    assetId = crypto.randomUUID();
    publishedPublicId = createPublishedPublicId({
      assetType: submission.assetType,
      assetId,
    });
    if (!(await cloudinaryResourceExists(input.config, publishedPublicId))) {
      break;
    }
    assetId = "";
    publishedPublicId = "";
  }
  if (!assetId || !publishedPublicId) {
    throw new Error("Published media target is unavailable.");
  }

  if (!submission.cloudinaryPublicId) {
    throw new Error("Pending media is missing for publication.");
  }

  await copyCloudinaryResource({
    config: input.config,
    sourcePublicId: submission.cloudinaryPublicId,
    targetPublicId: publishedPublicId,
  });

  try {
    await input.repository.publishSubmission({
      actorUserId: input.actorUserId,
      submission,
      metadata,
      assetId,
      slug,
      publishedPublicId,
    });
  } catch (error) {
    try {
      await deleteCloudinaryResource(input.config, publishedPublicId);
    } catch {
      await input.repository.markCleanupFailed({
        actorUserId: input.actorUserId,
        targetType: "asset",
        targetId: assetId,
        submissionId: submission.id,
        action: "publication.copied_resource_cleanup_failed",
      });
      throw new PublicationError("publication_orphan_target_exists");
    }
    if (error instanceof InvalidRepositoryInputError) {
      throw error;
    }
    throw new PublicationError("publication_d1_write_failed");
  }

  try {
    await deleteCloudinaryResource(input.config, submission.cloudinaryPublicId);
    await input.repository.markPublishedPendingCleanupDeleted({
      actorUserId: input.actorUserId,
      submissionId: submission.id,
      assetId,
    });
  } catch {
    await input.repository.markCleanupFailed({
      actorUserId: input.actorUserId,
      targetType: "asset",
      targetId: assetId,
      submissionId: submission.id,
      action: "publication.pending_cleanup_failed",
    });
  }

  return { assetId, slug };
}

export async function rejectSubmissionWithCleanup(input: {
  repository: ModerationRepository;
  config: CloudinaryConfig;
  actorUserId: string;
  submissionId: string;
  internalNote: unknown;
  publicReason: unknown;
}): Promise<void> {
  const rejected = await input.repository.rejectSubmission({
    actorUserId: input.actorUserId,
    submissionId: input.submissionId,
    internalNote: input.internalNote,
    publicReason: input.publicReason,
  });
  if (!rejected.cloudinaryPublicId) return;
  try {
    await deleteCloudinaryResource(input.config, rejected.cloudinaryPublicId);
    await input.repository.markRejectedCleanupDeleted({
      actorUserId: input.actorUserId,
      submissionId: input.submissionId,
    });
  } catch {
    await input.repository.markCleanupFailed({
      actorUserId: input.actorUserId,
      targetType: "submission",
      targetId: input.submissionId,
      submissionId: input.submissionId,
      action: "rejection.pending_cleanup_failed",
    });
  }
}
