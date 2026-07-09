import type { APIRoute } from "astro";
import {
  getCloudinaryConfig,
  deleteCloudinaryResource,
} from "@/server/services/cloudinary";
import {
  assertSameOriginMutation,
  getAuthenticatedSubmissionRepository,
  jsonResponse,
  submissionErrorResponse,
} from "@/server/services/submission-api";
import { InvalidRepositoryInputError } from "@/server/repositories/errors";

export const DELETE: APIRoute = async (context) => {
  try {
    assertSameOriginMutation(context);
    const submissionId = context.params.submissionId ?? "";
    const { userId, repository } =
      await getAuthenticatedSubmissionRepository(context);
    const submission = await repository.readOwnedSubmission(
      userId,
      submissionId,
    );
    const config = await getCloudinaryConfig(context.locals);
    await deleteCloudinaryResource(config, submission.cloudinaryPublicId);
    await repository.deleteOwnedSubmission({ userId, submissionId });
    return jsonResponse({ ok: true });
  } catch (error) {
    return submissionErrorResponse(error);
  }
};

export const POST: APIRoute = async (context) => {
  const formData = await context.request.formData();
  if (formData.get("_method") !== "DELETE") {
    return submissionErrorResponse(
      new InvalidRepositoryInputError("Unsupported submission action."),
    );
  }
  return DELETE(context);
};

export const ALL: APIRoute = () =>
  new Response(null, {
    status: 405,
    headers: {
      allow: "DELETE, POST",
      "cache-control": "no-store",
    },
  });
