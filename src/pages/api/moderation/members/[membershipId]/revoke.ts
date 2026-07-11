import type { APIRoute } from "astro";
import { AuthRepository } from "@/server/repositories/auth";
import { getD1DatabaseAsync } from "@/server/db/d1";
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
    const membershipId = context.params.membershipId ?? "";
    const { data } = await readModerationBody(context);
    const membership = await access.repository.revokeMembership({
      actorUserId: access.currentUser.user.id,
      membershipId,
      reason: data.reason,
    });
    const authRepository = new AuthRepository(
      await getD1DatabaseAsync(context.locals),
    );
    await authRepository.revokeActiveSessionsForUser(membership.userId);
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
