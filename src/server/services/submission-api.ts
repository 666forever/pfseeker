import type { APIContext } from "astro";
import {
  AuthenticationRequiredError,
  requireUser,
} from "@/server/auth/session";
import { getD1DatabaseAsync } from "@/server/db/d1";
import {
  InvalidRepositoryInputError,
  NotFoundError,
} from "@/server/repositories/errors";
import { SubmissionRepository } from "@/server/repositories/submissions";
import { CloudinaryConfigError } from "@/server/services/cloudinary";
import {
  assertSameOriginMutation,
  CsrfError,
  jsonResponse,
} from "@/server/services/collection-api";

export { assertSameOriginMutation, jsonResponse };

export async function getAuthenticatedSubmissionRepository(
  context: APIContext,
): Promise<{
  userId: string;
  repository: SubmissionRepository;
}> {
  const currentUser = await requireUser(context);
  return {
    userId: currentUser.user.id,
    repository: new SubmissionRepository(
      await getD1DatabaseAsync(context.locals),
    ),
  };
}

export function submissionErrorResponse(error: unknown): Response {
  if (error instanceof AuthenticationRequiredError) {
    return jsonResponse({ error: "Authentication is required." }, 401);
  }

  if (error instanceof CsrfError) {
    return jsonResponse({ error: error.message }, 403);
  }

  if (error instanceof InvalidRepositoryInputError) {
    return jsonResponse({ error: error.message }, 400);
  }

  if (error instanceof NotFoundError) {
    return jsonResponse({ error: "Submission was not found." }, 404);
  }

  if (error instanceof CloudinaryConfigError) {
    return jsonResponse(
      { error: "Submission uploads are not configured." },
      503,
    );
  }

  return jsonResponse(
    { error: "Submission request could not be completed." },
    500,
  );
}

export async function readJsonBody(
  context: APIContext,
  maxBytes = 20_000,
): Promise<Record<string, unknown>> {
  const length = Number(context.request.headers.get("content-length") ?? 0);
  if (length > maxBytes) {
    throw new InvalidRepositoryInputError("Request body is too large.");
  }
  const contentType = context.request.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    throw new InvalidRepositoryInputError("Unsupported request content type.");
  }
  const parsed: unknown = await context.request.json();
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new InvalidRepositoryInputError("JSON body must be an object.");
  }
  return parsed as Record<string, unknown>;
}
