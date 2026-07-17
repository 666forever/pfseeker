import type { APIRoute } from "astro";
import { requireModerator } from "@/server/auth/moderation";
import {
  assertSameOriginMutation,
  moderationErrorResponse,
  readModerationBody,
  redirectAfterForm,
} from "@/server/services/moderation-api";

export const POST: APIRoute = async (context) => {
  try {
    assertSameOriginMutation(context);
    const access = await requireModerator(context);
    const submissionId = context.params.submissionId ?? "";
    const { data, isForm } = await readModerationBody(context);
    const submission = await access.repository.readSubmission(submissionId);
    const metadata = await access.repository.validateModeratedMetadata(
      submission.assetType,
      {
        title: data.title,
        description: data.description,
        category: data.category,
        tags: data.tags,
        creatorCredit: data.creatorCredit,
        sourceUrl: data.sourceUrl,
      },
      { requireTags: false },
    );
    await access.repository.updateSubmissionMetadata({
      actorUserId: access.currentUser.user.id,
      submissionId,
      metadata,
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
