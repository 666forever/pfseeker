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
    await access.repository.createMembership({
      actorUserId: access.currentUser.user.id,
      userId: typeof data.userId === "string" ? data.userId : "",
      role: data.role === "owner" ? "owner" : "moderator",
      reason: typeof data.reason === "string" ? data.reason : undefined,
    });
    return redirectAfterForm("/moderation/members");
  } catch (error) {
    return moderationErrorResponse(error);
  }
};

export const ALL: APIRoute = () =>
  new Response(null, {
    status: 405,
    headers: { allow: "POST", "cache-control": "no-store" },
  });
