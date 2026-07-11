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
    const tagId = context.params.tagId ?? "";
    const { data } = await readModerationBody(context);
    if (data._method === "DELETE") {
      await access.repository.deleteTag({
        actorUserId: access.currentUser.user.id,
        tagId,
      });
    } else {
      await access.repository.updateTag({
        actorUserId: access.currentUser.user.id,
        tagId,
        displayName: data.displayName,
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
