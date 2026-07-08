import type { APIRoute } from "astro";
import {
  assertSameOriginMutation,
  getAuthenticatedCollectionRepository,
  jsonResponse,
  mutationErrorResponse,
  readRequestBody,
} from "@/server/services/collection-api";

export const POST: APIRoute = async (context) => {
  try {
    assertSameOriginMutation(context);
    const collectionId = context.params.collectionId ?? "";
    const { data } = await readRequestBody(context);
    const { userId, repository } =
      await getAuthenticatedCollectionRepository(context);
    const collection = await repository.reorderItems({
      userId,
      collectionId,
      assetIds: data.assetIds,
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
      allow: "POST",
      "cache-control": "no-store",
    },
  });
