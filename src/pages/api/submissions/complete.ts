import type { APIRoute } from "astro";
import { D1ContentRepository } from "@/server/repositories/d1";
import { getD1DatabaseAsync } from "@/server/db/d1";
import {
  deleteCloudinaryResource,
  getCloudinaryConfig,
  publicIdInPendingNamespace,
  verifyCloudinaryUpload,
} from "@/server/services/cloudinary";
import {
  assertSameOriginMutation,
  getAuthenticatedSubmissionRepository,
  jsonResponse,
  readJsonBody,
  submissionErrorResponse,
} from "@/server/services/submission-api";
import { validateSubmissionMetadata } from "@/lib/submissions";

export const POST: APIRoute = async (context) => {
  let uploadedPublicId = "";
  try {
    assertSameOriginMutation(context);
    const body = await readJsonBody(context);
    const intentId = typeof body.intentId === "string" ? body.intentId : "";
    uploadedPublicId =
      typeof body.publicId === "string" ? body.publicId.trim() : "";
    const metadataSource =
      body.metadata && typeof body.metadata === "object"
        ? (body.metadata as Record<string, unknown>)
        : {};
    const { userId, repository } =
      await getAuthenticatedSubmissionRepository(context);

    const db = await getD1DatabaseAsync(context.locals);
    const contentRepository = new D1ContentRepository(db);
    const validTags = await contentRepository.listTags();
    const metadata = validateSubmissionMetadata(metadataSource, validTags);
    if (!metadata.ok) {
      return jsonResponse(
        { error: metadata.message, field: metadata.field },
        400,
      );
    }

    const intent = await repository.findUploadIntent(userId, intentId);
    if (!intent)
      return jsonResponse({ error: "Upload intent was not found." }, 404);
    const config = await getCloudinaryConfig(context.locals);
    const verified = await verifyCloudinaryUpload({
      config,
      publicId: uploadedPublicId,
      intentId,
      assetType: metadata.metadata.assetType,
    });

    const submission = await repository.createPendingSubmission({
      userId,
      intentId,
      publicId: uploadedPublicId,
      metadata: metadata.metadata,
      cloudinary: verified,
    });

    return jsonResponse(
      { submission, redirectTo: `/submissions/${submission.id}` },
      201,
    );
  } catch (error) {
    if (uploadedPublicId) {
      try {
        const config = await getCloudinaryConfig(context.locals);
        if (
          publicIdInPendingNamespace(uploadedPublicId, config.pendingFolder)
        ) {
          await deleteCloudinaryResource(config, uploadedPublicId);
        }
      } catch {
        // Verification and creation failures still return the original safe error.
      }
    }
    return submissionErrorResponse(error);
  }
};

export const ALL: APIRoute = () =>
  new Response(null, {
    status: 405,
    headers: {
      allow: "POST",
      "cache-control": "no-store",
    },
  });
