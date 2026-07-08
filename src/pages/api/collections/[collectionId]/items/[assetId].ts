import type { APIRoute } from "astro";
import {
  assertSameOriginMutation,
  getAuthenticatedCollectionRepository,
  jsonResponse,
  mutationErrorResponse,
} from "@/server/services/collection-api";

export const POST: APIRoute = async (context) => {
  try {
    assertSameOriginMutation(context);
    const collectionId = context.params.collectionId ?? "";
    const assetId = context.params.assetId ?? "";
    const { userId, repository } =
      await getAuthenticatedCollectionRepository(context);
    const collection = await repository.addAsset({
      userId,
      collectionId,
      assetId,
    });
    return jsonResponse({ collection });
  } catch (error) {
    return mutationErrorResponse(error);
  }
};

export const DELETE: APIRoute = async (context) => {
  try {
    assertSameOriginMutation(context);
    const collectionId = context.params.collectionId ?? "";
    const assetId = context.params.assetId ?? "";
    const { userId, repository } =
      await getAuthenticatedCollectionRepository(context);
    const collection = await repository.removeAsset({
      userId,
      collectionId,
      assetId,
    });
    return jsonResponse({ collection });
  } catch (error) {
    return mutationErrorResponse(error);
  }
};

export const ALL: APIRoute = () =>
  new Response(null, {
    status: 405,
    headers: {
      allow: "POST, DELETE",
      "cache-control": "no-store",
    },
  });
