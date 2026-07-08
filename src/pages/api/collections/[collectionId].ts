import type { APIRoute } from "astro";
import {
  assertSameOriginMutation,
  getAuthenticatedCollectionRepository,
  jsonResponse,
  mutationErrorResponse,
  readRequestBody,
  redirectAfterForm,
} from "@/server/services/collection-api";

export const PATCH: APIRoute = async (context) => {
  try {
    assertSameOriginMutation(context);
    const collectionId = context.params.collectionId ?? "";
    const { data, isForm } = await readRequestBody(context);
    const { userId, repository } =
      await getAuthenticatedCollectionRepository(context);
    const collection = await repository.renameCollection({
      userId,
      collectionId,
      name: data.name,
    });

    if (isForm) {
      return redirectAfterForm(`/collections/${collection.id}`);
    }

    return jsonResponse({ collection });
  } catch (error) {
    return mutationErrorResponse(error);
  }
};

export const POST: APIRoute = async (context) => PATCH(context);

export const DELETE: APIRoute = async (context) => {
  try {
    assertSameOriginMutation(context);
    const collectionId = context.params.collectionId ?? "";
    const { userId, repository } =
      await getAuthenticatedCollectionRepository(context);
    await repository.deleteCollection({ userId, collectionId });
    return jsonResponse({ ok: true });
  } catch (error) {
    return mutationErrorResponse(error);
  }
};

export const ALL: APIRoute = () =>
  new Response(null, {
    status: 405,
    headers: {
      allow: "PATCH, POST, DELETE",
      "cache-control": "no-store",
    },
  });
