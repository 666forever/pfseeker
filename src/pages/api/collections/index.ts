import type { APIRoute } from "astro";
import {
  assertSameOriginMutation,
  getAuthenticatedCollectionRepository,
  jsonResponse,
  mutationErrorResponse,
  readRequestBody,
  redirectAfterForm,
} from "@/server/services/collection-api";

export const GET: APIRoute = async (context) => {
  try {
    const { userId, repository } =
      await getAuthenticatedCollectionRepository(context);
    const collections = await repository.listOwnedCollections(userId);
    const assetId = context.url.searchParams.get("assetId");
    const containing = assetId
      ? Array.from(
          await repository.findCollectionsContainingAsset(userId, assetId),
        )
      : [];

    return jsonResponse({ collections, containing });
  } catch (error) {
    return mutationErrorResponse(error);
  }
};

export const POST: APIRoute = async (context) => {
  try {
    assertSameOriginMutation(context);
    const { data, isForm } = await readRequestBody(context);
    const { userId, repository } =
      await getAuthenticatedCollectionRepository(context);
    const collection = await repository.createCollection({
      userId,
      name: data.name,
    });

    if (isForm) {
      return redirectAfterForm(`/collections/${collection.id}`);
    }

    return jsonResponse({ collection }, 201);
  } catch (error) {
    return mutationErrorResponse(error);
  }
};

export const ALL: APIRoute = () =>
  new Response(null, {
    status: 405,
    headers: {
      allow: "GET, POST",
      "cache-control": "no-store",
    },
  });
