import type { APIRoute } from "astro";
import { requireOwner } from "@/server/auth/moderation";
import {
  assertSameOriginMutation,
  moderationErrorResponse,
  readModerationBody,
  redirectAfterForm,
} from "@/server/services/moderation-api";

export const POST: APIRoute = async (context) => {
  try {
    assertSameOriginMutation(context);
    const access = await requireOwner(context);
    const categoryId = context.params.categoryId ?? "";
    const { data } = await readModerationBody(context);
    if (data._method === "DELETE") {
      await access.repository.deleteCategory({
        actorUserId: access.currentUser.user.id,
        categoryId,
      });
    } else {
      await access.repository.updateCategory({
        actorUserId: access.currentUser.user.id,
        categoryId,
        name: data.name,
        description: data.description,
        kinds: data.kinds,
      });
    }
    return redirectAfterForm("/moderation/taxonomy");
  } catch (error) {
    return moderationErrorResponse(error);
  }
};

export const DELETE: APIRoute = POST;

export const ALL: APIRoute = () =>
  new Response(null, {
    status: 405,
    headers: { allow: "POST, DELETE", "cache-control": "no-store" },
  });
