import type { APIContext } from "astro";
import { AuthenticationRequiredError } from "@/server/auth/session";
import { ModerationAuthorizationError } from "@/server/auth/moderation";
import {
  InvalidRepositoryInputError,
  NotFoundError,
} from "@/server/repositories/errors";
import {
  assertSameOriginMutation,
  CsrfError,
  jsonResponse,
  readRequestBody,
  redirectAfterForm,
} from "@/server/services/collection-api";
import { CloudinaryConfigError } from "@/server/services/cloudinary";

export {
  assertSameOriginMutation,
  jsonResponse,
  readRequestBody,
  redirectAfterForm,
};

export function moderationErrorResponse(error: unknown): Response {
  if (error instanceof AuthenticationRequiredError) {
    return jsonResponse({ error: "Authentication is required." }, 401);
  }
  if (error instanceof ModerationAuthorizationError) {
    return jsonResponse({ error: "Moderation access is not available." }, 403);
  }
  if (error instanceof CsrfError) {
    return jsonResponse({ error: error.message }, 403);
  }
  if (error instanceof InvalidRepositoryInputError) {
    return jsonResponse({ error: error.message }, 400);
  }
  if (error instanceof NotFoundError) {
    return jsonResponse({ error: "Resource was not found." }, 404);
  }
  if (error instanceof CloudinaryConfigError) {
    return jsonResponse({ error: "Media service is not configured." }, 503);
  }
  return jsonResponse(
    { error: "Moderation request could not be completed." },
    500,
  );
}

export async function readModerationBody(
  context: APIContext,
): Promise<{ data: Record<string, unknown>; isForm: boolean }> {
  return readRequestBody(context);
}
