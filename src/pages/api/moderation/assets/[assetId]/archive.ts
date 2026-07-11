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
    const assetId = context.params.assetId ?? "";
    const { data } = await readModerationBody(context);
    await access.repository.archiveAsset({
      actorUserId: access.currentUser.user.id,
      assetId,
      reason: data.reason,
    });
    return redirectAfterForm("/moderation/submissions?status=published");
  } catch (error) {
    return moderationErrorResponse(error);
  }
};

export const ALL: APIRoute = () =>
  new Response(null, {
    status: 405,
    headers: { allow: "POST", "cache-control": "no-store" },
  });
