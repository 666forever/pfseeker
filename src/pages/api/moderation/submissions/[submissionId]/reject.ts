import type { APIRoute } from "astro";
import { requireModerator } from "@/server/auth/moderation";
import { getCloudinaryConfig } from "@/server/services/cloudinary";
import {
  assertSameOriginMutation,
  moderationErrorResponse,
  readModerationBody,
  redirectAfterForm,
} from "@/server/services/moderation-api";
import { rejectSubmissionWithCleanup } from "@/server/services/publication";

export const POST: APIRoute = async (context) => {
  try {
    assertSameOriginMutation(context);
    const access = await requireModerator(context);
    const submissionId = context.params.submissionId ?? "";
    const { data, isForm } = await readModerationBody(context);
    await rejectSubmissionWithCleanup({
      repository: access.repository,
      config: await getCloudinaryConfig(context.locals),
      actorUserId: access.currentUser.user.id,
      submissionId,
      internalNote: data.internalNote,
      publicReason: data.publicReason,
    });
    return isForm
      ? redirectAfterForm(`/moderation/submissions/${submissionId}`)
      : new Response(JSON.stringify({ ok: true }), {
          headers: {
            "content-type": "application/json; charset=utf-8",
            "cache-control": "no-store",
          },
        });
  } catch (error) {
    return moderationErrorResponse(error);
  }
};

export const ALL: APIRoute = () =>
  new Response(null, {
    status: 405,
    headers: { allow: "POST", "cache-control": "no-store" },
  });
