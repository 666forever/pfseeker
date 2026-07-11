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
    const { data } = await readModerationBody(context);
    await access.repository.createCategory({
      actorUserId: access.currentUser.user.id,
      name: data.name,
      description: data.description,
      kinds: data.kinds,
    });
    return redirectAfterForm("/moderation/taxonomy");
  } catch (error) {
    return moderationErrorResponse(error);
  }
};

export const ALL: APIRoute = () =>
  new Response(null, {
    status: 405,
    headers: { allow: "POST", "cache-control": "no-store" },
  });
