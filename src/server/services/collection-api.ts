import type { APIContext } from "astro";
import {
  AuthenticationRequiredError,
  requireUser,
} from "@/server/auth/session";
import { getD1DatabaseAsync } from "@/server/db/d1";
import { CollectionRepository } from "@/server/repositories/collections";
import {
  InvalidRepositoryInputError,
  NotFoundError,
} from "@/server/repositories/errors";

export class CsrfError extends Error {
  constructor(message = "Request origin could not be verified.") {
    super(message);
    this.name = "CsrfError";
  }
}

export async function getAuthenticatedCollectionRepository(
  context: APIContext,
): Promise<{
  userId: string;
  repository: CollectionRepository;
}> {
  const currentUser = await requireUser(context);
  return {
    userId: currentUser.user.id,
    repository: new CollectionRepository(
      await getD1DatabaseAsync(context.locals),
    ),
  };
}

export function jsonResponse(
  body: unknown,
  status = 200,
  headers?: HeadersInit,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...headers,
    },
  });
}

export function mutationErrorResponse(error: unknown): Response {
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
    return jsonResponse({ error: "Collection was not found." }, 404);
  }

  return jsonResponse(
    { error: "Collection request could not be completed." },
    500,
  );
}

export function assertSameOriginMutation(context: APIContext): void {
  const origin = context.request.headers.get("origin");
  const referer = context.request.headers.get("referer");
  const expected = context.url.origin;

  if (origin) {
    if (origin !== expected) throw new CsrfError();
    return;
  }

  if (referer) {
    try {
      if (new URL(referer).origin !== expected) throw new CsrfError();
      return;
    } catch {
      throw new CsrfError();
    }
  }

  throw new CsrfError();
}

export async function readRequestBody(context: APIContext): Promise<{
  data: Record<string, unknown>;
  isForm: boolean;
}> {
  const length = Number(context.request.headers.get("content-length") ?? 0);
  if (length > 10_000) {
    throw new InvalidRepositoryInputError("Request body is too large.");
  }

  const contentType = context.request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const parsed: unknown = await context.request.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new InvalidRepositoryInputError("JSON body must be an object.");
    }
    return { data: parsed as Record<string, unknown>, isForm: false };
  }

  if (
    contentType.includes("application/x-www-form-urlencoded") ||
    contentType.includes("multipart/form-data")
  ) {
    const form = await context.request.formData();
    return {
      data: Object.fromEntries(form.entries()),
      isForm: true,
    };
  }

  throw new InvalidRepositoryInputError("Unsupported request content type.");
}

export function redirectAfterForm(path: string): Response {
  return new Response(null, {
    status: 303,
    headers: {
      location: path,
      "cache-control": "no-store",
    },
  });
}
