import type { APIRoute } from "astro";
import type { AssetKind } from "@/lib/media";
import {
  createPendingPublicId,
  createSignedUploadParameters,
  getCloudinaryConfig,
  uploadIntentExpiresAt,
} from "@/server/services/cloudinary";
import {
  assertSameOriginMutation,
  getAuthenticatedSubmissionRepository,
  jsonResponse,
  readJsonBody,
  submissionErrorResponse,
} from "@/server/services/submission-api";

function parseAssetType(value: unknown): AssetKind | undefined {
  return value === "pfp" || value === "banner" || value === "icon"
    ? value
    : undefined;
}

export const POST: APIRoute = async (context) => {
  try {
    assertSameOriginMutation(context);
    const body = await readJsonBody(context);
    const assetType = parseAssetType(body.assetType);
    if (!assetType) {
      return jsonResponse({ error: "Choose an asset type." }, 400);
    }

    const { userId, repository } =
      await getAuthenticatedSubmissionRepository(context);
    await repository.assertCanCreateIntent(userId);
    const config = await getCloudinaryConfig(context.locals);
    const intentId = crypto.randomUUID();
    const publicId = createPendingPublicId({
      userId,
      intentId,
      folder: config.pendingFolder,
    });
    const expiresAt = uploadIntentExpiresAt();
    const intent = await repository.createUploadIntent({
      id: intentId,
      userId,
      assetType,
      publicId,
      expiresAt,
    });

    return jsonResponse(
      {
        intentId: intent.id,
        upload: await createSignedUploadParameters({
          config,
          publicId,
          intentId,
          expiresAt,
        }),
      },
      201,
    );
  } catch (error) {
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
